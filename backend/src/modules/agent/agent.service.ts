import { PrismaClient } from '@prisma/client';
import { ApiKeyUtil } from '../../common/utils/api-key.util';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/business.exception';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentResponse,
  AgentListQuery,
} from './agent.types';

export class AgentService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 创建 Agent
   */
  async createAgent(dto: CreateAgentDto): Promise<AgentResponse> {
    // 生成唯一的 API Key
    let apiKey = ApiKeyUtil.generateApiKey();

    // 确保 API Key 唯一
    let existingAgent = await this.prisma.agent.findUnique({
      where: { apiKey },
    });

    while (existingAgent) {
      apiKey = ApiKeyUtil.generateApiKey();
      existingAgent = await this.prisma.agent.findUnique({
        where: { apiKey },
      });
    }

    // 创建 Agent
    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        apiKey,
        description: dto.description,
        llmProvider: dto.llmProvider,
        llmApiKey: dto.llmApiKey,
        llmBaseUrl: dto.llmBaseUrl,
        llmModel: dto.llmModel,
      },
    });

    return this.toAgentResponse(agent);
  }

  /**
   * 更新 Agent
   */
  async updateAgent(agentId: string, dto: UpdateAgentDto): Promise<AgentResponse> {
    // 检查 Agent 是否存在
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deleted: 0 },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // 更新 Agent
    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        name: dto.name,
        description: dto.description,
        llmProvider: dto.llmProvider,
        llmApiKey: dto.llmApiKey,
        llmBaseUrl: dto.llmBaseUrl,
        llmModel: dto.llmModel,
        status: dto.status,
      },
    });

    return this.toAgentResponse(updatedAgent);
  }

  /**
   * 删除 Agent(软删除)
   */
  async deleteAgent(agentId: string): Promise<void> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deleted: 0 },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { deleted: 1 },
    });
  }

  /**
   * 获取 Agent 列表
   */
  async getAgents(
    query: AgentListQuery
  ): Promise<{ agents: AgentResponse[]; total: number }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { deleted: 0 };

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { description: { contains: query.keyword } },
      ];
    }

    const [agents, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      agents: agents.map(agent => this.toAgentResponse(agent)),
      total,
    };
  }

  /**
   * 获取 Agent 详情
   */
  async getAgentById(agentId: string): Promise<AgentResponse> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deleted: 0 },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.toAgentResponse(agent);
  }

  /**
   * 通过 API Key 获取 Agent
   */
  async getAgentByApiKey(apiKey: string): Promise<AgentResponse | null> {
    const agent = await this.prisma.agent.findFirst({
      where: { apiKey, deleted: 0 },
    });

    if (!agent) {
      return null;
    }

    return this.toAgentResponse(agent);
  }

  /**
   * 重新生成 API Key
   */
  async regenerateApiKey(agentId: string): Promise<AgentResponse> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deleted: 0 },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // 生成新的 API Key
    let newApiKey = ApiKeyUtil.generateApiKey();

    let existingAgent = await this.prisma.agent.findUnique({
      where: { apiKey: newApiKey },
    });

    while (existingAgent) {
      newApiKey = ApiKeyUtil.generateApiKey();
      existingAgent = await this.prisma.agent.findUnique({
        where: { apiKey: newApiKey },
      });
    }

    // 更新 API Key
    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { apiKey: newApiKey },
    });

    return this.toAgentResponse(updatedAgent);
  }

  /**
   * 更新最后活跃时间
   */
  async updateLastActiveAt(agentId: string): Promise<void> {
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * 转换为 Agent 响应对象
   */
  private toAgentResponse(agent: any): AgentResponse {
    return {
      id: agent.id,
      name: agent.name,
      apiKey: agent.apiKey,
      description: agent.description,
      llmProvider: agent.llmProvider,
      llmBaseUrl: agent.llmBaseUrl,
      llmModel: agent.llmModel,
      status: agent.status,
      lastActiveAt: agent.lastActiveAt,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }
}
