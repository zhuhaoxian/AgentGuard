export interface CreateAgentDto {
  name: string;
  description?: string;
  llmProvider?: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
}

export interface UpdateAgentDto {
  name?: string;
  description?: string;
  llmProvider?: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  status?: number;
}

export interface AgentResponse {
  id: string;
  name: string;
  apiKey: string;
  description: string | null;
  llmProvider: string | null;
  llmApiKey: string | null;
  llmBaseUrl: string | null;
  llmModel: string | null;
  status: number;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentListQuery {
  page?: number;
  pageSize?: number;
  status?: number;
  keyword?: string;
}
