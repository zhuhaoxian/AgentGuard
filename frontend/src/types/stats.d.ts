/**
 * 统计相关类型定义
 *
 * @author zhuhx
 */

/** 使用统计概览 */
export interface StatsOverview {
  totalTokens: number
  tokenInput: number
  tokenOutput: number
  totalCalls: number
  agentCount: number
  averageRpm: number
  peakRpm: number
  currentRpm: number
}

/** 使用趋势 */
export interface UsageTrend {
  date: string
  apiCalls: number
  totalTokens: number
  averageRpm: number
  peakRpm: number
}

/** Agent使用趋势（按Agent分组） */
export interface AgentUsageTrend {
  date: string
  agentId: string
  agentName: string
  totalTokens: number
  apiCalls: number
}

/** Agent使用排行 */
export interface AgentUsageRank {
  agentId: string
  agentName: string
  totalTokens: number
  apiCalls: number
  rank: number
  averageRpm: number
  peakRpm: number
}

/** 预算信息 */
export interface Budget {
  id: string
  month: string
  limitAmount: number
  alertThreshold: number
  createdAt: string
  updatedAt: string
}

/** 预算及使用情况 */
export interface BudgetWithUsage {
  id: string
  month: string
  limitAmount: number
  alertThreshold: number
  usedAmount: number
  usagePercentage: number
  remainingAmount: number
  alertTriggered: boolean
  overBudget: boolean
  createdAt: string
  updatedAt: string
}

/** 创建预算请求 */
export interface BudgetCreateDTO {
  month: string
  limitAmount: number
  alertThreshold?: number
}

/** 更新预算请求 */
export interface BudgetUpdateDTO {
  limitAmount?: number
  alertThreshold?: number
}

/** 统计查询参数 */
export interface StatsQueryParams {
  startDate?: string
  endDate?: string
}

/** TOP Agent 查询参数 */
export interface TopAgentsParams {
  limit?: number
  startDate?: string
  endDate?: string
}
