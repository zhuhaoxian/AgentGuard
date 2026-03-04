import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  BaseNotificationChannel,
  NotificationChannelType,
} from './notification-channel';
import { SettingsService } from '../settings/settings.service';

/**
 * 钉钉机器人通知渠道实现（参考旧代码：DingTalkNotificationChannel.java）
 */
export class DingTalkChannel extends BaseNotificationChannel {
  private settingsService: SettingsService;

  constructor(prisma: PrismaClient) {
    super();
    this.settingsService = new SettingsService(prisma);
  }

  getType(): NotificationChannelType {
    return NotificationChannelType.DINGTALK;
  }

  async send(recipient: string, subject: string, content: string): Promise<boolean> {
    try {
      // 从系统设置中获取钉钉配置（参考旧代码：DingTalkNotificationChannel.java:40-48）
      const webhookSettings = await this.settingsService.getSettingsByCategory('alert_webhook');

      let webhook = '';
      let secret = '';

      for (const setting of webhookSettings) {
        if (setting.settingKey === 'dingtalk_webhook') {
          webhook = setting.settingValue || '';
        } else if (setting.settingKey === 'dingtalk_secret') {
          secret = setting.settingValue || '';
        }
      }

      if (!webhook) {
        console.warn('钉钉Webhook地址为空，无法发送通知');
        return false;
      }

      // 如果配置了签名密钥，需要计算签名（参考旧代码：DingTalkNotificationChannel.java:55-62）
      let finalWebhook = webhook;
      if (secret) {
        const timestamp = Date.now();
        const stringToSign = `${timestamp}\n${secret}`;
        const sign = this.generateSignature(stringToSign, secret);
        finalWebhook = `${webhook}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }

      // 构建钉钉消息体（Markdown格式）（参考旧代码：DingTalkNotificationChannel.java:64-71）
      const message = {
        msgtype: 'markdown',
        markdown: {
          title: subject,
          text: `### ${subject}\n\n${content}`,
        },
      };

      // 发送请求（参考旧代码：DingTalkNotificationChannel.java:73-78）
      await axios.post(finalWebhook, message, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      this.logResult(true);
      return true;
    } catch (error: any) {
      this.logResult(false, error.message);
      return false;
    }
  }

  /**
   * 生成钉钉签名（参考旧代码：DingTalkNotificationChannel.java:60）
   * 使用 HMAC-SHA256 算法计算签名并 Base64 编码
   */
  private generateSignature(stringToSign: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign, 'utf8');
    return hmac.digest('base64');
  }
}
