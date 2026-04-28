import { closeSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync, existsSync } from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';

import type { JsonValue } from './schema.js';

export interface StoredEvent {
  eventId: string;
  caseId: string;
  caseRevision: number;
  eventType: string;
  commandName: string;
  actor: JsonValue;
  payload: JsonValue;
  metadata: JsonValue;
  createdAt: Date;
}

export interface StoredCaseRecord {
  id: string;
  title: string | null;
  severity: string | null;
  status: string;
  revision: number;
  payload: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredCurrentStateRecord {
  id: string;
  caseId: string;
  revision: number;
  status: string | null;
  payload: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredCaseListProjectionRecord {
  caseId: string;
  title: string | null;
  summary: string | null;
  severity: string | null;
  status: string | null;
  activeHypothesisCount: number;
  updatedAt: Date;
}

export interface StoredCheckpointRecord {
  caseId: string;
  revision: number;
  projectionState: JsonValue;
}

export interface StoredDedupRecord {
  eventId: string;
  commandResult: JsonValue;
  createdAt: Date;
}

export interface StoredOutboxRecord {
  outboxId: string;
  caseId: string;
  headRevision: number;
  eventId: string;
  taskType: string;
  status: string;
  attemptCount: number;
  availableAt: Date;
  claimedBy: string | null;
  claimedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PersistenceCurrentStateTableName =
  | 'problems'
  | 'blockers'
  | 'repair_attempts'
  | 'evidence_pool'
  | 'evidence_refs'
  | 'hypotheses';

export interface PersistenceStore {
  cases: Record<string, StoredCaseRecord>;
  eventsByCase: Record<string, StoredEvent[]>;
  currentState: Record<PersistenceCurrentStateTableName, Record<string, StoredCurrentStateRecord>>;
  caseListProjection: Record<string, StoredCaseListProjectionRecord>;
  checkpointsByCase: Record<string, Record<string, StoredCheckpointRecord>>;
  dedup: Record<string, StoredDedupRecord>;
  outbox: Record<string, StoredOutboxRecord>;
}

export interface PersistenceClient {
  dataDir: string;
  db: LocalPersistenceDatabase;
  destroy(): Promise<void>;
}

export interface CreatePersistenceClientOptions {
  dataDir?: string;
}

function createEmptyStore(): PersistenceStore {
  return {
    cases: {},
    eventsByCase: {},
    currentState: {
      problems: {},
      blockers: {},
      repair_attempts: {},
      evidence_pool: {},
      evidence_refs: {},
      hypotheses: {}
    },
    caseListProjection: {},
    checkpointsByCase: {},
    dedup: {},
    outbox: {}
  };
}

function serializeStore(store: PersistenceStore): string {
  return JSON.stringify(store, null, 2);
}

function reviveDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function reviveStoredEvent(event: Record<string, unknown>): StoredEvent {
  return {
    eventId: String(event.eventId),
    caseId: String(event.caseId),
    caseRevision: Number(event.caseRevision),
    eventType: String(event.eventType),
    commandName: String(event.commandName),
    actor: (event.actor ?? {}) as JsonValue,
    payload: (event.payload ?? {}) as JsonValue,
    metadata: (event.metadata ?? {}) as JsonValue,
    createdAt: reviveDate(event.createdAt)
  };
}

function reviveCurrentStateRecord(record: Record<string, unknown>): StoredCurrentStateRecord {
  return {
    id: String(record.id),
    caseId: String(record.caseId),
    revision: Number(record.revision),
    status: record.status === null || record.status === undefined ? null : String(record.status),
    payload: (record.payload ?? {}) as JsonValue,
    createdAt: reviveDate(record.createdAt),
    updatedAt: reviveDate(record.updatedAt)
  };
}

function reviveCaseRecord(record: Record<string, unknown>): StoredCaseRecord {
  return {
    id: String(record.id),
    title: record.title === null || record.title === undefined ? null : String(record.title),
    severity: record.severity === null || record.severity === undefined ? null : String(record.severity),
    status: String(record.status),
    revision: Number(record.revision),
    payload: (record.payload ?? {}) as JsonValue,
    createdAt: reviveDate(record.createdAt),
    updatedAt: reviveDate(record.updatedAt)
  };
}

function reviveCaseListProjectionRecord(record: Record<string, unknown>): StoredCaseListProjectionRecord {
  return {
    caseId: String(record.caseId),
    title: record.title === null || record.title === undefined ? null : String(record.title),
    summary: record.summary === null || record.summary === undefined ? null : String(record.summary),
    severity: record.severity === null || record.severity === undefined ? null : String(record.severity),
    status: record.status === null || record.status === undefined ? null : String(record.status),
    activeHypothesisCount: Number(record.activeHypothesisCount ?? 0),
    updatedAt: reviveDate(record.updatedAt)
  };
}

function reviveCheckpointRecord(record: Record<string, unknown>): StoredCheckpointRecord {
  return {
    caseId: String(record.caseId),
    revision: Number(record.revision),
    projectionState: (record.projectionState ?? {}) as JsonValue
  };
}

function reviveDedupRecord(record: Record<string, unknown>): StoredDedupRecord {
  return {
    eventId: String(record.eventId),
    commandResult: (record.commandResult ?? {}) as JsonValue,
    createdAt: reviveDate(record.createdAt)
  };
}

function reviveOutboxRecord(record: Record<string, unknown>): StoredOutboxRecord {
  return {
    outboxId: String(record.outboxId),
    caseId: String(record.caseId),
    headRevision: Number(record.headRevision),
    eventId: String(record.eventId),
    taskType: String(record.taskType),
    status: String(record.status),
    attemptCount: Number(record.attemptCount),
    availableAt: reviveDate(record.availableAt),
    claimedBy: record.claimedBy === null || record.claimedBy === undefined ? null : String(record.claimedBy),
    claimedAt: record.claimedAt === null || record.claimedAt === undefined ? null : reviveDate(record.claimedAt),
    lastError: record.lastError === null || record.lastError === undefined ? null : String(record.lastError),
    createdAt: reviveDate(record.createdAt),
    updatedAt: reviveDate(record.updatedAt)
  };
}

function reviveStore(raw: Record<string, unknown>): PersistenceStore {
  const store = createEmptyStore();

  const cases = (raw.cases ?? {}) as Record<string, Record<string, unknown>>;
  for (const [caseId, record] of Object.entries(cases)) {
    store.cases[caseId] = reviveCaseRecord(record);
  }

  const eventsByCase = (raw.eventsByCase ?? {}) as Record<string, Record<string, unknown>[]>;
  for (const [caseId, events] of Object.entries(eventsByCase)) {
    store.eventsByCase[caseId] = events.map((event) => reviveStoredEvent(event));
  }

  const currentState = (raw.currentState ?? {}) as Record<PersistenceCurrentStateTableName, Record<string, Record<string, unknown>>>;
  for (const tableName of Object.keys(store.currentState) as PersistenceCurrentStateTableName[]) {
    const table = currentState[tableName] ?? {};
    for (const [id, record] of Object.entries(table)) {
      store.currentState[tableName][id] = reviveCurrentStateRecord(record);
    }
  }

  const projections = (raw.caseListProjection ?? {}) as Record<string, Record<string, unknown>>;
  for (const [caseId, record] of Object.entries(projections)) {
    store.caseListProjection[caseId] = reviveCaseListProjectionRecord(record);
  }

  const checkpoints = (raw.checkpointsByCase ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  for (const [caseId, entries] of Object.entries(checkpoints)) {
    store.checkpointsByCase[caseId] = {};
    for (const [revision, record] of Object.entries(entries)) {
      store.checkpointsByCase[caseId]![revision] = reviveCheckpointRecord(record);
    }
  }

  const dedup = (raw.dedup ?? {}) as Record<string, Record<string, unknown>>;
  for (const [key, record] of Object.entries(dedup)) {
    store.dedup[key] = reviveDedupRecord(record);
  }

  const outbox = (raw.outbox ?? {}) as Record<string, Record<string, unknown>>;
  for (const [key, record] of Object.entries(outbox)) {
    store.outbox[key] = reviveOutboxRecord(record);
  }

  return store;
}

export class LocalPersistenceTransaction {
  constructor(private readonly runtime: LocalPersistenceDatabase, readonly store: PersistenceStore) {}

  transaction() {
    return {
      execute: async <T>(callback: (trx: LocalPersistenceTransaction) => Promise<T>): Promise<T> => callback(this)
    };
  }

  get dataDir(): string {
    return this.runtime.dataDir;
  }
}

export class LocalPersistenceDatabase {
  readonly dataDir: string;
  private readonly storeFilePath: string;
  private readonly lockFilePath: string;
  private readonly hostId: string;
  private writeChain: Promise<void> = Promise.resolve();
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

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.storeFilePath = path.join(dataDir, 'store.json');
    this.lockFilePath = path.join(dataDir, 'store.lock');
    this.hostId = safeHostname();
    mkdirSync(this.dataDir, { recursive: true });
    if (!existsSync(this.storeFilePath)) {
      this.writeStoreSync(createEmptyStore());
    }
  }

  async readStore(): Promise<PersistenceStore> {
    return this.readStoreSync();
  }

  transaction() {
    return {
      execute: async <T>(callback: (trx: LocalPersistenceTransaction) => Promise<T>): Promise<T> => {
        const previous = this.writeChain;
        let release = () => {};
        this.writeChain = new Promise<void>((resolve) => {
          release = resolve;
        });

        await previous;
        const releaseFileLock = await this.acquireFileLock();

        try {
          const draft = structuredClone(this.readStoreSync());
          const transaction = new LocalPersistenceTransaction(this, draft);
          const result = await callback(transaction);
          this.writeStoreSync(draft);
          releaseFileLock();
          release();
          return result;
        } catch (error) {
          releaseFileLock();
          release();
          throw error;
        }
      }
    };
  }

  async destroy(): Promise<void> {
    // Wait for any in-flight write transaction so we don't unlink a lock
    // another caller is actively holding.
    try {
      await this.writeChain;
    } catch {
      // Errors from individual transactions are surfaced to their callers;
      // destroy() should still proceed to release locks.
    }
    for (const release of [...this.heldLockReleasers]) {
      try {
        release();
      } catch {
        // ignore
      }
    }
    process.off('SIGINT', this.signalHandler);
    process.off('SIGTERM', this.signalHandler);
    process.off('exit', this.signalHandler);
    this.signalHandlersInstalled = false;
  }

  private readStoreSync(): PersistenceStore {
    mkdirSync(this.dataDir, { recursive: true });
    if (!existsSync(this.storeFilePath)) {
      this.writeStoreSync(createEmptyStore());
    }
    const raw = JSON.parse(readFileSync(this.storeFilePath, 'utf8')) as Record<string, unknown>;
    return reviveStore(raw);
  }

  private writeStoreSync(store: PersistenceStore): void {
    mkdirSync(this.dataDir, { recursive: true });
    const tempPath = `${this.storeFilePath}.tmp`;
    writeFileSync(tempPath, serializeStore(store), 'utf8');
    renameSync(tempPath, this.storeFilePath);
  }

  private async acquireFileLock(): Promise<() => void> {
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

function safeHostname(): string {
  try {
    const value = hostname();
    return typeof value === 'string' && value.length > 0 ? value : 'unknown-host';
  } catch {
    return 'unknown-host';
  }
}

function isProcessAlive(pid: number): boolean {
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

export type PersistenceDatabaseConnection = LocalPersistenceDatabase;
export type PersistenceTransactionConnection = LocalPersistenceTransaction;
export type PersistenceExecutor = PersistenceDatabaseConnection | PersistenceTransactionConnection;

export function isPersistenceTransaction(executor: PersistenceExecutor): executor is PersistenceTransactionConnection {
  return executor instanceof LocalPersistenceTransaction;
}

export async function readPersistenceStore<T>(
  executor: PersistenceExecutor,
  reader: (store: PersistenceStore) => T | Promise<T>
): Promise<T> {
  const store = isPersistenceTransaction(executor) ? executor.store : await executor.readStore();
  return reader(store);
}

export async function writePersistenceStore<T>(
  executor: PersistenceExecutor,
  writer: (store: PersistenceStore) => T | Promise<T>
): Promise<T> {
  if (isPersistenceTransaction(executor)) {
    return writer(executor.store);
  }

  return executor.transaction().execute(async (trx) => writer(trx.store));
}

export function createPersistenceClient({ dataDir }: CreatePersistenceClientOptions = {}): PersistenceClient {
  const resolvedDataDir = dataDir ?? path.resolve(process.cwd(), '.var/data');
  const db = new LocalPersistenceDatabase(resolvedDataDir);

  return {
    dataDir: resolvedDataDir,
    db,
    async destroy() {
      await db.destroy();
    }
  };
}

export function resetPersistenceDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) {
    return;
  }

  const backupPath = `${dataDir}.backup-${Date.now()}`;
  renameSync(dataDir, backupPath);
  console.info('[persistence] data-dir.moved-for-reset', {
    event: 'persistence.data_dir_moved_for_reset',
    dataDir,
    backupPath
  });
}
