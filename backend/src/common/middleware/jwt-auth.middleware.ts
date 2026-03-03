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
];

// API 代理路由(使用 API Key 认证)
const API_PROXY_ROUTES = [
  '/api/v1/proxy',
  '/api/v1/api-proxy',
];

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
