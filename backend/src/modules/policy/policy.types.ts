// Policy 模块类型定义

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startswith' | 'endswith' | 'matches' | 'in' | 'notin' | 'isNull' | 'isNotNull';
  value: any;
}

export interface PolicyConditions {
  logic?: 'AND' | 'OR';
  conditions?: PolicyCondition[];
  urlPattern?: string;
  method?: string | string[];
  headers?: Record<string, string>;
  body?: PolicyCondition[];
  bodyConditions?: PolicyCondition[];
  headerConditions?: PolicyCondition[];
  windowSeconds?: number;
  maxRequests?: number;
  keyExtractor?: string;
}

export interface PolicyEvaluationContext {
  agentId: string;
  requestType: string;
  url?: string;
  method?: string;
  headers?: Record<string, any>;
  body?: any;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  matchedPolicy?: any;
  action: 'ALLOW' | 'DENY' | 'APPROVAL' | 'RATE_LIMIT';
  reason?: string;
  requiresApproval?: boolean;
  rateLimitExceeded?: boolean;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyExtractor?: 'agentId' | 'ip' | 'custom';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}
