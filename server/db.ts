import { PGlite } from '@electric-sql/pglite';
import { drizzle as pgliteDrizzle } from 'drizzle-orm/pglite';
import { drizzle as postgresDrizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, jsonb, integer, primaryKey } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';
import pg from 'pg';
import path from 'node:path';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { HubState } from '../shared/types.js';
import { seedConfiguration } from './seed-config.js';

// A versioned document table preserves the domain's typed entity boundaries. All
// cross-record invariants and audit writes commit in the same database transaction.
export const entities = pgTable('hub_entities', {
  collection: text('collection').notNull(), id: text('id').notNull(),
  data: jsonb('data').notNull(), version: integer('version').notNull().default(1),
}, t => [primaryKey({ columns: [t.collection, t.id] })]);
type Executor = { execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }> };
type Database = Executor & { transaction<T>(callback: (tx: Executor) => Promise<T>): Promise<T> };
const collections = ['members', 'workstreams', 'deliverables', 'milestones', 'items', 'tests', 'registers', 'meetings', 'submissions', 'reports', 'events', 'sourceDocuments', 'sourceRecords'] as const;

type LockOwner = { pid: number; token: string };
async function ownerOf(lockPath: string): Promise<LockOwner | undefined> {
  let content: string;
  try { content = await readFile(lockPath, 'utf8'); }
  catch (error: any) { if (error.code === 'ENOENT') return undefined; throw error; }
  try {
    const owner = JSON.parse(content);
    if (!Number.isInteger(owner.pid) || owner.pid <= 0 || owner.pid > 2147483647 || typeof owner.token !== 'string' || !owner.token) throw new Error('Invalid owner');
    return owner;
  } catch { throw new Error(`Database lock ownership is unknown (${lockPath}). The lock and database were left untouched.`); }
}
function confirmedDead(owner: LockOwner) {
  try { process.kill(owner.pid, 0); return false; }
  catch (error: any) { return error.code === 'ESRCH'; } // Permission errors and reused PIDs are not proof of death.
}
async function claimFile(lockPath: string) {
  const owner = { pid: process.pid, token: randomUUID() };
  const handle = await open(lockPath, 'wx');
  try { await handle.writeFile(JSON.stringify(owner)); }
  finally { await handle.close(); }
  return async () => { const held = await ownerOf(lockPath); if (held?.token === owner.token) await unlink(lockPath); };
}
export async function acquireLocalOwnership(dataDir: string): Promise<() => Promise<void>> {
  const lockPath = `${dataDir}.pmo-lock`;
  try { return await claimFile(lockPath); }
  catch (error: any) { if (error.code !== 'EEXIST') throw error; }
  const previous = await ownerOf(lockPath);
  if (previous && !confirmedDead(previous)) throw new Error(`This demo database already has an owner (${lockPath}). Stop the other server before opening it again.`);

  // Serialize ONLY stale-lock reclamation. A normal startup can win the brief
  // unlink/create race, but our exclusive create then fails; it is never stolen.
  // Contenders re-read ownership inside this guard, so none can act on an old PID
  // observation after another process has claimed the database.
  const recoveryPath = `${lockPath}.recovery`;
  let releaseRecovery: () => Promise<void>;
  try { releaseRecovery = await claimFile(recoveryPath); }
  catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Database ownership recovery is already in progress (${recoveryPath}). Retry after the other startup finishes. The database was not changed.`);
  }
  try {
    const current = await ownerOf(lockPath);
    if (current) {
      if (!confirmedDead(current)) throw new Error(`This demo database already has an owner (${lockPath}). Stop the other server before opening it again.`);
      await unlink(lockPath);
    }
    try { return await claimFile(lockPath); }
    catch (error: any) {
      if (error.code !== 'EEXIST') throw error;
      throw new Error(`This demo database already has an owner (${lockPath}). Another startup claimed it; the database was left untouched.`);
    }
  } finally { await releaseRecovery(); }
}

function documents(state: HubState) {
  return [ { collection: 'settings', id: 'project', data: state.settings },
    ...collections.flatMap(collection => (state[collection] ?? []).map(data => ({ collection, id: data.id, data }))) ];
}
function reconstruct(rows: Record<string, unknown>[]): HubState {
  const state: Record<string, unknown> = {};
  for (const key of collections) state[key] = [];
  for (const row of rows) {
    if (row.collection === 'settings') state.settings = row.data;
    else (state[String(row.collection)] as unknown[]).push(row.data);
  }
  return state as unknown as HubState;
}

export class Store {
  private tail: Promise<unknown> = Promise.resolve();
  private constructor(private database: Database, private shutdown: () => Promise<void>) {}

  static async open(options: { dataDir?: string; databaseUrl?: string; initialState: HubState }) {
    let store: Store;
    if (options.databaseUrl) {
      const pool = new pg.Pool({ connectionString: options.databaseUrl, max: 5 });
      store = new Store(postgresDrizzle(pool) as unknown as Database, () => pool.end());
    } else {
      const dataDir = path.resolve(options.dataDir ?? seedConfiguration().dataDir);
      await mkdir(path.dirname(dataDir), { recursive: true });
      const release = await acquireLocalOwnership(dataDir);
      let client: PGlite;
      try { client = new PGlite(dataDir); await client.waitReady; }
      catch (error) { await release(); throw error; }
      store = new Store(pgliteDrizzle(client) as unknown as Database, async () => { try { await client.close(); } finally { await release(); } });
    }
    try {
      await store.database.execute(sql`CREATE TABLE IF NOT EXISTS hub_control (id integer PRIMARY KEY, schema_version integer NOT NULL)`);
      await store.database.execute(sql`INSERT INTO hub_control (id, schema_version) VALUES (1, 1) ON CONFLICT (id) DO NOTHING`);
      await store.database.execute(sql`CREATE TABLE IF NOT EXISTS hub_entities (collection text NOT NULL, id text NOT NULL, data jsonb NOT NULL, version integer NOT NULL DEFAULT 1, PRIMARY KEY(collection, id))`);
      await store.transaction(async (_state, tx) => {
        const existing = await tx.execute(sql`SELECT id FROM hub_entities LIMIT 1`);
        if (!existing.rows.length) await store.persist(tx, options.initialState);
      }, false);
      return store;
    } catch (error) { await store.shutdown(); throw error; }
  }

  private async persist(tx: Executor, state: HubState, before?: HubState) {
    const old = new Map(before ? documents(before).map(d => [`${d.collection}:${d.id}`, JSON.stringify(d.data)]) : []);
    for (const entry of documents(state)) {
      const serialized = JSON.stringify(entry.data);
      if (old.get(`${entry.collection}:${entry.id}`) === serialized) continue;
      const version = 'version' in entry.data ? Number(entry.data.version) : 1;
      await tx.execute(sql`INSERT INTO hub_entities (collection,id,data,version) VALUES (${entry.collection},${entry.id},${serialized}::jsonb,${version}) ON CONFLICT (collection,id) DO UPDATE SET data=EXCLUDED.data, version=EXCLUDED.version`);
    }
  }

  private transaction<T>(fn: (state: HubState, tx: Executor) => Promise<T> | T, save = true): Promise<T> {
    const run = async () => this.database.transaction(async tx => {
      // PostgreSQL also protects against concurrent app instances. PGlite gets
      // the process-local queue so its single connection cannot interleave txs.
      await tx.execute(sql`SELECT id FROM hub_control WHERE id=1 FOR UPDATE`);
      const result = await tx.execute(sql`SELECT collection,id,data FROM hub_entities ORDER BY collection,id`);
      const before = reconstruct(result.rows);
      const state = structuredClone(before);
      const value = await fn(state, tx);
      if (save) await this.persist(tx, state, before);
      return value;
    });
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  read() { return this.transaction(state => state, false); }
  mutate<T>(fn: (state: HubState) => Promise<T> | T) { return this.transaction(fn); }
  async close() { await this.tail; await this.shutdown(); }
}
