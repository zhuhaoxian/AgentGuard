import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { proxyRoutes } from './modules/proxy';
import { apiProxyRoutes } from './modules/api-proxy';

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

  // 健康检查
  app.get('/health', async () => ({ status: 'ok' }));

  // 注册 LLM Proxy 路由
  await app.register(proxyRoutes);

  // 注册 API Proxy 路由
  await app.register(apiProxyRoutes);

  return app;
}
