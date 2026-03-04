import { RateLimitConfig, RateLimitResult, PolicyEvaluationContext } from './policy.types';

interface RateLimitEntry {
  timestamps: number[];
  resetTime: number;
}

/**
 * 限流服务（参考旧代码：RateLimiterServiceImpl.java）
 * 使用内存 Map 实现滑动窗口算法
 * 注意：单实例部署，重启后限流计数会重置
 */
export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 每分钟清理一次过期数据
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * 检查是否超过限流
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // 获取或创建限流记录
    let entry = this.store.get(key);
    if (!entry) {
      entry = {
        timestamps: [],
        resetTime: now + config.windowMs
      };
      this.store.set(key, entry);
    }

    // 移除窗口外的时间戳（滑动窗口）
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    // 检查是否超过限制
    const currentCount = entry.timestamps.length;
    const allowed = currentCount < config.maxRequests;

    if (allowed) {
      // 记录本次请求
      entry.timestamps.push(now);
      entry.resetTime = now + config.windowMs;
    }

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - currentCount - (allowed ? 1 : 0)),
      resetTime: entry.resetTime
    };
  }

  /**
   * 生成限流键（参考旧代码：RateLimiterServiceImpl.java:115-157）
   * 支持动态提取：
   * - "ip": 提取客户端 IP
   * - "header:X-Header-Name": 提取请求头
   * - "body:fieldName": 提取请求体字段（支持嵌套，如 "body:user.id"）
   */
  generateRateLimitKey(
    context: PolicyEvaluationContext,
    keyExtractor?: string
  ): string {
    if (!keyExtractor || keyExtractor.trim() === '') {
      // 默认使用 agentId
      return `ratelimit:${context.agentId}`;
    }

    const extractor = keyExtractor.trim().toLowerCase();

    // 支持 ip 提取客户端 IP（参考旧代码：RateLimiterServiceImpl.java:124-126）
    if (extractor === 'ip') {
      const ip = this.extractClientIp(context.headers);
      return `ratelimit:ip:${ip || 'unknown'}`;
    }

    // 支持 header:X-Header-Name 格式提取请求头（参考旧代码：RateLimiterServiceImpl.java:129-140）
    if (extractor.startsWith('header:')) {
      const headerName = keyExtractor.substring(7).trim();
      const value = this.findHeaderValue(context.headers, headerName);
      return `ratelimit:header:${value || 'unknown'}`;
    }

    // 支持 body:fieldName 格式提取请求体字段（参考旧代码：RateLimiterServiceImpl.java:143-153）
    if (extractor.startsWith('body:')) {
      const fieldName = keyExtractor.substring(5).trim();
      const value = this.getNestedValue(context.body, fieldName);
      return `ratelimit:body:${value || 'unknown'}`;
    }

    // 不支持的格式，使用默认键
    console.warn(`不支持的 keyExtractor 格式: ${keyExtractor}，使用 agentId`);
    return `ratelimit:${context.agentId}`;
  }

  /**
   * 提取客户端 IP（参考旧代码：RateLimiterServiceImpl.java:124-126）
   */
  private extractClientIp(headers?: Record<string, any>): string | null {
    if (!headers) return null;

    // 尝试从常见的代理头中提取 IP
    const ipHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip'
    ];

    for (const headerName of ipHeaders) {
      const value = this.findHeaderValue(headers, headerName);
      if (value) {
        // x-forwarded-for 可能包含多个 IP，取第一个
        return value.split(',')[0].trim();
      }
    }

    return null;
  }

  /**
   * 查找请求头值（不区分大小写）（参考旧代码：RateLimiterServiceImpl.java:188-203）
   */
  private findHeaderValue(headers: Record<string, any> | undefined, headerName: string): string | null {
    if (!headers) return null;

    // 先尝试精确匹配
    if (headers[headerName]) {
      return String(headers[headerName]);
    }

    // 不区分大小写匹配
    const lowerHeaderName = headerName.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerHeaderName) {
        return String(value);
      }
    }

    return null;
  }

  /**
   * 获取嵌套字段值（支持点号分隔的路径，如 "user.id"）（参考旧代码：RateLimiterServiceImpl.java:209-230）
   */
  private getNestedValue(obj: any, fieldPath: string): any {
    if (!obj || !fieldPath) return null;

    const parts = fieldPath.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * 重置指定 key 的限流计数
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * 清理所有限流计数
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 清理过期的限流记录
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      // 如果重置时间已过，删除该记录
      if (entry.resetTime < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.store.delete(key));
  }

  /**
   * 获取限流统计信息
   */
  getStats(key: string): { count: number; resetTime: number } | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    return {
      count: entry.timestamps.length,
      resetTime: entry.resetTime
    };
  }

  /**
   * 销毁限流器（清理定时器）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}
