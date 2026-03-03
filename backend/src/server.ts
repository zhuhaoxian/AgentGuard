import 'dotenv/config';
import { buildApp } from './app';
import { prisma, disconnectPrisma } from './common/utils/prisma.util';
import { AlertChecker } from './modules/alert/alert-checker';
import { UsageAggregator } from './modules/stats/usage-aggregator';
import { RpmAggregator } from './modules/stats/rpm-aggregator';
import { ApprovalExecutor } from './modules/approval/approval-executor';
import { ApprovalService } from './modules/approval/approval.service';

async function start() {
  const app = await buildApp();

  try {
    const port = Number(process.env.PORT) || 8080;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);

    // 启动告警检查器
    const alertChecker = new AlertChecker(prisma);
    alertChecker.start();
    console.log('Alert checker started');

    // 启动使用数据聚合器
    const usageAggregator = new UsageAggregator(prisma);
    usageAggregator.start();
    console.log('Usage aggregator started');

    // 启动 RPM 数据聚合器
    const rpmAggregator = new RpmAggregator(prisma);
    rpmAggregator.start();
    console.log('RPM aggregator started');

    // 启动审批执行器(每分钟检查一次已批准的审批)
    const approvalExecutor = new ApprovalExecutor(prisma);
    const approvalService = new ApprovalService(prisma);

    setInterval(async () => {
      await approvalExecutor.executeApprovedApprovals();
    }, 60000);
    console.log('Approval executor started');

    // 启动审批过期检查(每10分钟检查一次)
    setInterval(async () => {
      const count = await approvalService.expireOverdueApprovals();
      if (count > 0) {
        console.log(`Expired ${count} overdue approvals`);
      }
    }, 10 * 60 * 1000);
    console.log('Approval expiration checker started');

    // 优雅关闭
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      alertChecker.stop();
      usageAggregator.stop();
      rpmAggregator.stop();
      await app.close();
      await disconnectPrisma();
      process.exit(0);
    });

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
