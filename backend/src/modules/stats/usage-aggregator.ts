import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

export class UsageAggregator {
  private prisma: PrismaClient;
  private task: cron.ScheduledTask | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 启动聚合任务(每小时执行一次)
   */
  start(): void {
    // 每小时的第5分钟执行
    this.task = cron.schedule('5 * * * *', async () => {
      console.log('Running usage aggregation...');
      await this.aggregate();
    });

    console.log('Usage aggregator started');
  }

  /**
   * 停止聚合任务
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      console.log('Usage aggregator stopped');
    }
  }

  /**
   * 执行聚合
   */
  async aggregate(): Promise<void> {
    try {
      // 获取最近1小时的日志
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const logs = await this.prisma.agentLog.findMany({
        where: {
          createdAt: {
            gte: oneHourAgo,
          },
        },
      });

      // 按 agentId + date + model 分组聚合
      const aggregated = new Map<string, any>();

      for (const log of logs) {
        const date = new Date(log.createdAt);
        const dateStr = date.toISOString().split('T')[0];
        const key = `${log.agentId}-${dateStr}-${log.model || 'unknown'}`;

        if (!aggregated.has(key)) {
          aggregated.set(key, {
            agentId: log.agentId,
            date: new Date(dateStr),
            model: log.model,
            tokenInput: 0,
            tokenOutput: 0,
            apiCalls: 0,
          });
        }

        const item = aggregated.get(key)!;
        item.tokenInput += log.tokenInput || 0;
        item.tokenOutput += log.tokenOutput || 0;
        item.apiCalls += 1;
      }

      // 更新或插入到 usage_record 表
      for (const [key, data] of aggregated) {
        await this.prisma.usageRecord.upsert({
          where: {
            uk_agent_date_model: {
              agentId: data.agentId,
              date: data.date,
              model: data.model,
            },
          },
          update: {
            tokenInput: {
              increment: data.tokenInput,
            },
            tokenOutput: {
              increment: data.tokenOutput,
            },
            apiCalls: {
              increment: data.apiCalls,
            },
          },
          create: data,
        });
      }

      console.log(`Aggregated ${aggregated.size} usage records`);
    } catch (error) {
      console.error('Usage aggregation failed:', error);
    }
  }
}
