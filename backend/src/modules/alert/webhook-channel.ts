import axios from 'axios';
import {
  BaseNotificationChannel,
  NotificationChannelType,
} from './notification-channel';

export class WebhookChannel extends BaseNotificationChannel {
  getType(): NotificationChannelType {
    return NotificationChannelType.WEBHOOK;
  }

  async send(webhookUrl: string, subject: string, content: string): Promise<boolean> {
    try {
      const payload = {
        subject,
        content,
        timestamp: new Date().toISOString(),
      };

      await axios.post(webhookUrl, payload, {
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
