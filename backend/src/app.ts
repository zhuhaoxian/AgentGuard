import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    }
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key'
  });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
