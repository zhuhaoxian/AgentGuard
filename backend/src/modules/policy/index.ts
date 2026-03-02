import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { PolicyEngine } from './policy-engine';
import { PolicyService } from './policy.service';
import { policyController } from './policy.controller';

export { PolicyEngine } from './policy-engine';
export { PolicyService } from './policy.service';
export { ConditionEvaluator } from './condition-evaluator';
export { RateLimiter } from './rate-limiter';
export * from './policy.types';

/**
 * 注册策略路由
 */
export async function policyRoutes(app: FastifyInstance) {
  const prisma = new PrismaClient();
  const policyEngine = new PolicyEngine(prisma);
  const policyService = new PolicyService(prisma, policyEngine);

  // 注册路由
  await policyController(app, policyService);
}
