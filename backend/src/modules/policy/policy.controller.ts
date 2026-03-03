import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PolicyService } from './policy.service';
import { ResponseUtil } from '../../common/utils/response.util';

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
    const policy = await policyService.createPolicy(body);
    return ResponseUtil.success(policy, 'Policy created successfully');
  });

  /**
   * 更新策略
   */
  app.put('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const policy = await policyService.updatePolicy(id, body);
    return ResponseUtil.success(policy, 'Policy updated successfully');
  });

  /**
   * 删除策略
   */
  app.delete('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await policyService.deletePolicy(id);
    return ResponseUtil.success(result, 'Policy deleted successfully');
  });

  /**
   * 获取策略详情
   */
  app.get('/policies/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const policy = await policyService.getPolicyById(id);
    if (!policy) {
      return ResponseUtil.error('Policy not found', 404);
    }
    return ResponseUtil.success(policy);
  });

  /**
   * 分页获取策略列表
   */
  app.get('/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    const result = await policyService.getPolicies({
      scope: query.scope,
      agentId: query.agentId,
      type: query.type,
      enabled: query.enabled !== undefined ? parseInt(query.enabled) : undefined,
      page: query.page ? parseInt(query.page) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize) : 20
    });

    return ResponseUtil.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize
    );
  });

  /**
   * 启用/禁用策略
   */
  app.patch('/policies/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };
    const policy = await policyService.togglePolicy(id, enabled);
    return ResponseUtil.success(policy, 'Policy toggled successfully');
  });

  /**
   * 刷新策略缓存
   */
  app.post('/policies/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    policyService.refreshPolicyCache();
    return ResponseUtil.success(null, 'Policy cache refreshed');
  });
}
