import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApiProxyService } from './api-proxy.service';
import { authMiddleware } from '@common/middleware/auth.middleware';
import { policyMiddleware } from '@common/middleware/policy.middleware';
import type { ApiProxyRequest } from './api-proxy.types';

const apiProxyService = new ApiProxyService();

export async function apiProxyRoutes(app: FastifyInstance) {
  // 注册认证中间件和策略评估中间件
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', policyMiddleware);

  /**
   * POST /api/proxy
   * 通用 API 代理接口
   */
  app.post<{ Body: ApiProxyRequest }>(
    '/api/proxy',
    async (request: FastifyRequest<{ Body: ApiProxyRequest }>, reply: FastifyReply) => {
      const agent = request.agent!;
      const proxyRequest = request.body;

      // 验证必填字段
      if (!proxyRequest.url || !proxyRequest.method) {
        return reply.status(400).send({
          error: {
            message: 'Missing required fields: url and method',
            type: 'invalid_request_error',
            code: 'missing_required_fields'
          }
        });
      }

      // 转发请求
      return await apiProxyService.forwardApiRequest(
        agent.id,
        proxyRequest,
        reply,
        request
      );
    }
  );
}
