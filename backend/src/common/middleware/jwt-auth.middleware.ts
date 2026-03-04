import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtUtil } from '../utils/jwt.util';
import { UnauthorizedException } from '../exceptions/business.exception';

// 扩展 FastifyRequest 类型以包含 user 属性
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      username: string;
      role: string;
    };
  }
}

// 公开路由列表(不需要认证)
const PUBLIC_ROUTES = [
  '/health',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/sockjs-node', // 前端开发服务器 WebSocket
];

// API 代理路由(使用 API Key 认证)
const API_PROXY_ROUTES = [
  '/v1', // LLM 代理接口 (如 /v1/chat/completions)
  '/api/v1/proxy',
  '/api/v1/api-proxy',
  '/api/proxy', // API 代理接口（SDK 使用）
];

// 审批接口 - Agent SDK 轮询使用(通过审批 ID 访问,无需 JWT)
const APPROVAL_ROUTES_PATTERN = /^\/api\/v1\/approvals\/[^/]+\/(status|reason)$/;

export async function jwtAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { url } = request;

  // 公开路由,跳过认证
  if (PUBLIC_ROUTES.some(route => url.startsWith(route))) {
    return;
  }

  // API 代理路由,使用 API Key 认证(由 proxy 模块处理)
  if (API_PROXY_ROUTES.some(route => url.startsWith(route))) {
    return;
  }

  // 审批状态和理由接口,Agent SDK 轮询使用(通过审批 ID 访问,无需 JWT)
  if (APPROVAL_ROUTES_PATTERN.test(url)) {
    return;
  }

  // 其他路由需要 JWT 认证
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedException('Missing authorization header');
  }

  // 提取 token
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new UnauthorizedException('Invalid authorization header');
  }

  try {
    // 验证 JWT token
    const payload = JwtUtil.verifyToken(token);

    // 将用户信息附加到请求对象
    request.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };
  } catch (error) {
    throw new UnauthorizedException('Invalid or expired token');
  }
}
