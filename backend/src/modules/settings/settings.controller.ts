import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/utils/prisma.util';
import { SettingsService } from './settings.service';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  SettingDto,
  UpdateSettingDto,
  BatchUpdateSettingsDto,
} from './settings.types';

const settingsService = new SettingsService(prisma);

export async function settingsRoutes(app: FastifyInstance) {
  // 按分类获取设置
  app.get<{ Params: { category: string } }>(
    '/settings/:category',
    async (request, reply) => {
      const settings = await settingsService.getSettingsByCategory(
        request.params.category
      );
      return ResponseUtil.success(settings);
    }
  );

  // 按 key 获取单个设置
  app.get<{ Params: { category: string; key: string } }>(
    '/settings/:category/:key',
    async (request, reply) => {
      const setting = await settingsService.getSettingByKey(
        request.params.category,
        request.params.key
      );

      if (!setting) {
        return ResponseUtil.error('Setting not found', 404);
      }

      return ResponseUtil.success(setting);
    }
  );

  // 更新单个设置
  app.put<{
    Params: { category: string; key: string };
    Body: UpdateSettingDto;
  }>('/settings/:category/:key', async (request, reply) => {
    const setting = await settingsService.updateSetting(
      request.params.category,
      request.params.key,
      request.body
    );
    return ResponseUtil.success(setting, 'Setting updated successfully');
  });

  // 批量更新设置
  app.put<{
    Params: { category: string };
    Body: BatchUpdateSettingsDto;
  }>('/settings/:category/batch', async (request, reply) => {
    const settings = await settingsService.batchUpdateSettings(
      request.params.category,
      request.body
    );
    return ResponseUtil.success(settings, 'Settings updated successfully');
  });

  // 创建设置
  app.post<{ Body: SettingDto }>('/settings', async (request, reply) => {
    const setting = await settingsService.createSetting(request.body);
    return ResponseUtil.success(setting, 'Setting created successfully');
  });

  // 清除缓存
  app.post<{ Params: { category?: string } }>(
    '/settings/cache/clear',
    async (request, reply) => {
      settingsService.clearCache(request.params.category);
      return ResponseUtil.success(null, 'Cache cleared successfully');
    }
  );
}
