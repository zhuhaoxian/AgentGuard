import { PrismaClient } from '@prisma/client';
import { ConditionEvaluator } from './condition-evaluator';
import { RateLimiter } from './rate-limiter';
import {
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  PolicyConditions,
  RateLimitConfig
} from './policy.types';

/**
 * 策略评估引擎
 * 负责评估请求是否符合策略规则
 */
export class PolicyEngine {
  private prisma: PrismaClient;
  private conditionEvaluator: ConditionEvaluator;
  private rateLimiter: RateLimiter;
  private policyCache: Map<string, any[]> = new Map();
  private cacheExpiry: number = 60000; // 缓存 1 分钟

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.conditionEvaluator = new ConditionEvaluator();
    this.rateLimiter = new RateLimiter();
  }

  /**
   * 评估请求是否允许
   */
  async evaluate(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    // 获取适用的策略列表
    const policies = await this.getApplicablePolicies(context.agentId);

    // 按优先级排序（优先级高的先评估）
    policies.sort((a, b) => b.priority - a.priority);

    // 逐个评估策略
    for (const policy of policies) {
      if (!policy.enabled) {
        continue;
      }

      // 检查请求类型是否匹配
      if (policy.requestType !== 'ALL' && policy.requestType !== context.requestType) {
        continue;
      }

      // 评估策略条件
      const matched = await this.evaluatePolicy(policy, context);

      if (matched) {
        // 找到匹配的策略
        return this.handlePolicyAction(policy, context);
      }
    }

    // 没有匹配的策略，默认允许
    return {
      allowed: true,
      action: 'ALLOW',
      reason: 'No matching policy, default allow'
    };
  }

  /**
   * 评估单个策略是否匹配
   */
  private async evaluatePolicy(policy: any, context: PolicyEvaluationContext): Promise<boolean> {
    if (!policy.conditions) {
      return true;
    }

    const conditions = policy.conditions as PolicyConditions;

    // 评估 URL 模式
    if (conditions.urlPattern && context.url) {
      if (!this.conditionEvaluator.matchUrlPattern(context.url, conditions.urlPattern)) {
        return false;
      }
    }

    // 评估 HTTP 方法
    if (conditions.method && context.method) {
      if (!this.conditionEvaluator.matchMethod(context.method, conditions.method)) {
        return false;
      }
    }

    // 评估请求头条件
    if (conditions.headers && context.headers) {
      for (const [key, value] of Object.entries(conditions.headers)) {
        if (context.headers[key] !== value) {
          return false;
        }
      }
    }

    // 评估请求体条件
    if (conditions.body && context.body) {
      const logic = conditions.logic || 'AND';
      if (!this.conditionEvaluator.evaluateConditions(context.body, conditions.body, logic)) {
        return false;
      }
    }

    // 评估通用条件
    if (conditions.conditions) {
      const logic = conditions.logic || 'AND';
      const data = {
        ...context,
        headers: context.headers,
        body: context.body
      };
      if (!this.conditionEvaluator.evaluateConditions(data, conditions.conditions, logic)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 处理策略动作
   */
  private async handlePolicyAction(
    policy: any,
    context: PolicyEvaluationContext
  ): Promise<PolicyEvaluationResult> {
    const action = policy.action as 'ALLOW' | 'DENY' | 'APPROVAL' | 'RATE_LIMIT';

    switch (action) {
      case 'ALLOW':
        return {
          allowed: true,
          matchedPolicy: policy,
          action: 'ALLOW',
          reason: `Matched policy: ${policy.name}`
        };

      case 'DENY':
        return {
          allowed: false,
          matchedPolicy: policy,
          action: 'DENY',
          reason: `Denied by policy: ${policy.name}`
        };

      case 'APPROVAL':
        return {
          allowed: false,
          matchedPolicy: policy,
          action: 'APPROVAL',
          requiresApproval: true,
          reason: `Requires approval by policy: ${policy.name}`
        };

      case 'RATE_LIMIT':
        return this.handleRateLimit(policy, context);

      default:
        return {
          allowed: true,
          action: 'ALLOW',
          reason: 'Unknown action, default allow'
        };
    }
  }

  /**
   * 处理限流策略（参考旧代码：PolicyEngineImpl.java）
   */
  private handleRateLimit(
    policy: any,
    context: PolicyEvaluationContext
  ): PolicyEvaluationResult {
    // 从策略条件中提取限流配置
    const conditions = policy.conditions as any;
    const rateLimitConfig: RateLimitConfig = {
      maxRequests: conditions.maxRequests || 100,
      windowMs: conditions.windowMs || 60000, // 默认 1 分钟
      keyExtractor: conditions.keyExtractor,
      fallbackAction: conditions.fallbackAction
    };

    // 使用 RateLimiter 的动态键提取方法（参考旧代码：RateLimiterServiceImpl.java:115-157）
    const key = this.rateLimiter.generateRateLimitKey(context, rateLimitConfig.keyExtractor);

    // 检查限流
    const result = this.rateLimiter.check(key, rateLimitConfig);

    if (result.allowed) {
      return {
        allowed: true,
        matchedPolicy: policy,
        action: 'RATE_LIMIT',
        reason: `Rate limit passed: ${result.remaining} remaining`
      };
    } else {
      // 如果配置了降级策略，返回降级响应
      if (rateLimitConfig.fallbackAction) {
        return {
          allowed: false,
          matchedPolicy: policy,
          action: 'RATE_LIMIT',
          rateLimitExceeded: true,
          reason: `Rate limit exceeded. Fallback action: ${rateLimitConfig.fallbackAction}. Reset at ${new Date(result.resetTime).toISOString()}`
        };
      }

      return {
        allowed: false,
        matchedPolicy: policy,
        action: 'RATE_LIMIT',
        rateLimitExceeded: true,
        reason: `Rate limit exceeded. Reset at ${new Date(result.resetTime).toISOString()}`
      };
    }
  }

  /**
   * 获取适用的策略列表（带缓存）
   */
  private async getApplicablePolicies(agentId: string): Promise<any[]> {
    const cacheKey = `policies:${agentId}`;
    const cached = this.policyCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    // 查询全局策略和 Agent 级别策略
    const policies = await this.prisma.policy.findMany({
      where: {
        enabled: 1,
        deleted: 0,
        OR: [
          { scope: 'GLOBAL' },
          { scope: 'AGENT', agentId }
        ]
      },
      orderBy: {
        priority: 'desc'
      }
    });

    // 缓存策略
    this.policyCache.set(cacheKey, policies);
    setTimeout(() => {
      this.policyCache.delete(cacheKey);
    }, this.cacheExpiry);

    return policies;
  }

  /**
   * 清除策略缓存
   */
  clearCache(agentId?: string): void {
    if (agentId) {
      this.policyCache.delete(`policies:${agentId}`);
    } else {
      this.policyCache.clear();
    }
  }

  /**
   * 销毁引擎（清理资源）
   */
  destroy(): void {
    this.rateLimiter.destroy();
    this.policyCache.clear();
  }
}
