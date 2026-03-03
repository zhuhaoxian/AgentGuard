import axios from 'axios';
import {
  BaseNotificationChannel,
  NotificationChannelType,
} from './notification-channel';

export class DingTalkChannel extends BaseNotificationChannel {
  getType(): NotificationChannelType {
    return NotificationChannelType.DINGTALK;
  }

  async send(webhookUrl: string, subject: string, content: string): Promise<boolean> {
    try {
      const message = {
        msgtype: 'markdown',
        markdown: {
          title: subject,
          text: `### ${subject}\n\n${content}`,
        },
      };

      await axios.post(webhookUrl, message, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      this.logResult(true);
      return true;
    } catch (error: any) {
      this.logResult(false, error.message);
      return false;
    }
  }
}
