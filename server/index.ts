import path from 'node:path';
import { createApp } from './app.js';

try { process.loadEnvFile(); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
const host = process.env.HOST ?? '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('The local preview can only bind to localhost. Corporate identity is required before shared hosting.');
const app = await createApp({ logger: true });
let vite: import('vite').ViteDevServer | undefined;
if (process.argv.includes('--production')) {
  const staticPlugin = await import('@fastify/static');
  await app.register(staticPlugin.default, { root: path.resolve('dist/client'), wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'Endpoint not found.' });
    return reply.sendFile('index.html');
  });
} else {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'Endpoint not found.' });
    reply.hijack();
    vite!.middlewares(request.raw, reply.raw, () => { reply.raw.statusCode = 404; reply.raw.end('Not found'); });
  });
}
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await vite?.close(); await app.close(); }
process.on('SIGINT', () => { void stop().then(() => process.exit(0)); });
process.on('SIGTERM', () => { void stop().then(() => process.exit(0)); });
await app.listen({ host, port: Number(process.env.PORT ?? 4310) });
