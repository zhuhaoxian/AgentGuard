export interface TokenStatsQuery {
  agentId?: string;
  startDate: string;
  endDate: string;
  model?: string;
}

export interface TokenStatsResponse {
  date: string;
  model: string | null;
  tokenInput: number;
  tokenOutput: number;
  apiCalls: number;
}

export interface UsageTrendQuery {
  agentId?: string;
  startDate: string;
  endDate: string;
  granularity?: 'day' | 'week' | 'month';
}

export interface UsageTrendResponse {
  period: string;
  tokenInput: number;
  tokenOutput: number;
  apiCalls: number;
}

export interface RpmStatsQuery {
  agentId?: string;
  date: string;
}

export interface RpmStatsResponse {
  hour: number;
  minute: number;
  requestCount: number;
}

export interface StatsOverviewQuery {
  startDate?: string;
  endDate?: string;
}

export interface StatsOverviewResponse {
  totalTokens: number;
  tokenInput: number;
  tokenOutput: number;
  totalCalls: number;
  agentCount: number;
  averageRpm: number;
  peakRpm: number;
  currentRpm: number;
}

export interface AgentUsageRankQuery {
  limit?: number | string;
  startDate?: string;
  endDate?: string;
}

export interface AgentUsageRankResponse {
  rank: number;
  agentId: string;
  agentName: string;
  totalTokens: number;
  apiCalls: number;
  averageRpm: number;
  peakRpm: number;
}

export interface TrendsQuery {
  startDate?: string;
  endDate?: string;
}

export interface TrendsResponse {
  date: string;
  apiCalls: number;
  totalTokens: number;
  averageRpm: number;
  peakRpm: number;
}

export interface AgentTrendsQuery {
  startDate?: string;
  endDate?: string;
}

export interface AgentTrendsResponse {
  date: string;
  agentId: string;
  agentName: string;
  totalTokens: number;
  apiCalls: number;
}
