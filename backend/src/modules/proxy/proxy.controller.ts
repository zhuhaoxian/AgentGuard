import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProxyService } from './proxy.service';
import { authMiddleware } from '@common/middleware/auth.middleware';
import { policyMiddleware } from '@common/middleware/policy.middleware';
import { EncryptionUtil } from '@common/utils/encryption.util';
import type { ChatCompletionRequest, ModelsResponse } from './proxy.types';

const proxyService = new ProxyService();

export async function proxyRoutes(app: FastifyInstance) {
  // 注册认证中间件
  app.addHook('preHandler', authMiddleware);

  // 注册策略评估中间件（在认证之后）
  app.addHook('preHandler', policyMiddleware);

  /**
   * POST /v1/chat/completions
   * 聊天补全接口
   */
  app.post<{ Body: ChatCompletionRequest }>(
    '/v1/chat/completions',
    async (request: FastifyRequest<{ Body: ChatCompletionRequest }>, reply: FastifyReply) => {
      const agent = request.agent!;
      const requestBody = request.body;

      // 验证必填字段
      if (!requestBody.model || !requestBody.messages) {
        return reply.status(400).send({
          error: {
            message: 'Missing required fields: model and messages',
            type: 'invalid_request_error',
            code: 'missing_required_fields'
          }
        });
      }

      // 检查 Agent 是否配置了 LLM
      if (!agent.llmApiKey || !agent.llmBaseUrl) {
        return reply.status(400).send({
          error: {
            message: 'Agent LLM configuration is incomplete',
            type: 'configuration_error',
            code: 'missing_llm_config'
          }
        });
      }

      // 解密 API Key（参考旧代码：ProxyServiceImpl.java 中使用 encryptionUtil.decrypt）
      const decryptedApiKey = EncryptionUtil.decryptString(agent.llmApiKey);

      // 转发请求
      return await proxyService.forwardChatCompletion(
        agent.id,
        decryptedApiKey,
        agent.llmBaseUrl,
        requestBody,
        reply,
        request  // 传递 request 以获取策略信息
      );
    }
  );

  /**
   * GET /v1/models
   * 获取可用模型列表
   */
  app.get('/v1/models', async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = request.agent!;

    // 返回简单的模型列表（可以从 Agent 配置中获取）
    const response: ModelsResponse = {
      object: 'list',
      data: [
        {
          id: agent.llmModel || 'gpt-3.5-turbo',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'agentguard'
        }
      ]
    };

    return reply.status(200).send(response);
  });
}
