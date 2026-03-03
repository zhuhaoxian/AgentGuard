import { PrismaClient } from '@prisma/client';
import {
  TokenStatsQuery,
  TokenStatsResponse,
  UsageTrendQuery,
  UsageTrendResponse,
  RpmStatsQuery,
  RpmStatsResponse,
  StatsOverviewQuery,
  StatsOverviewResponse,
  AgentUsageRankQuery,
  AgentUsageRankResponse,
  TrendsQuery,
  TrendsResponse,
  AgentTrendsQuery,
  AgentTrendsResponse,
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

  /**
   * 更新使用记录
   * 在创建日志时同步更新使用统计
   */
  async updateUsageRecord(
    agentId: string,
    model: string | null | undefined,
    tokenInput: number | null | undefined,
    tokenOutput: number | null | undefined,
    isApiCall: boolean
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const modelKey = model || 'unknown';

      // 查询当天该Agent该模型的使用记录
      const existingRecord = await this.prisma.usageRecord.findUnique({
        where: {
          uk_agent_date_model: {
            agentId,
            date: today,
            model: modelKey,
          },
        },
      });

      if (!existingRecord) {
        // 创建新记录
        await this.prisma.usageRecord.create({
          data: {
            agentId,
            date: today,
            model: modelKey,
            tokenInput: BigInt(tokenInput || 0),
            tokenOutput: BigInt(tokenOutput || 0),
            apiCalls: isApiCall ? 1 : 0,
          },
        });
      } else {
        // 更新现有记录
        await this.prisma.usageRecord.update({
          where: {
            id: existingRecord.id,
          },
          data: {
            tokenInput: existingRecord.tokenInput + BigInt(tokenInput || 0),
            tokenOutput: existingRecord.tokenOutput + BigInt(tokenOutput || 0),
            apiCalls: existingRecord.apiCalls + (isApiCall ? 1 : 0),
          },
        });
      }
    } catch (error) {
      console.error('Failed to update usage record:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 更新RPM统计
   * 在创建日志时同步更新RPM统计数据
   */
  async updateRpmStats(agentId: string): Promise<void> {
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const hour = now.getHours();
      const minute = now.getMinutes();

      // 查询当前分钟的RPM记录
      const existingRecord = await this.prisma.rpmStats.findUnique({
        where: {
          uk_agent_date_hour_minute: {
            agentId,
            date: today,
            hour,
            minute,
          },
        },
      });

      if (!existingRecord) {
        // 创建新记录
        await this.prisma.rpmStats.create({
          data: {
            agentId,
            date: today,
            hour,
            minute,
            requestCount: 1,
          },
        });
      } else {
        // 更新现有记录
        await this.prisma.rpmStats.update({
          where: {
            id: existingRecord.id,
          },
          data: {
            requestCount: existingRecord.requestCount + 1,
          },
        });
      }
    } catch (error) {
      console.error('Failed to update RPM stats:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 获取使用统计概览
   */
  async getOverview(query: StatsOverviewQuery): Promise<StatsOverviewResponse> {
    const startDate = query.startDate ? new Date(query.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    // 查询基础统计数据
    const [tokenStats, agentCount] = await Promise.all([
      this.prisma.usageRecord.aggregate({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          tokenInput: true,
          tokenOutput: true,
          apiCalls: true,
        },
      }),
      this.prisma.usageRecord.groupBy({
        by: ['agentId'],
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    const totalTokenInput = Number(tokenStats._sum.tokenInput || 0);
    const totalTokenOutput = Number(tokenStats._sum.tokenOutput || 0);
    const totalCalls = tokenStats._sum.apiCalls || 0;

    // 计算RPM指标
    const averageRpm = await this.calculateAverageRpm(null, startDate, endDate);
    const peakRpm = await this.calculatePeakRpm(null, startDate, endDate);
    const currentRpm = await this.calculateCurrentRpm();

    return {
      totalTokens: totalTokenInput + totalTokenOutput,
      tokenInput: totalTokenInput,
      tokenOutput: totalTokenOutput,
      totalCalls,
      agentCount: agentCount.length,
      averageRpm,
      peakRpm,
      currentRpm,
    };
  }

  /**
   * 获取Agent使用排行
   */
  async getTopAgents(query: AgentUsageRankQuery): Promise<AgentUsageRankResponse[]> {
    const limit = typeof query.limit === 'string' ? parseInt(query.limit) : (query.limit || 10);
    const startDate = query.startDate ? new Date(query.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    // 查询Agent使用统计
    const agentStats = await this.prisma.usageRecord.groupBy({
      by: ['agentId'],
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        tokenInput: true,
        tokenOutput: true,
        apiCalls: true,
      },
      orderBy: {
        _sum: {
          tokenInput: 'desc',
        },
      },
      take: limit,
    });

    // 查询Agent名称
    const agentIds = agentStats.map(stat => stat.agentId);
    const agents = await this.prisma.agent.findMany({
      where: {
        id: {
          in: agentIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const agentMap = new Map(agents.map(agent => [agent.id, agent.name]));

    // 构建结果
    const results: AgentUsageRankResponse[] = [];
    for (let i = 0; i < agentStats.length; i++) {
      const stat = agentStats[i];
      const averageRpm = await this.calculateAverageRpm(stat.agentId, startDate, endDate);
      const peakRpm = await this.calculatePeakRpm(stat.agentId, startDate, endDate);

      results.push({
        rank: i + 1,
        agentId: stat.agentId,
        agentName: agentMap.get(stat.agentId) || 'Unknown',
        totalTokens: Number(stat._sum.tokenInput || 0) + Number(stat._sum.tokenOutput || 0),
        apiCalls: stat._sum.apiCalls || 0,
        averageRpm,
        peakRpm,
      });
    }

    return results;
  }

  /**
   * 计算平均RPM
   */
  private async calculateAverageRpm(agentId: string | null, startTime: Date, endTime: Date): Promise<number> {
    const totalMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    if (totalMinutes === 0) {
      return 0;
    }

    const where: any = {
      createdAt: {
        gte: startTime,
        lte: endTime,
      },
    };

    if (agentId) {
      where.agentId = agentId;
    }

    const totalRequests = await this.prisma.agentLog.count({ where });
    return totalRequests / totalMinutes;
  }

  /**
   * 计算峰值RPM
   */
  private async calculatePeakRpm(agentId: string | null, startTime: Date, endTime: Date): Promise<number> {
    const where: any = {
      date: {
        gte: startTime,
        lte: endTime,
      },
    };

    if (agentId) {
      where.agentId = agentId;
    }

    const peakRecord = await this.prisma.rpmStats.findFirst({
      where,
      orderBy: {
        requestCount: 'desc',
      },
    });

    return peakRecord?.requestCount || 0;
  }

  /**
   * 计算当前RPM（最近1分钟）
   */
  private async calculateCurrentRpm(): Promise<number> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const totalRequests = await this.prisma.agentLog.count({
      where: {
        createdAt: {
          gte: oneMinuteAgo,
          lte: now,
        },
      },
    });

    return totalRequests;
  }

  /**
   * 获取使用趋势（兼容旧接口）
   */
  async getTrends(query: TrendsQuery): Promise<TrendsResponse[]> {
    const startDate = query.startDate ? new Date(query.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    // 按日期聚合使用记录
    const records = await this.prisma.usageRecord.groupBy({
      by: ['date'],
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        tokenInput: true,
        tokenOutput: true,
        apiCalls: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // 为每个日期计算RPM
    const results: TrendsResponse[] = [];
    for (const record of records) {
      const dayStart = new Date(record.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(record.date);
      dayEnd.setHours(23, 59, 59, 999);

      const averageRpm = await this.calculateAverageRpm(null, dayStart, dayEnd);
      const peakRpm = await this.calculatePeakRpm(null, dayStart, dayEnd);

      results.push({
        date: record.date.toISOString().split('T')[0],
        apiCalls: record._sum.apiCalls || 0,
        totalTokens: Number(record._sum.tokenInput || 0) + Number(record._sum.tokenOutput || 0),
        averageRpm,
        peakRpm,
      });
    }

    return results;
  }

  /**
   * 获取Agent使用趋势（按Agent分组）
   */
  async getAgentTrends(query: AgentTrendsQuery): Promise<AgentTrendsResponse[]> {
    const startDate = query.startDate ? new Date(query.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    // 查询Agent使用趋势数据
    const records = await this.prisma.usageRecord.groupBy({
      by: ['date', 'agentId'],
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        tokenInput: true,
        tokenOutput: true,
        apiCalls: true,
      },
      orderBy: [
        { date: 'asc' },
      ],
    });

    // 查询Agent名称
    const agentIds = [...new Set(records.map(r => r.agentId))];
    const agents = await this.prisma.agent.findMany({
      where: {
        id: {
          in: agentIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const agentMap = new Map(agents.map(agent => [agent.id, agent.name]));

    // 计算每个Agent的总token，找出Top 5
    const agentTotalTokens = new Map<string, number>();
    records.forEach(record => {
      const total = Number(record._sum.tokenInput || 0) + Number(record._sum.tokenOutput || 0);
      agentTotalTokens.set(
        record.agentId,
        (agentTotalTokens.get(record.agentId) || 0) + total
      );
    });

    const top5AgentIds = Array.from(agentTotalTokens.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agentId]) => agentId);

    // 按日期分组
    const dateGroups = new Map<string, typeof records>();
    records.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)!.push(record);
    });

    // 构建结果
    const results: AgentTrendsResponse[] = [];
    dateGroups.forEach((dayRecords, date) => {
      // 添加Top 5 Agent的数据
      dayRecords
        .filter(record => top5AgentIds.includes(record.agentId))
        .forEach(record => {
          results.push({
            date,
            agentId: record.agentId,
            agentName: agentMap.get(record.agentId) || 'Unknown',
            totalTokens: Number(record._sum.tokenInput || 0) + Number(record._sum.tokenOutput || 0),
            apiCalls: record._sum.apiCalls || 0,
          });
        });

      // 合并其他Agent为"其他"
      const otherRecords = dayRecords.filter(record => !top5AgentIds.includes(record.agentId));
      if (otherRecords.length > 0) {
        const otherTotalTokens = otherRecords.reduce(
          (sum, record) => sum + Number(record._sum.tokenInput || 0) + Number(record._sum.tokenOutput || 0),
          0
        );
        const otherApiCalls = otherRecords.reduce(
          (sum, record) => sum + (record._sum.apiCalls || 0),
          0
        );

        results.push({
          date,
          agentId: 'others',
          agentName: '其他',
          totalTokens: otherTotalTokens,
          apiCalls: otherApiCalls,
        });
      }
    });

    return results;
  }
}
