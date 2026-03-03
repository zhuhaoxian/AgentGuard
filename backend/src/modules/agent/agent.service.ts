import { PrismaClient } from '@prisma/client';
import { ApiKeyUtil } from '../../common/utils/api-key.util';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { formatDateTime } from '../../common/utils/date.util';
import {
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/business.exception';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AgentResponse,
  AgentListQuery,
} from './agent.types';
import axios, { AxiosError } from 'axios';

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

    // 加密 LLM API Key
    let encryptedLlmApiKey = dto.llmApiKey;
    if (dto.llmApiKey) {
      encryptedLlmApiKey = EncryptionUtil.encryptString(dto.llmApiKey);
    }

    // 创建 Agent
    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        apiKey,
        description: dto.description,
        llmProvider: dto.llmProvider,
        llmApiKey: encryptedLlmApiKey,
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

    // 处理 LLM API Key 更新
    let llmApiKeyToUpdate = dto.llmApiKey;
    if (dto.llmApiKey) {
      // 检查是否为脱敏密钥（包含 "***"）
      if (dto.llmApiKey.includes('***')) {
        // 脱敏密钥，不更新（保持原有密钥）
        llmApiKeyToUpdate = undefined;
      } else {
        // 真实密钥，加密后更新
        llmApiKeyToUpdate = EncryptionUtil.encryptString(dto.llmApiKey);
      }
    }

    // 更新 Agent
    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        name: dto.name,
        description: dto.description,
        llmProvider: dto.llmProvider,
        llmApiKey: llmApiKeyToUpdate,
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
        include: {
          policyBindings: {
            include: {
              policy: true,
            },
          },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      agents: agents.map(agent => this.toAgentResponseWithPolicies(agent)),
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
   * 启用 Agent
   */
  async enableAgent(agentId: string): Promise<AgentResponse> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deleted: 0 },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { status: 1 },
    });

    return this.toAgentResponse(updatedAgent);
  }

  /**
   * 禁用 Agent
   */
  async disableAgent(agentId: string): Promise<AgentResponse> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deleted: 0 },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { status: 0 },
    });

    return this.toAgentResponse(updatedAgent);
  }

  /**
   * 绑定策略到 Agent
   */
  async bindPolicy(agentId: string, policyId: string): Promise<any> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deleted: 0 },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, deleted: 0 },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    const existing = await this.prisma.agentPolicyBinding.findFirst({
      where: { agentId, policyId },
    });

    if (existing) {
      throw new ValidationException('Policy already bound to this agent');
    }

    const binding = await this.prisma.agentPolicyBinding.create({
      data: { agentId, policyId },
    });

    return binding;
  }

  /**
   * 解绑 Agent 的策略
   */
  async unbindPolicy(agentId: string, policyId: string): Promise<void> {
    const binding = await this.prisma.agentPolicyBinding.findFirst({
      where: { agentId, policyId },
    });

    if (!binding) {
      throw new NotFoundException('Policy binding not found');
    }

    await this.prisma.agentPolicyBinding.delete({
      where: { id: binding.id },
    });
  }

  /**
   * 获取 Agent 绑定的策略列表
   */
  async getAgentPolicies(agentId: string): Promise<any[]> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deleted: 0 },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const bindings = await this.prisma.agentPolicyBinding.findMany({
      where: { agentId },
      include: {
        policy: true,
      },
    });

    return bindings.map(b => b.policy).filter(p => p.deleted === 0);
  }

  /**
   * 测试 LLM 连接
   */
  async testLlmConnection(data: {
    agentId?: string;
    llmProvider?: string;
    llmApiKey?: string;
    llmBaseUrl?: string;
    llmModel?: string;
  }): Promise<{ success: boolean; message: string; actualModel?: string }> {
    let llmProvider: string;
    let llmApiKey: string;
    let llmBaseUrl: string;
    let llmModel: string;

    // 如果提供了 agentId，从数据库加载配置
    if (data.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: data.agentId, deleted: 0 },
      });

      if (!agent) {
        return {
          success: false,
          message: 'Agent 不存在',
        };
      }

      // 使用 Agent 的配置作为基础
      llmProvider = data.llmProvider || agent.llmProvider || '';
      llmBaseUrl = data.llmBaseUrl || agent.llmBaseUrl || '';
      llmModel = data.llmModel || agent.llmModel || '';

      // API Key 处理：如果 DTO 中提供了新的密钥，使用新密钥；否则使用数据库中的密钥
      if (data.llmApiKey && !data.llmApiKey.includes('***')) {
        llmApiKey = data.llmApiKey;
      } else {
        // 解密数据库中的密钥
        if (agent.llmApiKey) {
          try {
            llmApiKey = EncryptionUtil.decryptString(agent.llmApiKey);
          } catch (error) {
            return {
              success: false,
              message: 'LLM API Key 解密失败，请重新设置 API Key',
            };
          }
        } else {
          llmApiKey = '';
        }
      }
    } else {
      // 没有提供 agentId，使用 DTO 中的配置
      llmProvider = data.llmProvider || '';
      llmApiKey = data.llmApiKey || '';
      llmBaseUrl = data.llmBaseUrl || '';
      llmModel = data.llmModel || '';

      // 验证必填字段
      if (!llmProvider || !llmApiKey || !llmBaseUrl || !llmModel) {
        return {
          success: false,
          message: '请填写完整的 LLM 配置信息',
        };
      }
    }

    try {
      // 构建 LLM API URL
      const llmUrl = this.buildLlmUrl(llmBaseUrl);

      // 构建测试请求
      const requestBody = {
        model: llmModel,
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 10,
      };

      // 发送请求
      const response = await axios.post(llmUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmApiKey}`,
        },
        timeout: 10000, // 10秒超时
      });

      // 检查响应
      if (response.status >= 200 && response.status < 300) {
        const result: any = {
          success: true,
          message: '连接成功',
        };

        // 尝试解析响应以获取更多信息
        if (response.data && response.data.model) {
          result.actualModel = response.data.model;
        }

        return result;
      } else {
        return {
          success: false,
          message: `连接失败：HTTP ${response.status}`,
        };
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      let errorMessage = '连接失败：未知错误';

      if (axiosError.response) {
        // 服务器返回了错误响应
        const status = axiosError.response.status;
        if (status === 401) {
          errorMessage = 'API 密钥无效或已过期';
        } else if (status === 404) {
          errorMessage = 'API 地址不正确或模型不存在';
        } else {
          errorMessage = `连接失败：HTTP ${status}`;
        }
      } else if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
        errorMessage = '连接超时，请检查网络或 API 地址';
      } else if (axiosError.code === 'ECONNREFUSED') {
        errorMessage = '无法连接到 API 服务器';
      } else if (axiosError.message) {
        errorMessage = `连接失败：${axiosError.message}`;
      }

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * 构建 LLM API URL
   * 规则：
   * - 以 # 结尾：强制使用输入的地址（去掉 #）
   * - 以 / 结尾：忽略 v1 版本，直接拼接 /chat/completions
   * - 其他：默认拼接 /v1/chat/completions
   */
  private buildLlmUrl(baseUrl: string): string {
    if (!baseUrl) {
      throw new ValidationException('LLM Base URL is required');
    }

    if (baseUrl.endsWith('#')) {
      return baseUrl.substring(0, baseUrl.length - 1);
    }

    if (baseUrl.endsWith('/')) {
      return baseUrl + 'chat/completions';
    }

    return baseUrl + '/v1/chat/completions';
  }

  /**
   * 脱敏 API Key
   * 例如：sk-1234567890abcdef -> sk-1234***cdef (前7位+***+后4位)
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length <= 11) {
      return '***';
    }
    const prefix = apiKey.substring(0, 7);
    const suffix = apiKey.substring(apiKey.length - 4);
    return prefix + '***' + suffix;
  }

  /**
   * 转换为 Agent 响应对象
   */
  private toAgentResponse(agent: any): AgentResponse {
    // 解密并脱敏 LLM API Key
    let maskedLlmApiKey = agent.llmApiKey;
    if (agent.llmApiKey) {
      try {
        const decrypted = EncryptionUtil.decryptString(agent.llmApiKey);
        maskedLlmApiKey = this.maskApiKey(decrypted);
      } catch (error) {
        // 如果解密失败，返回脱敏占位符
        maskedLlmApiKey = '***';
      }
    }

    return {
      id: agent.id,
      name: agent.name,
      apiKey: agent.apiKey,
      description: agent.description,
      llmProvider: agent.llmProvider,
      llmApiKey: maskedLlmApiKey,
      llmBaseUrl: agent.llmBaseUrl,
      llmModel: agent.llmModel,
      status: agent.status,
      lastActiveAt: agent.lastActiveAt ? formatDateTime(agent.lastActiveAt) : null,
      createdAt: formatDateTime(agent.createdAt),
      updatedAt: formatDateTime(agent.updatedAt),
    };
  }

  /**
   * 转换为 Agent 响应对象(包含策略)
   */
  private toAgentResponseWithPolicies(agent: any): AgentResponse {
    const response = this.toAgentResponse(agent);
    if (agent.policyBindings) {
      (response as any).policies = agent.policyBindings
        .map((b: any) => b.policy)
        .filter((p: any) => p.deleted === 0);
    }
    return response;
  }
}
