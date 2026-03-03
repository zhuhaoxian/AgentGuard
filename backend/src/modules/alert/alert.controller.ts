import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/utils/prisma.util';
import { AlertService } from './alert.service';
import { ResponseUtil } from '../../common/utils/response.util';
import { AlertHistoryQuery, SendAlertDto } from './alert.types';

const alertService = new AlertService(prisma);

export async function alertRoutes(app: FastifyInstance) {
  // 获取告警历史列表
  app.get<{ Querystring: AlertHistoryQuery }>(
    '/alerts/history',
    async (request, reply) => {
      const query: AlertHistoryQuery = {
        page: request.query.page ? parseInt(request.query.page as any) : 1,
        pageSize: request.query.pageSize
          ? parseInt(request.query.pageSize as any)
          : 20,
        type: request.query.type as string,
        status: request.query.status as string,
        startTime: request.query.startTime as string,
        endTime: request.query.endTime as string,
      };

      const { alerts, total } = await alertService.getAlertHistory(query);

      return ResponseUtil.paginated(alerts, total, query.page!, query.pageSize!);
    }
  );

  // 获取告警详情
  app.get<{ Params: { id: string } }>(
    '/alerts/history/:id',
    async (request, reply) => {
      const alert = await alertService.getAlertById(request.params.id);

      if (!alert) {
        return ResponseUtil.error('Alert not found', 404);
      }

      return ResponseUtil.success(alert);
    }
  );

  // 统计告警数量
  app.get<{ Querystring: AlertHistoryQuery }>(
    '/alerts/history/count',
    async (request, reply) => {
      const query: AlertHistoryQuery = {
        type: request.query.type as string,
        status: request.query.status as string,
        startTime: request.query.startTime as string,
        endTime: request.query.endTime as string,
      };

      const count = await alertService.countAlerts(query);

      return ResponseUtil.success({ count });
    }
  );

  // 导出告警历史
  app.get<{ Querystring: AlertHistoryQuery }>(
    '/alerts/history/export',
    async (request, reply) => {
      const query: AlertHistoryQuery = {
        type: request.query.type as string,
        status: request.query.status as string,
        startTime: request.query.startTime as string,
        endTime: request.query.endTime as string,
      };

      const alerts = await alertService.exportAlerts(query);

      return ResponseUtil.success(alerts);
    }
  );

  // 获取最近的告警历史
  app.get<{ Querystring: { limit?: string } }>(
    '/alerts/history/recent',
    async (request, reply) => {
      const limit = request.query.limit
        ? parseInt(request.query.limit)
        : 10;

      const alerts = await alertService.getRecentAlerts(limit);

      return ResponseUtil.success(alerts);
    }
  );

  // 创建告警(手动发送)
  app.post<{ Body: SendAlertDto }>('/alerts', async (request, reply) => {
    const alert = await alertService.createAlert(request.body);
    return ResponseUtil.success(alert, 'Alert sent successfully');
  });

  // 获取告警统计
  app.get('/alerts/stats/summary', async (request, reply) => {
    const stats = await alertService.getAlertStats();
    return ResponseUtil.success(stats);
  });
}
