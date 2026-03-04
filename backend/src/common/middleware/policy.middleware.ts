import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { PolicyEngine } from '../../modules/policy/policy-engine';
import { ApprovalService } from '../../modules/approval/approval.service';
import { LogService } from '../../modules/log/log.service';
import { SettingsService } from '../../modules/settings/settings.service';
import type { PolicyEvaluationContext } from '../../modules/policy/policy.types';

const prisma = new PrismaClient();

/**
 * 策略评估中间件
 * 在请求到达代理服务前拦截，进行策略评估
 */

// 扩展 FastifyRequest 类型，添加策略评估结果
declare module 'fastify' {
  interface FastifyRequest {
    agentId?: string;
    policyResult?: any;
    approvalRequestId?: string;
  }
}

export async function policyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 如果没有 agentId，跳过策略评估（由 authMiddleware 设置）
  if (!request.agentId) {
    return;
  }

  try {
    // 1. 提取评估上下文
    const context: PolicyEvaluationContext = {
      agentId: request.agentId,
      requestType: request.url.startsWith('/v1') ? 'LLM_CALL' : 'API_CALL',
      url: request.url,
      method: request.method,
      headers: request.headers as Record<string, any>,
      body: request.body as any
    };

    // 2. 调用策略引擎评估
    const policyEngine = new PolicyEngine(prisma);
    const result = await policyEngine.evaluate(context);

    // 3. 处理评估结果
    if (result.action === 'DENY') {
      // 拒绝请求
      return reply.status(403).send({
        error: 'Request blocked by policy',
        reason: result.reason || 'Access denied',
        policy: result.matchedPolicy?.name
      });
    }

    if (result.action === 'APPROVAL') {
      // 需要审批
      const approvalService = new ApprovalService(prisma);
      const logService = new LogService();
      const settingsService = new SettingsService(prisma);

      // 获取审批过期时间配置（参考旧代码：ApprovalServiceImpl.java:73-74）
      const alertSettings = await settingsService.getAlertSettings();
      const expirationMinutes = alertSettings.approvalExpirationMinutes || 60;

      // 创建审批请求
      const approval = await approvalService.createApproval({
        policyId: result.matchedPolicy.id,
        agentId: context.agentId,
        requestData: {
          requestType: context.requestType,
          url: context.url,
          method: context.method,
          headers: context.headers,
          body: context.body
        },
        applicationReason: result.reason || 'Policy requires approval',
        expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000)
      });

      // 创建待审批日志
      await logService.createLog({
        agentId: context.agentId,
        requestType: context.requestType,
        endpoint: context.url,
        method: context.method,
        requestBody: context.body || {},
        requestHeaders: context.headers,
        responseBody: { message: 'Pending approval' },
        responseStatus: 'PENDING_APPROVAL',
        approvalRequestId: approval.id,
        policySnapshot: result.matchedPolicy
      });

      // 返回 202 状态，告知需要审批
      return reply.status(202).send({
        message: 'Request requires approval',
        approvalId: approval.id,
        policy: result.matchedPolicy?.name,
        expiresAt: approval.expiresAt
      });
    }

    if (result.action === 'RATE_LIMIT' && result.rateLimitExceeded) {
      // 限流
      return reply.status(429).send({
        error: 'Rate limit exceeded',
        reason: result.reason || 'Too many requests',
        policy: result.matchedPolicy?.name
      });
    }

    // 4. 允许请求，将策略信息附加到请求对象
    request.policyResult = result;
  } catch (error) {
    console.error('Policy evaluation error:', error);
    // 策略评估失败时，默认允许请求通过（降级策略）
    // 避免策略引擎故障导致服务不可用
  }
}
