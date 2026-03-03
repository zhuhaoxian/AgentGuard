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
  private cooldownMap: Map<string, number> = new Map();

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
   * 检查 RPM 告警
   */
  async checkRpmAlerts(): Promise<void> {
    try {
      // 获取 RPM 阈值配置
      const rpmThresholdSetting = await this.settingsService.getSettingByKey(
        'alert_config',
        'rpm_threshold'
      );
      const cooldownSetting = await this.settingsService.getSettingByKey(
        'alert_config',
        'rpm_alert_cooldown_minutes'
      );

      if (!rpmThresholdSetting) return;

      const rpmThreshold = parseInt(rpmThresholdSetting.settingValue || '100');
      const cooldownMinutes = parseInt(cooldownSetting?.settingValue || '30');

      // 获取最近1分钟的 RPM 统计
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const rpmStats = await this.prisma.rpmStats.findMany({
        where: {
          createdAt: {
            gte: oneMinuteAgo,
          },
        },
      });

      // 按 Agent 分组统计
      const agentRpmMap = new Map<string, number>();
      for (const stat of rpmStats) {
        const current = agentRpmMap.get(stat.agentId) || 0;
        agentRpmMap.set(stat.agentId, current + stat.requestCount);
      }

      // 检查是否超过阈值
      for (const [agentId, rpm] of agentRpmMap) {
        if (rpm > rpmThreshold) {
          // 检查冷却时间
          if (this.isInCooldown(`rpm_${agentId}`, cooldownMinutes)) {
            continue;
          }

          // 获取 Agent 信息
          const agent = await this.prisma.agent.findUnique({
            where: { id: agentId },
          });

          if (!agent) continue;

          // 发送告警
          await this.sendAlert(
            'RPM',
            `RPM 告警: ${agent.name}`,
            `Agent "${agent.name}" 的 RPM 已达到 ${rpm},超过阈值 ${rpmThreshold}`
          );

          // 记录冷却时间
          this.setCooldown(`rpm_${agentId}`);
        }
      }
    } catch (error) {
      console.error('RPM alert check failed:', error);
    }
  }

  /**
   * 检查错误率告警
   */
  async checkErrorRateAlerts(): Promise<void> {
    try {
      // 获取错误率阈值配置
      const errorRateThresholdSetting = await this.settingsService.getSettingByKey(
        'alert_config',
        'error_rate_threshold'
      );
      const cooldownSetting = await this.settingsService.getSettingByKey(
        'alert_config',
        'error_rate_alert_cooldown_minutes'
      );

      if (!errorRateThresholdSetting) return;

      const errorRateThreshold = parseFloat(
        errorRateThresholdSetting.settingValue || '0.1'
      );
      const cooldownMinutes = parseInt(cooldownSetting?.settingValue || '60');

      // 获取最近5分钟的日志
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const logs = await this.prisma.agentLog.findMany({
        where: {
          createdAt: {
            gte: fiveMinutesAgo,
          },
        },
      });

      // 按 Agent 统计错误率
      const agentStatsMap = new Map<
        string,
        { total: number; errors: number; name: string }
      >();

      for (const log of logs) {
        if (!agentStatsMap.has(log.agentId)) {
          const agent = await this.prisma.agent.findUnique({
            where: { id: log.agentId },
          });
          agentStatsMap.set(log.agentId, {
            total: 0,
            errors: 0,
            name: agent?.name || 'Unknown',
          });
        }

        const stats = agentStatsMap.get(log.agentId)!;
        stats.total += 1;

        // 检查是否是错误响应
        if (log.responseStatus !== 'SUCCESS') {
          stats.errors += 1;
        }
      }

      // 检查错误率
      for (const [agentId, stats] of agentStatsMap) {
        if (stats.total === 0) continue;

        const errorRate = stats.errors / stats.total;

        if (errorRate > errorRateThreshold) {
          // 检查冷却时间
          if (this.isInCooldown(`error_rate_${agentId}`, cooldownMinutes)) {
            continue;
          }

          // 发送告警
          await this.sendAlert(
            'ERROR_RATE',
            `错误率告警: ${stats.name}`,
            `Agent "${stats.name}" 的错误率为 ${(errorRate * 100).toFixed(2)}%,超过阈值 ${(errorRateThreshold * 100).toFixed(2)}%\n\n总请求数: ${stats.total}\n错误数: ${stats.errors}`
          );

          // 记录冷却时间
          this.setCooldown(`error_rate_${agentId}`);
        }
      }
    } catch (error) {
      console.error('Error rate alert check failed:', error);
    }
  }

  /**
   * 发送审批提醒
   */
  async sendApprovalReminders(): Promise<void> {
    try {
      // 查找即将过期的审批请求(30分钟内过期)
      const thirtyMinutesLater = new Date(Date.now() + 30 * 60 * 1000);

      const approvals = await this.prisma.approvalRequest.findMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lte: thirtyMinutesLater,
            gte: new Date(),
          },
        },
        include: {
          agent: true,
          policy: true,
        },
      });

      for (const approval of approvals) {
        // 检查是否已发送过提醒
        if (this.isInCooldown(`approval_${approval.id}`, 30)) {
          continue;
        }

        const minutesLeft = Math.floor(
          (approval.expiresAt.getTime() - Date.now()) / (60 * 1000)
        );

        await this.sendAlert(
          'APPROVAL',
          `审批提醒: ${approval.agent.name}`,
          `Agent "${approval.agent.name}" 有一个待审批请求即将过期\n\n策略: ${approval.policy.name}\n剩余时间: ${minutesLeft} 分钟\n申请理由: ${approval.applicationReason || '无'}`
        );

        // 记录已发送
        this.setCooldown(`approval_${approval.id}`);
      }
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
        channels.push(new DingTalkChannel());
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
   * 检查是否在冷却期
   */
  private isInCooldown(key: string, cooldownMinutes: number): boolean {
    const lastTime = this.cooldownMap.get(key);
    if (!lastTime) return false;

    const elapsed = Date.now() - lastTime;
    return elapsed < cooldownMinutes * 60 * 1000;
  }

  /**
   * 设置冷却时间
   */
  private setCooldown(key: string): void {
    this.cooldownMap.set(key, Date.now());
  }
}
