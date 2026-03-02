import { RateLimitConfig, RateLimitResult } from './policy.types';

interface RateLimitEntry {
  timestamps: number[];
  resetTime: number;
}

/**
 * 限流服务
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
