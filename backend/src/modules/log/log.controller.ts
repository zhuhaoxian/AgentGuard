import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LogService } from './log.service';
import { ResponseUtil } from '../../common/utils/response.util';

/**
 * 日志控制器
 */
export async function logController(app: FastifyInstance, logService: LogService) {
  /**
   * 获取日志列表
   */
  app.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    const result = await logService.getLogs({
      agentId: query.agentId,
      responseStatus: query.responseStatus,
      requestType: query.requestType,
      page: query.page ? parseInt(query.page) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
    });

    return ResponseUtil.paginated(
      result.items,
      result.total,
      result.page,
      result.pageSize
    );
  });

  /**
   * 获取日志详情
   */
  app.get('/logs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const log = await logService.getLogById(id);

    if (!log) {
      return ResponseUtil.error('Log not found', 404);
    }

    return ResponseUtil.success(log);
  });
}
