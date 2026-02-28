/**
 * 统计分析 API 请求封装
 *
 * @author zhuhx
 */
import request from '@/utils/request'
import type {
  StatsOverview,
  UsageTrend,
  AgentUsageTrend,
  AgentUsageRank,
  StatsQueryParams,
  TopAgentsParams,
  BudgetWithUsage
} from '@/types/stats'

/**
 * 获取使用统计概览
 */
export function getStatsOverview(params?: StatsQueryParams): Promise<StatsOverview> {
  return request.get('/stats/overview', { params })
}

/**
 * 获取使用趋势
 */
export function getUsageTrends(params?: StatsQueryParams): Promise<UsageTrend[]> {
  return request.get('/stats/trends', { params })
}

/**
 * 获取 TOP Agent 使用排行
 */
export function getTopAgents(params?: TopAgentsParams): Promise<AgentUsageRank[]> {
  return request.get('/stats/top-agents', { params })
}

/**
 * 获取 Agent 使用趋势（按 Agent 分组，用于堆叠图）
 */
export function getAgentTrends(params?: StatsQueryParams): Promise<AgentUsageTrend[]> {
  return request.get('/stats/agent-trends', { params })
}

/**
 * 获取当月预算及使用情况
 */
export function getCurrentBudget(): Promise<BudgetWithUsage> {
  return request.get('/budgets/current')
}
