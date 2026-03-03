import { prisma } from '../../common/utils/prisma.util';
import { formatDateTime } from '../../common/utils/date.util';
import type { ChatCompletionRequest, ChatCompletionResponse } from '../proxy/proxy.types';
import { StatsService } from '../stats/stats.service';

export interface LogData {
  agentId: string;
  requestType: string;
  endpoint: string;
  method: string;
  requestBody: ChatCompletionRequest;
  requestHeaders?: Record<string, any>;
  responseBody?: ChatCompletionResponse | string;
  responseStatus: string;
  responseTimeMs?: number;
  firstTokenTimeMs?: number;
  tokenInput?: number;
  tokenOutput?: number;
  model?: string;
  finishReason?: string;
  toolCalls?: string;
}

export interface LogQueryParams {
  agentId?: string;
  responseStatus?: string;
  requestType?: string;
  page: number;
  pageSize: number;
}

export class LogService {
  private statsService: StatsService;

  constructor() {
    this.statsService = new StatsService(prisma);
  }

  async createLog(data: LogData) {
    try {
      // 提取请求摘要
      const requestSummary = {
        model: data.requestBody.model,
        stream: data.requestBody.stream || false,
        messageCount: data.requestBody.messages?.length || 0
      };

      // 解析 token 使用量
      let tokenInput = data.tokenInput;
      let tokenOutput = data.tokenOutput;
      let finishReason = data.finishReason;

      if (data.responseBody && typeof data.responseBody === 'object') {
        const response = data.responseBody as ChatCompletionResponse;
        if (response.usage) {
          tokenInput = response.usage.prompt_tokens;
          tokenOutput = response.usage.completion_tokens;
        }
        if (response.choices?.[0]?.finish_reason) {
          finishReason = response.choices[0].finish_reason;
        }
      }

      await prisma.agentLog.create({
        data: {
          agentId: data.agentId,
          requestType: data.requestType,
          endpoint: data.endpoint,
          method: data.method,
          requestSummary: requestSummary as any,
          requestHeaders: data.requestHeaders as any,
          requestBody: data.requestBody as any,
          responseBody: data.responseBody as any,
          responseStatus: data.responseStatus,
          responseTimeMs: data.responseTimeMs,
          firstTokenTimeMs: data.firstTokenTimeMs,
          tokenInput: tokenInput || null,
          tokenOutput: tokenOutput || null,
          model: data.model || data.requestBody.model,
          finishReason: finishReason || null,
          toolCalls: data.toolCalls || null
        }
      });

      // 同步更新使用记录
      const isApiCall = data.requestType === 'API_CALL' || data.requestType === 'LLM_CALL';
      await Promise.all([
        this.statsService.updateUsageRecord(
          data.agentId,
          data.model || data.requestBody.model,
          tokenInput,
          tokenOutput,
          isApiCall
        ),
        this.statsService.updateRpmStats(data.agentId)
      ]);
    } catch (error) {
      console.error('Failed to create log:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  async getLogs(params: LogQueryParams) {
    const { agentId, responseStatus, requestType, page, pageSize } = params;

    // 构建查询条件
    const where: any = {};
    if (agentId) {
      where.agentId = agentId;
    }
    if (responseStatus) {
      where.responseStatus = responseStatus;
    }
    if (requestType) {
      where.requestType = requestType;
    }

    // 查询总数
    const total = await prisma.agentLog.count({ where });

    // 查询列表
    const items = await prisma.agentLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        agent: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // 格式化日期
    const formattedItems = items.map(item => ({
      ...item,
      createdAt: formatDateTime(item.createdAt),
      agentName: item.agent.name
    }));

    return {
      items: formattedItems,
      total,
      page,
      pageSize
    };
  }

  async getLogById(id: string) {
    const log = await prisma.agentLog.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!log) {
      return null;
    }

    // 格式化日期
    return {
      ...log,
      createdAt: formatDateTime(log.createdAt),
      agentName: log.agent.name
    };
  }
}

