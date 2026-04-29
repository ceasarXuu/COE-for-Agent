import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { hostname } from 'node:os';

export function safeHostname(): string {
  try {
    const value = hostname();
    return typeof value === 'string' && value.length > 0 ? value : 'unknown-host';
  } catch {
    return 'unknown-host';
  }
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // EPERM means the process exists but we lack permission to signal it,
    // which still counts as alive for the purpose of lock arbitration.
    if (err.code === 'EPERM') {
      return true;
    }
    return false;
  }
}

export interface FileLockManagerOptions {
  dataDir: string;
  lockFilePath: string;
  hostId: string;
}

/**
 * Cross-process file lock with stale-owner reclamation and signal-based cleanup.
 * One instance per persistence database; encapsulates lockfile arbitration.
 */
export class FileLockManager {
  private readonly dataDir: string;
  private readonly lockFilePath: string;
  private readonly hostId: string;
  private readonly heldLockReleasers = new Set<() => void>();
  private signalHandlersInstalled = false;
  private readonly signalHandler = () => {
    for (const release of [...this.heldLockReleasers]) {
      try {
        release();
      } catch {
        // best-effort cleanup on shutdown
      }
    }
  };

  constructor(options: FileLockManagerOptions) {
    this.dataDir = options.dataDir;
    this.lockFilePath = options.lockFilePath;
    this.hostId = options.hostId;
  }

  async acquire(): Promise<() => void> {
    mkdirSync(this.dataDir, { recursive: true });
    this.installSignalHandlersOnce();

    while (true) {
      try {
        const fd = openSync(this.lockFilePath, 'wx');
        try {
          const meta = JSON.stringify({
            pid: process.pid,
            hostname: this.hostId,
            acquiredAt: new Date().toISOString()
          });
          writeSync(fd, meta);
        } finally {
          closeSync(fd);
        }
        let releaser: () => void = () => {};
        releaser = () => {
          this.heldLockReleasers.delete(releaser);
          try {
            unlinkSync(this.lockFilePath);
          } catch {
            // Ignore duplicate/unexpected unlock attempts.
          }
        };
        this.heldLockReleasers.add(releaser);
        return releaser;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'EEXIST') {
          throw error;
        }

        if (this.tryReclaimStaleLock()) {
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  releaseAllHeld(): void {
    for (const release of [...this.heldLockReleasers]) {
      try {
        release();
      } catch {
        // ignore
      }
    }
  }

  uninstallSignalHandlers(): void {
    process.off('SIGINT', this.signalHandler);
    process.off('SIGTERM', this.signalHandler);
    process.off('exit', this.signalHandler);
    this.signalHandlersInstalled = false;
  }

  private tryReclaimStaleLock(): boolean {
    let raw: string;
    try {
      raw = readFileSync(this.lockFilePath, 'utf8');
    } catch {
      // File disappeared between EEXIST and read; let the next openSync retry.
      return true;
    }

    let meta: { pid?: unknown; hostname?: unknown; acquiredAt?: unknown } | null = null;
    if (raw.length > 0) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === 'object') {
          meta = parsed as { pid?: unknown; hostname?: unknown; acquiredAt?: unknown };
        }
      } catch {
        meta = null;
      }
    }

    const ownerHost = meta && typeof meta.hostname === 'string' ? meta.hostname : null;
    const ownerPid = meta && typeof meta.pid === 'number' ? meta.pid : null;
    const sameHost = ownerHost === null ? true : ownerHost === this.hostId;

    if (sameHost && ownerPid !== null && !isProcessAlive(ownerPid)) {
      try {
        unlinkSync(this.lockFilePath);
        return true;
      } catch {
        return false;
      }
    }

    // Fall back to age-based heuristic for legacy/unknown lock contents or
    // cross-host locks where we can't probe the owner.
    try {
      const ageMs = Date.now() - statSync(this.lockFilePath).mtimeMs;
      if (ageMs > 30_000) {
        unlinkSync(this.lockFilePath);
        return true;
      }
    } catch {
      return true;
    }

    return false;
  }

  private installSignalHandlersOnce(): void {
    if (this.signalHandlersInstalled) {
      return;
    }
    this.signalHandlersInstalled = true;
    process.once('SIGINT', this.signalHandler);
    process.once('SIGTERM', this.signalHandler);
    process.once('exit', this.signalHandler);
  }
}
