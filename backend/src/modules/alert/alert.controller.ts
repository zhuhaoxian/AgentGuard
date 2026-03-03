import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/utils/prisma.util';
import { AlertService } from './alert.service';
import { ResponseUtil } from '../../common/utils/response.util';
import { AlertHistoryQuery, SendAlertDto } from './alert.types';

const alertService = new AlertService(prisma);

export async function alertRoutes(app: FastifyInstance) {
  // 获取告警历史列表
  app.get<{ Querystring: AlertHistoryQuery }>(
    '/alerts',
    async (request, reply) => {
      const query: AlertHistoryQuery = {
        page: request.query.page ? parseInt(request.query.page as any) : 1,
        pageSize: request.query.pageSize
          ? parseInt(request.query.pageSize as any)
          : 20,
        type: request.query.type as string,
        status: request.query.status as string,
      };

      const { alerts, total } = await alertService.getAlertHistory(query);

      return ResponseUtil.paginated(alerts, total, query.page!, query.pageSize!);
    }
  );

  // 获取告警详情
  app.get<{ Params: { id: string } }>('/alerts/:id', async (request, reply) => {
    const alert = await alertService.getAlertById(request.params.id);

    if (!alert) {
      return ResponseUtil.error('Alert not found', 404);
    }

    return ResponseUtil.success(alert);
  });

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
