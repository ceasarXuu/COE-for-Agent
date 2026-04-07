import type { Kysely, Transaction } from 'kysely';

import type { PersistenceDatabase } from '@coe/persistence';

export interface InvestigationServerServices {
  db: Kysely<PersistenceDatabase>;
}

export type InvestigationServerTransaction = Transaction<PersistenceDatabase>;