import nodemailer from 'nodemailer';
import {
  BaseNotificationChannel,
  NotificationChannelType,
} from './notification-channel';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class EmailChannel extends BaseNotificationChannel {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    super();
    this.config = config;
  }

  getType(): NotificationChannelType {
    return NotificationChannelType.EMAIL;
  }

  async send(recipient: string, subject: string, content: string): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
      });

      await transporter.sendMail({
        from: this.config.from,
        to: recipient,
        subject,
        html: content,
      });

      this.logResult(true);
      return true;
    } catch (error: any) {
      this.logResult(false, error.message);
      return false;
    }
  }
}
