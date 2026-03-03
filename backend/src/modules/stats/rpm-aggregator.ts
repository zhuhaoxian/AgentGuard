import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

export class RpmAggregator {
  private prisma: PrismaClient;
  private task: cron.ScheduledTask | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 启动聚合任务(每分钟执行一次)
   */
  start(): void {
    // 每分钟执行
    this.task = cron.schedule('* * * * *', async () => {
      await this.aggregate();
    });

    console.log('RPM aggregator started');
  }

  /**
   * 停止聚合任务
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      console.log('RPM aggregator stopped');
    }
  }

  /**
   * 执行聚合
   */
  async aggregate(): Promise<void> {
    try {
      // 获取最近1分钟的日志
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

      const logs = await this.prisma.agentLog.findMany({
        where: {
          createdAt: {
            gte: oneMinuteAgo,
          },
        },
      });

      // 按 agentId + date + hour + minute 分组聚合
      const aggregated = new Map<string, any>();

      for (const log of logs) {
        const date = new Date(log.createdAt);
        const dateStr = date.toISOString().split('T')[0];
        const hour = date.getHours();
        const minute = date.getMinutes();
        const key = `${log.agentId}-${dateStr}-${hour}-${minute}`;

        if (!aggregated.has(key)) {
          aggregated.set(key, {
            agentId: log.agentId,
            date: new Date(dateStr),
            hour,
            minute,
            requestCount: 0,
          });
        }

        const item = aggregated.get(key)!;
        item.requestCount += 1;
      }

      // 更新或插入到 rpm_stats 表
      for (const [key, data] of aggregated) {
        await this.prisma.rpmStats.upsert({
          where: {
            uk_agent_date_hour_minute: {
              agentId: data.agentId,
              date: data.date,
              hour: data.hour,
              minute: data.minute,
            },
          },
          update: {
            requestCount: {
              increment: data.requestCount,
            },
          },
          create: data,
        });
      }

      if (aggregated.size > 0) {
        console.log(`Aggregated ${aggregated.size} RPM records`);
      }
    } catch (error) {
      console.error('RPM aggregation failed:', error);
    }
  }
}
