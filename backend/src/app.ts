import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { proxyRoutes } from './modules/proxy';
import { apiProxyRoutes } from './modules/api-proxy';
import { policyRoutes } from './modules/policy';
import { userRoutes } from './modules/user';
import { agentRoutes } from './modules/agent';
import { settingsRoutes } from './modules/settings';
import { approvalRoutes } from './modules/approval';
import { statsRoutes } from './modules/stats';
import { alertRoutes } from './modules/alert';
import { errorMiddleware } from './common/middleware/error.middleware';
import { jwtAuthMiddleware } from './common/middleware/jwt-auth.middleware';
import { createLoggerConfig } from './common/utils/logger.util';

export async function buildApp() {
  const app = Fastify({
    logger: createLoggerConfig()
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key'
  });

  // 注册全局错误处理中间件
  app.setErrorHandler(errorMiddleware);

  // 注册 JWT 认证中间件(全局)
  app.addHook('onRequest', jwtAuthMiddleware);

  // 健康检查
  app.get('/health', async () => ({ status: 'ok' }));

  // 注册 LLM Proxy 路由
  await app.register(proxyRoutes);

  // 注册 API Proxy 路由
  await app.register(apiProxyRoutes);

  // 注册 Policy 路由
  await app.register(policyRoutes, { prefix: '/api/v1' });

  // 注册 User 路由
  await app.register(userRoutes, { prefix: '/api/v1' });

  // 注册 Agent 路由
  await app.register(agentRoutes, { prefix: '/api/v1' });

  // 注册 Settings 路由
  await app.register(settingsRoutes, { prefix: '/api/v1' });

  // 注册 Approval 路由
  await app.register(approvalRoutes, { prefix: '/api/v1' });

  // 注册 Stats 路由
  await app.register(statsRoutes, { prefix: '/api/v1' });

  // 注册 Alert 路由
  await app.register(alertRoutes, { prefix: '/api/v1' });

  return app;
}
