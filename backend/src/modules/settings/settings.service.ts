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
} from './settings.types';

export class SettingsService {
  private prisma: PrismaClient;
  private cache: Map<string, Map<string, SettingResponse>>;

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
}
