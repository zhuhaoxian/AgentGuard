import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 扩展 FastifyRequest 类型，添加 agent 属性
declare module 'fastify' {
  interface FastifyRequest {
    agent?: {
      id: string;
      name: string;
      apiKey: string;
      llmProvider: string | null;
      llmApiKey: string | null;
      llmBaseUrl: string | null;
      llmModel: string | null;
      status: number;
    };
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers['x-agentguard-auth'] as string;

  if (!authHeader) {
    return reply.status(401).send({
      error: {
        message: 'Missing X-AgentGuard-Auth header',
        type: 'authentication_error',
        code: 'missing_auth_header'
      }
    });
  }

  try {
    // 从数据库查询 Agent
    const agent = await prisma.agent.findUnique({
      where: { apiKey: authHeader, deleted: 0 }
    });

    if (!agent) {
      return reply.status(401).send({
        error: {
          message: 'Invalid API key',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
    }

    if (agent.status !== 1) {
      return reply.status(403).send({
        error: {
          message: 'Agent is disabled',
          type: 'authentication_error',
          code: 'agent_disabled'
        }
      });
    }

    // 更新最后活跃时间
    await prisma.agent.update({
      where: { id: agent.id },
      data: { lastActiveAt: new Date() }
    });

    // 将 agent 信息附加到 request 对象
    request.agent = {
      id: agent.id,
      name: agent.name,
      apiKey: agent.apiKey,
      llmProvider: agent.llmProvider,
      llmApiKey: agent.llmApiKey,
      llmBaseUrl: agent.llmBaseUrl,
      llmModel: agent.llmModel,
      status: agent.status
    };
  } catch (error) {
    request.log.error(error, 'Auth middleware error');
    return reply.status(500).send({
      error: {
        message: 'Internal server error',
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
}
