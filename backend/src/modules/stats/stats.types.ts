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
