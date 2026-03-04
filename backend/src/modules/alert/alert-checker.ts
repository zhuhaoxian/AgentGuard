import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { NotificationChannel, NotificationChannelType } from './notification-channel';
import { EmailChannel } from './email-channel';
import { DingTalkChannel } from './dingtalk-channel';
import { WeComChannel } from './wecom-channel';
import { WebhookChannel } from './webhook-channel';

export class AlertChecker {
  private prisma: PrismaClient;
  private settingsService: SettingsService;
  private rpmTask: cron.ScheduledTask | null = null;
  private errorRateTask: cron.ScheduledTask | null = null;
  private approvalTask: cron.ScheduledTask | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.settingsService = new SettingsService(prisma);
  }

  /**
   * 启动所有告警检查任务
   */
  start(): void {
    // RPM 告警检查 - 每分钟执行
    this.rpmTask = cron.schedule('* * * * *', async () => {
      await this.checkRpmAlerts();
    });

    // 错误率告警检查 - 每5分钟执行
    this.errorRateTask = cron.schedule('*/5 * * * *', async () => {
      await this.checkErrorRateAlerts();
    });

    // 审批提醒检查 - 每10分钟执行
    this.approvalTask = cron.schedule('*/10 * * * *', async () => {
      await this.sendApprovalReminders();
    });

    console.log('Alert checker started');
  }

  /**
   * 停止所有告警检查任务
   */
  stop(): void {
    if (this.rpmTask) this.rpmTask.stop();
    if (this.errorRateTask) this.errorRateTask.stop();
    if (this.approvalTask) this.approvalTask.stop();
    console.log('Alert checker stopped');
  }

  /**
   * 检查 RPM 告警（参考旧代码：AlertServiceImpl.java:248-333）
   */
  async checkRpmAlerts(): Promise<void> {
    try {
      // 获取告警配置（参考旧代码：AlertServiceImpl.java:252）
      const alertSettings = await this.settingsService.getAlertSettings();

      // 检查 RPM 告警是否启用（参考旧代码：AlertServiceImpl.java:255-258）
      if (!alertSettings.rpmAlertEnabled) {
        return;
      }

      // 检查冷却时间（参考旧代码：AlertServiceImpl.java:261-264）
      const cooldownMinutes = alertSettings.rpmAlertCooldownMinutes || 30;
      if (await this.isInCooldown('RPM', cooldownMinutes)) {
        return;
      }

      // 获取 RPM 阈值（参考旧代码：AlertServiceImpl.java:267-271）
      const rpmThreshold = alertSettings.rpmThreshold;
      if (!rpmThreshold || rpmThreshold <= 0) {
        return;
      }

      // 获取所有活跃的 Agent（参考旧代码：AlertServiceImpl.java:281-288）
      const activeAgents = await this.prisma.agent.findMany({
        where: {
          status: 1,
        },
      });

      if (activeAgents.length === 0) {
        return;
      }

      // 计算检查时间窗口（最近5分钟）（参考旧代码：AlertServiceImpl.java:291-292）
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // 检查每个 Agent 的峰值 RPM（参考旧代码：AlertServiceImpl.java:295-330）
      for (const agent of activeAgents) {
        try {
          // 计算该 Agent 在最近5分钟的峰值 RPM（参考旧代码：AlertServiceImpl.java:298）
          // 峰值 RPM = 任意1分钟窗口内的最大请求数
          const peakRpm = await this.calculatePeakRpm(agent.id, fiveMinutesAgo, now);

          // 如果峰值 RPM 超过阈值，发送告警（参考旧代码：AlertServiceImpl.java:301-324）
          if (peakRpm > rpmThreshold) {
            const title = `RPM 告警: Agent "${agent.name}" 请求速率超过阈值`;
            const content = `#### ⚡ RPM告警通知\n\n**Agent名称:** ${agent.name}\n\n**Agent ID:** ${agent.id}\n\n**峰值RPM:** ${peakRpm} 请求/分钟\n\n**告警阈值:** ${rpmThreshold} 请求/分钟\n\n**检测时间:** ${now.toISOString().replace('T', ' ').substring(0, 19)}\n\n**时间窗口:** 最近5分钟\n\n请检查Agent的请求频率是否正常，必要时调整策略限制。`;

            await this.sendAlert('RPM', title, content);

            console.log(`RPM告警已触发: agentId=${agent.id}, agentName=${agent.name}, peakRpm=${peakRpm}, threshold=${rpmThreshold}`);

            // 只发送一次告警就退出（参考旧代码：AlertServiceImpl.java:324）
            break;
          }
        } catch (error) {
          console.error(`检查Agent RPM时发生错误: agentId=${agent.id}, agentName=${agent.name}`, error);
        }
      }
    } catch (error) {
      console.error('RPM alert check failed:', error);
    }
  }

  /**
   * 计算峰值 RPM（任意1分钟窗口内的最大请求数）（参考旧代码：RpmCalculatorImpl.java:55-69）
   */
  private async calculatePeakRpm(
    agentId: string,
    startTime: Date,
    endTime: Date
  ): Promise<number> {
    // 查询时间窗口内的所有 RPM 统计记录
    const rpmStats = await this.prisma.rpmStats.findMany({
      where: {
        agentId,
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      select: {
        requestCount: true,
      },
    });

    if (rpmStats.length === 0) {
      return 0;
    }

    // 找出最大的请求数（峰值 RPM）
    const peakRpm = Math.max(...rpmStats.map(stat => stat.requestCount));
    return peakRpm;
  }

  /**
   * 检查错误率告警（参考旧代码：AlertServiceImpl.java:337-423）
   */
  async checkErrorRateAlerts(): Promise<void> {
    try {
      // 获取告警配置（参考旧代码：AlertServiceImpl.java:341）
      const alertSettings = await this.settingsService.getAlertSettings();

      // 检查错误率告警是否启用（参考旧代码：AlertServiceImpl.java:344-347）
      if (!alertSettings.errorRateAlertEnabled) {
        return;
      }

      // 检查冷却时间（参考旧代码：AlertServiceImpl.java:350-353）
      const cooldownMinutes = alertSettings.errorRateAlertCooldownMinutes || 60;
      if (await this.isInCooldown('ERROR_RATE', cooldownMinutes)) {
        return;
      }

      // 使用系统设置中的阈值（参考旧代码：AlertServiceImpl.java:360-362）
      // 注意：旧代码中阈值是百分比（如10），需要转换为小数（0.1）
      const errorRateThreshold = alertSettings.errorRateThreshold;
      if (!errorRateThreshold) {
        return;
      }
      const effectiveThreshold = errorRateThreshold / 100.0;

      // 获取最近5分钟的日志（参考旧代码：AlertServiceImpl.java:366-374）
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const logs = await this.prisma.agentLog.findMany({
        where: {
          createdAt: {
            gte: fiveMinutesAgo,
          },
        },
      });

      if (logs.length === 0) {
        return;
      }

      // 计算全局错误率（参考旧代码：AlertServiceImpl.java:382-390）
      const totalRequests = logs.length;
      const failedRequests = logs.filter(log => log.responseStatus !== 'SUCCESS').length;
      const errorRate = failedRequests / totalRequests;

      // 检查是否超过阈值（参考旧代码：AlertServiceImpl.java:393-420）
      if (errorRate >= effectiveThreshold) {
        const title = `错误率告警: 系统错误率已达${(errorRate * 100).toFixed(2)}%`;
        const content = `#### 🚨 系统异常告警\n\n**时间窗口:** 最近 5 分钟\n\n**总请求数:** ${totalRequests}\n\n**失败请求数:** ${failedRequests}\n\n**当前错误率:** ${(errorRate * 100).toFixed(2)}%\n\n**告警阈值:** ${(effectiveThreshold * 100).toFixed(0)}%\n\n请及时排查系统异常！`;

        await this.sendAlert('ERROR_RATE', title, content);
      }
    } catch (error) {
      console.error('Error rate alert check failed:', error);
    }
  }

  /**
   * 发送审批提醒（参考旧代码：AlertServiceImpl.java:427-517）
   */
  async sendApprovalReminders(): Promise<void> {
    try {
      // 获取告警配置（参考旧代码：AlertServiceImpl.java:431）
      const alertSettings = await this.settingsService.getAlertSettings();

      // 检查审批提醒是否启用（参考旧代码：AlertServiceImpl.java:434-437）
      if (!alertSettings.approvalReminderEnabled) {
        console.log('审批提醒未启用');
        return;
      }

      // 检查冷却时间（参考旧代码：AlertServiceImpl.java:440-443）
      const cooldownMinutes = alertSettings.approvalReminderCooldownMinutes || 10;
      if (await this.isInCooldown('APPROVAL', cooldownMinutes)) {
        return;
      }

      // 使用系统设置中的提醒时间（参考旧代码：AlertServiceImpl.java:446-449）
      const reminderMinutes = alertSettings.approvalReminderMinutes || 30;

      // 查找即将过期的审批请求（参考旧代码：AlertServiceImpl.java:452-461）
      const now = new Date();
      const reminderTime = new Date(now.getTime() + reminderMinutes * 60 * 1000);

      const approvals = await this.prisma.approvalRequest.findMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lte: reminderTime,
            gte: now,
          },
        },
        include: {
          agent: true,
          policy: true,
        },
        orderBy: {
          expiresAt: 'asc',
        },
      });

      if (approvals.length === 0) {
        return;
      }

      console.log(`发现${approvals.length}个即将过期的审批请求，将发送汇总通知`);

      // 取前3条审批请求（参考旧代码：AlertServiceImpl.java:478-481）
      const top3Approvals = approvals.slice(0, 3);

      // 构建表格内容（参考旧代码：AlertServiceImpl.java:486-496）
      let tableContent = '| 审批ID | 过期时间 | 剩余时间 |\n';
      tableContent += '| :----- | :----: | -------: |\n';

      for (const approval of top3Approvals) {
        const remainingMinutes = Math.floor(
          (approval.expiresAt.getTime() - now.getTime()) / (60 * 1000)
        );
        const expiresAtStr = approval.expiresAt.toISOString().replace('T', ' ').substring(0, 19);
        tableContent += `| ${approval.id} | ${expiresAtStr} | ${remainingMinutes} 分钟 |\n`;
      }

      // 构建告警内容（参考旧代码：AlertServiceImpl.java:498-507）
      const title = `审批提醒: 有${approvals.length}个审批请求即将过期`;
      const content = `#### ⏰ 审批过期提醒\n\n**待审批总数:** ${approvals.length}\n\n**即将过期的前3条审批请求:**\n\n${tableContent}\n请尽快处理这些审批请求！`;

      // 发送告警（参考旧代码：AlertServiceImpl.java:510）
      await this.sendAlert('APPROVAL', title, content);
    } catch (error) {
      console.error('Approval reminder check failed:', error);
    }
  }

  /**
   * 发送告警
   */
  private async sendAlert(
    type: string,
    title: string,
    content: string
  ): Promise<void> {
    try {
      // 获取通知渠道配置
      const channels = await this.getNotificationChannels();

      for (const channel of channels) {
        const success = await channel.send('', title, content);

        // 记录告警历史
        await this.prisma.alertHistory.create({
          data: {
            type,
            title,
            content,
            channelType: channel.getType(),
            status: success ? 'SUCCESS' : 'FAILED',
            sentAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * 获取通知渠道
   */
  private async getNotificationChannels(): Promise<NotificationChannel[]> {
    const channels: NotificationChannel[] = [];

    // 获取邮件配置
    const emailSettings = await this.settingsService.getSettingsByCategory(
      'alert_email'
    );
    if (emailSettings.length > 0) {
      const emailConfig = this.parseEmailConfig(emailSettings);
      if (emailConfig) {
        channels.push(new EmailChannel(emailConfig));
      }
    }

    // 获取 Webhook 配置
    const webhookSettings = await this.settingsService.getSettingsByCategory(
      'alert_webhook'
    );
    for (const setting of webhookSettings) {
      if (setting.settingKey === 'dingtalk_webhook' && setting.settingValue) {
        channels.push(new DingTalkChannel(this.prisma));
      } else if (setting.settingKey === 'wecom_webhook' && setting.settingValue) {
        channels.push(new WeComChannel());
      } else if (setting.settingKey === 'custom_webhook' && setting.settingValue) {
        channels.push(new WebhookChannel());
      }
    }

    return channels;
  }

  /**
   * 解析邮件配置
   */
  private parseEmailConfig(settings: any[]): any {
    const config: any = {};
    for (const setting of settings) {
      config[setting.settingKey] = setting.settingValue;
    }

    if (!config.smtp_host || !config.smtp_user || !config.smtp_password) {
      return null;
    }

    return {
      host: config.smtp_host,
      port: parseInt(config.smtp_port || '587'),
      secure: config.smtp_secure === 'true',
      auth: {
        user: config.smtp_user,
        pass: config.smtp_password,
      },
      from: config.smtp_from || config.smtp_user,
    };
  }

  /**
   * 检查指定类型的告警是否在冷却期内（参考旧代码：AlertServiceImpl.java:620-650）
   * @param alertType 告警类型
   * @param cooldownMinutes 冷却时间（分钟）
   * @return true-在冷却期内，false-不在冷却期内
   */
  private async isInCooldown(alertType: string, cooldownMinutes: number): Promise<boolean> {
    if (!cooldownMinutes || cooldownMinutes <= 0) {
      return false;
    }

    // 查询最近一次成功发送的相同类型告警（参考旧代码：AlertServiceImpl.java:626-632）
    const lastAlert = await this.prisma.alertHistory.findFirst({
      where: {
        type: alertType,
        status: 'SUCCESS',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!lastAlert) {
      // 没有历史记录，不在冷却期（参考旧代码：AlertServiceImpl.java:634-637）
      return false;
    }

    // 计算距离上次发送的时间（分钟）（参考旧代码：AlertServiceImpl.java:639-644）
    const now = new Date();
    const minutesSinceLastSent = Math.floor(
      (now.getTime() - lastAlert.createdAt.getTime()) / (60 * 1000)
    );

    const inCooldown = minutesSinceLastSent < cooldownMinutes;
    if (inCooldown) {
      console.log(
        `告警类型 ${alertType} 在冷却期内，上次发送时间: ${lastAlert.createdAt}, 已过去 ${minutesSinceLastSent} 分钟，冷却时间: ${cooldownMinutes} 分钟`
      );
    }

    return inCooldown;
  }
}
