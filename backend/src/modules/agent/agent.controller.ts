import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/utils/prisma.util';
import { AgentService } from './agent.service';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentListQuery,
} from './agent.types';

const agentService = new AgentService(prisma);

export async function agentRoutes(app: FastifyInstance) {
  // 创建 Agent
  app.post<{ Body: CreateAgentDto }>('/agents', async (request, reply) => {
    const agent = await agentService.createAgent(request.body);
    return ResponseUtil.success(agent, 'Agent created successfully');
  });

  // 获取 Agent 列表
  app.get<{ Querystring: AgentListQuery }>('/agents', async (request, reply) => {
    const query: AgentListQuery = {
      page: request.query.page ? parseInt(request.query.page as any) : 1,
      pageSize: request.query.pageSize ? parseInt(request.query.pageSize as any) : 20,
      status: request.query.status !== undefined ? parseInt(request.query.status as any) : undefined,
      keyword: request.query.keyword as string,
    };

    const { agents, total } = await agentService.getAgents(query);

    return ResponseUtil.paginated(agents, total, query.page!, query.pageSize!);
  });

  // 获取 Agent 详情
  app.get<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const agent = await agentService.getAgentById(request.params.id);
    return ResponseUtil.success(agent);
  });

  // 更新 Agent
  app.put<{ Params: { id: string }; Body: UpdateAgentDto }>(
    '/agents/:id',
    async (request, reply) => {
      const agent = await agentService.updateAgent(request.params.id, request.body);
      return ResponseUtil.success(agent, 'Agent updated successfully');
    }
  );

  // 删除 Agent
  app.delete<{ Params: { id: string } }>(
    '/agents/:id',
    async (request, reply) => {
      await agentService.deleteAgent(request.params.id);
      return ResponseUtil.success(null, 'Agent deleted successfully');
    }
  );

  // 重新生成 API Key
  app.post<{ Params: { id: string } }>(
    '/agents/:id/regenerate-key',
    async (request, reply) => {
      const agent = await agentService.regenerateApiKey(request.params.id);
      return ResponseUtil.success(agent, 'API Key regenerated successfully');
    }
  );

  // 验证 API Key
  app.get<{ Headers: { authorization?: string } }>(
    '/agents/verify',
    async (request, reply) => {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return ResponseUtil.error('Missing authorization header', 401);
      }

      const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
      const agent = await agentService.getAgentByApiKey(apiKey);

      if (!agent) {
        return ResponseUtil.error('Invalid API Key', 401);
      }

      if (agent.status !== 1) {
        return ResponseUtil.error('Agent is disabled', 403);
      }

      return ResponseUtil.success(agent);
    }
  );
}
