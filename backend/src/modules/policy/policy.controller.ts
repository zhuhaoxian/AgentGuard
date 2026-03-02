import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PolicyService } from './policy.service';

/**
 * 策略控制器
 * 处理策略相关的 HTTP 请求
 */
export async function policyController(app: FastifyInstance, policyService: PolicyService) {
  /**
   * 创建策略
   */
  app.post('/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    try {
      const policy = await policyService.createPolicy(body);
      return reply.code(201).send({
        success: true,
        data: policy
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        message: error.message
      });
    }
  });

  /**
   * 更新策略
   */
  app.put('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const policy = await policyService.updatePolicy(id, body);
      return reply.send({
        success: true,
        data: policy
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        message: error.message
      });
    }
  });

  /**
   * 删除策略
   */
  app.delete('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await policyService.deletePolicy(id);
      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        message: error.message
      });
    }
  });

  /**
   * 获取策略详情
   */
  app.get('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const policy = await policyService.getPolicyById(id);
      if (!policy) {
        return reply.code(404).send({
          success: false,
          message: 'Policy not found'
        });
      }
      return reply.send({
        success: true,
        data: policy
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        message: error.message
      });
    }
  });

  /**
   * 分页获取策略列表
   */
  app.get('/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    try {
      const result = await policyService.getPolicies({
        scope: query.scope,
        agentId: query.agentId,
        type: query.type,
        enabled: query.enabled !== undefined ? parseInt(query.enabled) : undefined,
        page: query.page ? parseInt(query.page) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize) : 20
      });
      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        message: error.message
      });
    }
  });

  /**
   * 启用/禁用策略
   */
  app.patch('/policies/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };

    try {
      const policy = await policyService.togglePolicy(id, enabled);
      return reply.send({
        success: true,
        data: policy
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        message: error.message
      });
    }
  });

  /**
   * 刷新策略缓存
   */
  app.post('/policies/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      policyService.refreshPolicyCache();
      return reply.send({
        success: true,
        message: 'Policy cache refreshed'
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        message: error.message
      });
    }
  });
}
