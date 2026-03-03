import { PrismaClient } from '@prisma/client';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import {
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/business.exception';
import {
  SettingDto,
  UpdateSettingDto,
  SettingResponse,
  BatchUpdateSettingsDto,
  EmailSettingsDto,
  WebhookSettingsDto,
  AlertSettingsDto,
} from './settings.types';
import nodemailer from 'nodemailer';

export class SettingsService {
  private prisma: PrismaClient;
  private cache: Map<string, Map<string, SettingResponse>>;

  private static readonly CATEGORY_EMAIL = 'alert_email';
  private static readonly CATEGORY_WEBHOOK = 'alert_webhook';
  private static readonly CATEGORY_ALERT = 'alert_config';

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.cache = new Map();
  }

  /**
   * 按分类获取设置
   */
  async getSettingsByCategory(category: string): Promise<SettingResponse[]> {
    // 检查缓存
    if (this.cache.has(category)) {
      return Array.from(this.cache.get(category)!.values());
    }

    // 从数据库查询
    const settings = await this.prisma.systemSettings.findMany({
      where: {
        category,
        deleted: false,
      },
    });

    // 解密敏感字段
    const decryptedSettings = settings.map(setting => {
      const response = this.toSettingResponse(setting);
      if (setting.encrypted && setting.settingValue) {
        try {
          response.settingValue = EncryptionUtil.decryptString(setting.settingValue);
        } catch (error) {
          // 解密失败,返回原值
        }
      }
      return response;
    });

    // 更新缓存
    const categoryCache = new Map<string, SettingResponse>();
    decryptedSettings.forEach(setting => {
      categoryCache.set(setting.settingKey, setting);
    });
    this.cache.set(category, categoryCache);

    return decryptedSettings;
  }

  /**
   * 按 key 获取单个设置
   */
  async getSettingByKey(
    category: string,
    settingKey: string
  ): Promise<SettingResponse | null> {
    // 检查缓存
    if (this.cache.has(category)) {
      const categoryCache = this.cache.get(category)!;
      if (categoryCache.has(settingKey)) {
        return categoryCache.get(settingKey)!;
      }
    }

    // 从数据库查询
    const setting = await this.prisma.systemSettings.findFirst({
      where: {
        category,
        settingKey,
        deleted: false,
      },
    });

    if (!setting) {
      return null;
    }

    const response = this.toSettingResponse(setting);

    // 解密敏感字段
    if (setting.encrypted && setting.settingValue) {
      try {
        response.settingValue = EncryptionUtil.decryptString(setting.settingValue);
      } catch (error) {
        // 解密失败,返回原值
      }
    }

    return response;
  }

  /**
   * 更新单个设置
   */
  async updateSetting(
    category: string,
    settingKey: string,
    dto: UpdateSettingDto
  ): Promise<SettingResponse> {
    // 查找设置
    const setting = await this.prisma.systemSettings.findFirst({
      where: {
        category,
        settingKey,
        deleted: false,
      },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    // 如果是加密字段,加密值
    let settingValue = dto.settingValue;
    if (setting.encrypted) {
      settingValue = EncryptionUtil.encryptString(dto.settingValue);
    }

    // 更新设置
    const updatedSetting = await this.prisma.systemSettings.update({
      where: { id: setting.id },
      data: { settingValue },
    });

    // 清除缓存
    this.clearCache(category);

    const response = this.toSettingResponse(updatedSetting);

    // 返回解密后的值
    if (updatedSetting.encrypted && updatedSetting.settingValue) {
      try {
        response.settingValue = EncryptionUtil.decryptString(
          updatedSetting.settingValue
        );
      } catch (error) {
        // 解密失败,返回原值
      }
    }

    return response;
  }

  /**
   * 批量更新设置
   */
  async batchUpdateSettings(
    category: string,
    dto: BatchUpdateSettingsDto
  ): Promise<SettingResponse[]> {
    const results: SettingResponse[] = [];

    for (const item of dto.settings) {
      const result = await this.updateSetting(category, item.settingKey, {
        settingValue: item.settingValue,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * 创建设置
   */
  async createSetting(dto: SettingDto): Promise<SettingResponse> {
    // 检查是否已存在
    const existing = await this.prisma.systemSettings.findFirst({
      where: {
        category: dto.category,
        settingKey: dto.settingKey,
        deleted: false,
      },
    });

    if (existing) {
      throw new ValidationException('Setting already exists');
    }

    // 如果是加密字段,加密值
    let settingValue = dto.settingValue;
    if (dto.encrypted) {
      settingValue = EncryptionUtil.encryptString(dto.settingValue);
    }

    // 创建设置
    const setting = await this.prisma.systemSettings.create({
      data: {
        settingKey: dto.settingKey,
        settingValue,
        category: dto.category,
        description: dto.description,
        encrypted: dto.encrypted || false,
      },
    });

    // 清除缓存
    this.clearCache(dto.category);

    const response = this.toSettingResponse(setting);

    // 返回解密后的值
    if (setting.encrypted && setting.settingValue) {
      try {
        response.settingValue = EncryptionUtil.decryptString(setting.settingValue);
      } catch (error) {
        // 解密失败,返回原值
      }
    }

    return response;
  }

  /**
   * 清除缓存
   */
  clearCache(category?: string): void {
    if (category) {
      this.cache.delete(category);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 转换为设置响应对象
   */
  private toSettingResponse(setting: any): SettingResponse {
    return {
      id: setting.id,
      settingKey: setting.settingKey,
      settingValue: setting.settingValue,
      category: setting.category,
      description: setting.description,
      encrypted: setting.encrypted,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    };
  }

  // ==================== 邮件通知配置 ====================

  /**
   * 获取邮件通知配置
   */
  async getEmailSettings(): Promise<EmailSettingsDto> {
    const settings = await this.getSettingsMap(SettingsService.CATEGORY_EMAIL);
    return {
      enabled: this.parseBoolean(settings.get('enabled'), false),
      smtpHost: settings.get('smtp_host'),
      smtpPort: this.parseInteger(settings.get('smtp_port'), 587),
      fromEmail: settings.get('from_email'),
      fromName: settings.get('from_name'),
      username: settings.get('username'),
      password: settings.get('password'),
      sslEnabled: this.parseBoolean(settings.get('ssl_enabled'), true),
      defaultRecipients: settings.get('default_recipients'),
    };
  }

  /**
   * 更新邮件通知配置
   */
  async updateEmailSettings(dto: EmailSettingsDto): Promise<void> {
    const settings: Record<string, any> = {};
    if (dto.enabled !== undefined) settings.enabled = dto.enabled;
    if (dto.smtpHost !== undefined) settings.smtp_host = dto.smtpHost;
    if (dto.smtpPort !== undefined) settings.smtp_port = dto.smtpPort;
    if (dto.fromEmail !== undefined) settings.from_email = dto.fromEmail;
    if (dto.fromName !== undefined) settings.from_name = dto.fromName;
    if (dto.username !== undefined) settings.username = dto.username;
    if (dto.password !== undefined) settings.password = dto.password;
    if (dto.sslEnabled !== undefined) settings.ssl_enabled = dto.sslEnabled;
    if (dto.defaultRecipients !== undefined)
      settings.default_recipients = dto.defaultRecipients;

    await this.saveSettings(SettingsService.CATEGORY_EMAIL, settings);
  }

  /**
   * 测试邮件配置
   */
  async testEmailSettings(dto: EmailSettingsDto): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: dto.smtpHost,
        port: dto.smtpPort,
        secure: dto.sslEnabled && dto.smtpPort === 465, // 465端口使用SSL
        auth: {
          user: dto.username,
          pass: dto.password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // 测试连接
      await transporter.verify();
      return true;
    } catch (error) {
      console.error('邮件配置测试失败:', error);
      return false;
    }
  }

  // ==================== Webhook通知配置 ====================

  /**
   * 获取Webhook通知配置
   */
  async getWebhookSettings(): Promise<WebhookSettingsDto> {
    const settings = await this.getSettingsMap(
      SettingsService.CATEGORY_WEBHOOK
    );
    return {
      dingTalkEnabled: this.parseBoolean(settings.get('dingtalk_enabled'), false),
      dingTalkWebhook: settings.get('dingtalk_webhook'),
      dingTalkSecret: settings.get('dingtalk_secret'),
      weComEnabled: this.parseBoolean(settings.get('wecom_enabled'), false),
      weComWebhook: settings.get('wecom_webhook'),
      customWebhookEnabled: this.parseBoolean(
        settings.get('custom_webhook_enabled'),
        false
      ),
      customWebhookUrl: settings.get('custom_webhook_url'),
      customWebhookSecret: settings.get('custom_webhook_secret'),
    };
  }

  /**
   * 更新Webhook通知配置
   */
  async updateWebhookSettings(dto: WebhookSettingsDto): Promise<void> {
    const settings: Record<string, any> = {};
    if (dto.dingTalkEnabled !== undefined)
      settings.dingtalk_enabled = dto.dingTalkEnabled;
    if (dto.dingTalkWebhook !== undefined)
      settings.dingtalk_webhook = dto.dingTalkWebhook;
    if (dto.dingTalkSecret !== undefined)
      settings.dingtalk_secret = dto.dingTalkSecret;
    if (dto.weComEnabled !== undefined)
      settings.wecom_enabled = dto.weComEnabled;
    if (dto.weComWebhook !== undefined)
      settings.wecom_webhook = dto.weComWebhook;
    if (dto.customWebhookEnabled !== undefined)
      settings.custom_webhook_enabled = dto.customWebhookEnabled;
    if (dto.customWebhookUrl !== undefined)
      settings.custom_webhook_url = dto.customWebhookUrl;
    if (dto.customWebhookSecret !== undefined)
      settings.custom_webhook_secret = dto.customWebhookSecret;

    await this.saveSettings(SettingsService.CATEGORY_WEBHOOK, settings);
  }

  // ==================== 告警配置 ====================

  /**
   * 获取告警配置
   */
  async getAlertSettings(): Promise<AlertSettingsDto> {
    const settings = await this.getSettingsMap(SettingsService.CATEGORY_ALERT);
    return {
      rpmAlertEnabled: this.parseBoolean(settings.get('rpm_alert_enabled'), true),
      rpmThreshold: this.parseInteger(settings.get('rpm_threshold'), 100),
      rpmAlertCooldownMinutes: this.parseInteger(
        settings.get('rpm_alert_cooldown_minutes'),
        60
      ),
      errorRateAlertEnabled: this.parseBoolean(
        settings.get('error_rate_alert_enabled'),
        true
      ),
      errorRateThreshold: this.parseInteger(
        settings.get('error_rate_threshold'),
        10
      ),
      errorRateWindow: this.parseInteger(settings.get('error_rate_window'), 60),
      errorRateAlertCooldownMinutes: this.parseInteger(
        settings.get('error_rate_alert_cooldown_minutes'),
        30
      ),
      approvalReminderEnabled: this.parseBoolean(
        settings.get('approval_reminder_enabled'),
        true
      ),
      approvalReminderMinutes: this.parseInteger(
        settings.get('approval_reminder_minutes'),
        30
      ),
      approvalReminderCooldownMinutes: this.parseInteger(
        settings.get('approval_reminder_cooldown_minutes'),
        10
      ),
      approvalExpirationMinutes: this.parseInteger(
        settings.get('approval_expiration_minutes'),
        60
      ),
    };
  }

  /**
   * 更新告警配置
   */
  async updateAlertSettings(dto: AlertSettingsDto): Promise<void> {
    const settings: Record<string, any> = {};
    if (dto.rpmAlertEnabled !== undefined)
      settings.rpm_alert_enabled = dto.rpmAlertEnabled;
    if (dto.rpmThreshold !== undefined)
      settings.rpm_threshold = dto.rpmThreshold;
    if (dto.rpmAlertCooldownMinutes !== undefined)
      settings.rpm_alert_cooldown_minutes = dto.rpmAlertCooldownMinutes;
    if (dto.errorRateAlertEnabled !== undefined)
      settings.error_rate_alert_enabled = dto.errorRateAlertEnabled;
    if (dto.errorRateThreshold !== undefined)
      settings.error_rate_threshold = dto.errorRateThreshold;
    if (dto.errorRateWindow !== undefined)
      settings.error_rate_window = dto.errorRateWindow;
    if (dto.errorRateAlertCooldownMinutes !== undefined)
      settings.error_rate_alert_cooldown_minutes =
        dto.errorRateAlertCooldownMinutes;
    if (dto.approvalReminderEnabled !== undefined)
      settings.approval_reminder_enabled = dto.approvalReminderEnabled;
    if (dto.approvalReminderMinutes !== undefined)
      settings.approval_reminder_minutes = dto.approvalReminderMinutes;
    if (dto.approvalReminderCooldownMinutes !== undefined)
      settings.approval_reminder_cooldown_minutes =
        dto.approvalReminderCooldownMinutes;
    if (dto.approvalExpirationMinutes !== undefined)
      settings.approval_expiration_minutes = dto.approvalExpirationMinutes;

    await this.saveSettings(SettingsService.CATEGORY_ALERT, settings);
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取指定分类的所有设置（Map格式）
   */
  private async getSettingsMap(category: string): Promise<Map<string, string>> {
    const settings = await this.getSettingsByCategory(category);
    const map = new Map<string, string>();
    settings.forEach(setting => {
      if (setting.settingValue) {
        map.set(setting.settingKey, setting.settingValue);
      }
    });
    return map;
  }

  /**
   * 保存设置
   */
  private async saveSettings(
    category: string,
    settings: Record<string, any>
  ): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined || value === null) {
        continue;
      }

      // 查找是否已存在
      const existing = await this.prisma.systemSettings.findFirst({
        where: {
          category,
          settingKey: key,
          deleted: false,
        },
      });

      // 判断是否需要加密
      const needsEncryption =
        key.includes('password') || key.includes('secret');
      const settingValue = needsEncryption
        ? EncryptionUtil.encryptString(String(value))
        : String(value);

      if (existing) {
        // 更新
        await this.prisma.systemSettings.update({
          where: { id: existing.id },
          data: { settingValue },
        });
      } else {
        // 新增
        await this.prisma.systemSettings.create({
          data: {
            category,
            settingKey: key,
            settingValue,
            encrypted: needsEncryption,
          },
        });
      }
    }

    // 清除缓存
    this.clearCache(category);
  }

  /**
   * 解析布尔值
   */
  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    return value === 'true' || value === '1';
  }

  /**
   * 解析整数
   */
  private parseInteger(
    value: string | undefined,
    defaultValue: number
  ): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}
