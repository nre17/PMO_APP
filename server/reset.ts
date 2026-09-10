import path from 'node:path';
import { mkdir, rename } from 'node:fs/promises';
import { seedConfiguration } from './seed-config.js';
import { acquireLocalOwnership } from './db.js';

try { process.loadEnvFile(); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
if ((process.env.APP_MODE ?? 'demo') !== 'demo') throw new Error('Reset is only available in local preview mode.');
if (process.env.DATABASE_URL) throw new Error('Reset does not modify an external PostgreSQL database.');
const workspace = path.resolve('.');
const dataDir = path.resolve(seedConfiguration().dataDir);
if (!dataDir.startsWith(`${workspace}${path.sep}`) || dataDir === workspace) throw new Error('Reset requires a data directory strictly inside this workspace.');
const destination = `${dataDir}.backup-${Date.now()}`;
await mkdir(path.dirname(dataDir), { recursive: true });
// Share the startup ownership guard: reject unknown/live owners and keep the
// claim until archiving finishes, so another server cannot open this directory.
const release = await acquireLocalOwnership(dataDir);
try {
  await rename(dataDir, destination);
  console.log(`Local data preserved at ${destination}. Restart the server to seed a fresh workspace.`);
} catch (error: any) {
  if (error.code === 'ENOENT') console.log('No local data directory exists. Starting the server will create it.');
  else throw new Error('Could not archive local data. Stop the server before resetting.', { cause: error });
} finally { await release(); }
