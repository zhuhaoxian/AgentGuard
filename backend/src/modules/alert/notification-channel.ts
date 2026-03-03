export enum NotificationChannelType {
  EMAIL = 'EMAIL',
  DINGTALK = 'DINGTALK',
  WECOM = 'WECOM',
  WEBHOOK = 'WEBHOOK',
}

export interface NotificationChannel {
  /**
   * 获取渠道类型
   */
  getType(): NotificationChannelType;

  /**
   * 发送通知
   * @param recipient 接收人(邮箱地址或 Webhook URL)
   * @param subject 主题
   * @param content 内容
   * @returns 是否发送成功
   */
  send(recipient: string, subject: string, content: string): Promise<boolean>;
}

export abstract class BaseNotificationChannel implements NotificationChannel {
  abstract getType(): NotificationChannelType;
  abstract send(recipient: string, subject: string, content: string): Promise<boolean>;

  /**
   * 记录发送结果
   */
  protected logResult(success: boolean, error?: string): void {
    if (success) {
      console.log(`[${this.getType()}] Notification sent successfully`);
    } else {
      console.error(`[${this.getType()}] Failed to send notification:`, error);
    }
  }
}
