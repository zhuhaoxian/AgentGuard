import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/utils/prisma.util';
import { StatsService } from './stats.service';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  TokenStatsQuery,
  UsageTrendQuery,
  RpmStatsQuery,
} from './stats.types';

const statsService = new StatsService(prisma);

export async function statsRoutes(app: FastifyInstance) {
  // 获取 Token 统计
  app.get<{ Querystring: TokenStatsQuery }>(
    '/stats/tokens',
    async (request, reply) => {
      const stats = await statsService.getTokenStats(request.query);
      return ResponseUtil.success(stats);
    }
  );

  // 获取使用趋势
  app.get<{ Querystring: UsageTrendQuery }>(
    '/stats/usage-trend',
    async (request, reply) => {
      const trend = await statsService.getUsageTrend(request.query);
      return ResponseUtil.success(trend);
    }
  );

  // 获取 RPM 统计
  app.get<{ Querystring: RpmStatsQuery }>(
    '/stats/rpm',
    async (request, reply) => {
      const stats = await statsService.getRpmStats(request.query);
      return ResponseUtil.success(stats);
    }
  );

  // 获取总体统计
  app.get<{ Querystring: { agentId?: string } }>(
    '/stats/overall',
    async (request, reply) => {
      const stats = await statsService.getOverallStats(request.query.agentId);
      return ResponseUtil.success(stats);
    }
  );
}
