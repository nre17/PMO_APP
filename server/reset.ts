import path from 'node:path';
import { rename, readFile, unlink } from 'node:fs/promises';

try { process.loadEnvFile(); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
if ((process.env.APP_MODE ?? 'demo') !== 'demo') throw new Error('Reset is only available in synthetic demo mode.');
if (process.env.DATABASE_URL) throw new Error('Reset does not modify an external PostgreSQL database.');
const workspace = path.resolve('.');
const dataDir = path.resolve(process.env.DATA_DIR ?? '.data/pmo');
if (!dataDir.startsWith(`${workspace}${path.sep}`) || dataDir === workspace) throw new Error('Reset requires a data directory strictly inside this workspace.');
const destination = `${dataDir}.backup-${Date.now()}`;
try {
  const lock = JSON.parse(await readFile(`${dataDir}.pmo-lock`, 'utf8'));
  if (Number.isInteger(lock.pid)) {
    let running = true;
    try { process.kill(lock.pid, 0); } catch (error: any) { if (error.code === 'ESRCH') running = false; }
    if (running) throw new Error('Stop the running demo server before resetting its data.');
  }
} catch (error: any) { if (error.code !== 'ENOENT') throw error; }
try {
  await rename(dataDir, destination);
  try { await unlink(`${dataDir}.pmo-lock`); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  console.log(`Demo data preserved at ${destination}. Restart the server to seed a fresh workspace.`);
} catch (error: any) {
  if (error.code === 'ENOENT') console.log('No demo data directory exists. Starting the server will create it.');
  else throw new Error('Could not archive demo data. Stop the server before resetting.', { cause: error });
}
