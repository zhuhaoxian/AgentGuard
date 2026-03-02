import { PrismaClient } from '@prisma/client';
import { PolicyEngine } from './policy-engine';
import { PageResult, createPageResult } from '../../common/types/pagination.types';

/**
 * 策略服务
 * 负责策略的 CRUD 操作
 */
export class PolicyService {
  private prisma: PrismaClient;
  private policyEngine: PolicyEngine;

  constructor(prisma: PrismaClient, policyEngine: PolicyEngine) {
    this.prisma = prisma;
    this.policyEngine = policyEngine;
  }

  /**
   * 创建策略
   */
  async createPolicy(data: {
    name: string;
    description?: string;
    type: string;
    conditions?: any;
    action: string;
    priority?: number;
    scope?: string;
    agentId?: string;
    requestType?: string;
    tags?: string;
  }) {
    const policy = await this.prisma.policy.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        conditions: data.conditions,
        action: data.action,
        priority: data.priority || 0,
        scope: data.scope || 'GLOBAL',
        agentId: data.agentId,
        requestType: data.requestType || 'ALL',
        tags: data.tags,
        enabled: 1,
        deleted: 0
      }
    });

    // 刷新策略缓存
    this.policyEngine.clearCache(data.agentId);

    return policy;
  }

  /**
   * 更新策略
   */
  async updatePolicy(id: string, data: {
    name?: string;
    description?: string;
    type?: string;
    conditions?: any;
    action?: string;
    priority?: number;
    scope?: string;
    agentId?: string;
    requestType?: string;
    tags?: string;
    enabled?: number;
  }) {
    const policy = await this.prisma.policy.update({
      where: { id },
      data
    });

    // 刷新策略缓存
    this.policyEngine.clearCache(data.agentId);

    return policy;
  }

  /**
   * 删除策略（软删除）
   */
  async deletePolicy(id: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id }
    });

    if (!policy) {
      throw new Error('Policy not found');
    }

    await this.prisma.policy.update({
      where: { id },
      data: { deleted: 1 }
    });

    // 刷新策略缓存
    this.policyEngine.clearCache(policy.agentId || undefined);

    return { success: true };
  }

  /**
   * 获取策略详情
   */
  async getPolicyById(id: string) {
    return await this.prisma.policy.findUnique({
      where: { id, deleted: 0 }
    });
  }

  /**
   * 分页获取策略列表
   */
  async getPolicies(params: {
    scope?: string;
    agentId?: string;
    type?: string;
    enabled?: number;
    page?: number;
    pageSize?: number;
  }): Promise<PageResult<any>> {
    const { scope, agentId, type, enabled, page = 1, pageSize = 20 } = params;

    const where: any = { deleted: 0 };

    if (scope) {
      where.scope = scope;
    }
    if (agentId) {
      where.agentId = agentId;
    }
    if (type) {
      where.type = type;
    }
    if (enabled !== undefined) {
      where.enabled = enabled;
    }

    const [total, items] = await Promise.all([
      this.prisma.policy.count({ where }),
      this.prisma.policy.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return createPageResult(items, total, page, pageSize);
  }

  /**
   * 获取所有启用的策略
   */
  async getEnabledPolicies() {
    return await this.prisma.policy.findMany({
      where: {
        enabled: 1,
        deleted: 0
      },
      orderBy: {
        priority: 'desc'
      }
    });
  }

  /**
   * 启用/禁用策略
   */
  async togglePolicy(id: string, enabled: boolean) {
    const policy = await this.prisma.policy.update({
      where: { id },
      data: { enabled: enabled ? 1 : 0 }
    });

    // 刷新策略缓存
    this.policyEngine.clearCache(policy.agentId || undefined);

    return policy;
  }

  /**
   * 刷新策略缓存
   */
  refreshPolicyCache() {
    this.policyEngine.clearCache();
  }
}
