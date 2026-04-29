import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { FileLockManager, safeHostname } from './lock.js';
import { createEmptyStore, reviveStore, serializeStore } from './store-codec.js';
import { LocalPersistenceTransaction } from './transaction.js';
import type { PersistenceStore } from './types.js';

export class LocalPersistenceDatabase {
  readonly dataDir: string;
  private readonly storeFilePath: string;
  private readonly lockManager: FileLockManager;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.storeFilePath = path.join(dataDir, 'store.json');
    const lockFilePath = path.join(dataDir, 'store.lock');
    this.lockManager = new FileLockManager({
      dataDir,
      lockFilePath,
      hostId: safeHostname()
    });
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
        const releaseFileLock = await this.lockManager.acquire();

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
    this.lockManager.releaseAllHeld();
    this.lockManager.uninstallSignalHandlers();
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
}
