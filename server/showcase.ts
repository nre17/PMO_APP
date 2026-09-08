// A separate local demonstration can run alongside the reviewed project.
// Process-local overrides keep an existing .env project or database untouched.
export {};
try { process.loadEnvFile(); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
Object.assign(process.env, {
  APP_MODE: 'demo', HOST: '127.0.0.1', PORT: '4311',
  SEED_PROFILE: 'showcase', DATA_DIR: '.data/showcase', DATABASE_URL: '',
});
await import('./index.js');
