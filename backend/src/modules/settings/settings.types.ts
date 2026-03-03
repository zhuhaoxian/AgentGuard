export interface SettingDto {
  settingKey: string;
  settingValue: string;
  category: string;
  description?: string;
  encrypted?: boolean;
}

export interface UpdateSettingDto {
  settingValue: string;
}

export interface SettingResponse {
  id: string;
  settingKey: string;
  settingValue: string | null;
  category: string;
  description: string | null;
  encrypted: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BatchUpdateSettingsDto {
  settings: Array<{
    settingKey: string;
    settingValue: string;
  }>;
}

// ==================== 邮件通知配置 ====================
export interface EmailSettingsDto {
  enabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  fromEmail?: string;
  fromName?: string;
  username?: string;
  password?: string;
  sslEnabled?: boolean;
  defaultRecipients?: string;
}

// ==================== Webhook通知配置 ====================
export interface WebhookSettingsDto {
  dingTalkEnabled?: boolean;
  dingTalkWebhook?: string;
  dingTalkSecret?: string;
  weComEnabled?: boolean;
  weComWebhook?: string;
  customWebhookEnabled?: boolean;
  customWebhookUrl?: string;
  customWebhookSecret?: string;
}

// ==================== 告警配置 ====================
export interface AlertSettingsDto {
  rpmAlertEnabled?: boolean;
  rpmThreshold?: number;
  rpmAlertCooldownMinutes?: number;
  errorRateAlertEnabled?: boolean;
  errorRateThreshold?: number;
  errorRateWindow?: number;
  errorRateAlertCooldownMinutes?: number;
  approvalReminderEnabled?: boolean;
  approvalReminderMinutes?: number;
  approvalReminderCooldownMinutes?: number;
  approvalExpirationMinutes?: number;
}
