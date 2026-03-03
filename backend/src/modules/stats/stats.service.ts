import { PrismaClient } from '@prisma/client';
import {
  TokenStatsQuery,
  TokenStatsResponse,
  UsageTrendQuery,
  UsageTrendResponse,
  RpmStatsQuery,
  RpmStatsResponse,
} from './stats.types';

export class StatsService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 获取 Token 统计
   */
  async getTokenStats(query: TokenStatsQuery): Promise<TokenStatsResponse[]> {
    const where: any = {
      date: {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      },
    };

    if (query.agentId) {
      where.agentId = query.agentId;
    }

    if (query.model) {
      where.model = query.model;
    }

    const records = await this.prisma.usageRecord.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return records.map(record => ({
      date: record.date.toISOString().split('T')[0],
      model: record.model,
      tokenInput: Number(record.tokenInput),
      tokenOutput: Number(record.tokenOutput),
      apiCalls: record.apiCalls,
    }));
  }

  /**
   * 获取使用趋势
   */
  async getUsageTrend(query: UsageTrendQuery): Promise<UsageTrendResponse[]> {
    const where: any = {
      date: {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      },
    };

    if (query.agentId) {
      where.agentId = query.agentId;
    }

    const records = await this.prisma.usageRecord.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // 按时间粒度聚合
    const granularity = query.granularity || 'day';
    const aggregated = this.aggregateByGranularity(records, granularity);

    return aggregated;
  }

  /**
   * 获取 RPM 统计
   */
  async getRpmStats(query: RpmStatsQuery): Promise<RpmStatsResponse[]> {
    const where: any = {
      date: new Date(query.date),
    };

    if (query.agentId) {
      where.agentId = query.agentId;
    }

    const records = await this.prisma.rpmStats.findMany({
      where,
      orderBy: [{ hour: 'asc' }, { minute: 'asc' }],
    });

    return records.map(record => ({
      hour: record.hour,
      minute: record.minute,
      requestCount: record.requestCount,
    }));
  }

  /**
   * 获取总体统计
   */
  async getOverallStats(agentId?: string) {
    const where: any = {};
    if (agentId) {
      where.agentId = agentId;
    }

    const [totalTokens, totalCalls, todayStats] = await Promise.all([
      // 总 Token 数
      this.prisma.usageRecord.aggregate({
        where,
        _sum: {
          tokenInput: true,
          tokenOutput: true,
        },
      }),
      // 总调用次数
      this.prisma.usageRecord.aggregate({
        where,
        _sum: {
          apiCalls: true,
        },
      }),
      // 今日统计
      this.prisma.usageRecord.aggregate({
        where: {
          ...where,
          date: new Date(new Date().toISOString().split('T')[0]),
        },
        _sum: {
          tokenInput: true,
          tokenOutput: true,
          apiCalls: true,
        },
      }),
    ]);

    return {
      totalTokenInput: Number(totalTokens._sum.tokenInput || 0),
      totalTokenOutput: Number(totalTokens._sum.tokenOutput || 0),
      totalApiCalls: totalCalls._sum.apiCalls || 0,
      todayTokenInput: Number(todayStats._sum.tokenInput || 0),
      todayTokenOutput: Number(todayStats._sum.tokenOutput || 0),
      todayApiCalls: todayStats._sum.apiCalls || 0,
    };
  }

  /**
   * 按时间粒度聚合数据
   */
  private aggregateByGranularity(
    records: any[],
    granularity: 'day' | 'week' | 'month'
  ): UsageTrendResponse[] {
    const grouped = new Map<string, UsageTrendResponse>();

    for (const record of records) {
      const date = new Date(record.date);
      let period: string;

      if (granularity === 'day') {
        period = date.toISOString().split('T')[0];
      } else if (granularity === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        period = weekStart.toISOString().split('T')[0];
      } else {
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped.has(period)) {
        grouped.set(period, {
          period,
          tokenInput: 0,
          tokenOutput: 0,
          apiCalls: 0,
        });
      }

      const item = grouped.get(period)!;
      item.tokenInput += Number(record.tokenInput);
      item.tokenOutput += Number(record.tokenOutput);
      item.apiCalls += record.apiCalls;
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );
  }
}
