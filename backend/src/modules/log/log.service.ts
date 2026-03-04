import { prisma } from '../../common/utils/prisma.util';
import { formatDateTime } from '../../common/utils/date.util';
import type { ChatCompletionRequest, ChatCompletionResponse } from '../proxy/proxy.types';
import { StatsService } from '../stats/stats.service';
import { DataMaskingUtil } from '../../common/utils/data-masking.util';

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
  policySnapshot?: any;        // 策略快照
  approvalRequestId?: string;  // 审批请求ID
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
    console.log(`[LogService] 开始记录日志: agentId=${data.agentId}, requestType=${data.requestType}`);

    try {
      // 提取请求摘要
      const requestSummary = {
        model: data.requestBody.model,
        stream: data.requestBody.stream || false,
        messageCount: data.requestBody.messages?.length || 0
      };

      // 解析 token 使用量、finish_reason 和 tool_calls（参考旧代码：ProxyServiceImpl.java:1226-1322）
      let tokenInput = data.tokenInput;
      let tokenOutput = data.tokenOutput;
      let finishReason = data.finishReason;
      let toolCalls = data.toolCalls;

      if (data.responseBody && typeof data.responseBody === 'object') {
        const response = data.responseBody as ChatCompletionResponse;

        // 提取 token 使用量
        if (response.usage) {
          tokenInput = response.usage.prompt_tokens;
          tokenOutput = response.usage.completion_tokens;
        }

        // 提取 finish_reason 和 tool_calls（参考旧代码：ProxyServiceImpl.java:1248-1318）
        if (response.choices?.[0]) {
          const firstChoice = response.choices[0];

          // 提取 finish_reason
          if (firstChoice.finish_reason) {
            finishReason = firstChoice.finish_reason;
          }

          // 如果 finish_reason 是 tool_calls，提取工具名称
          if (finishReason === 'tool_calls' && firstChoice.message?.tool_calls) {
            const toolNames = firstChoice.message.tool_calls
              .map((tc: any) => tc.function?.name)
              .filter((name: string) => name)
              .join(', ');

            if (toolNames) {
              toolCalls = toolNames;
            }
          }
        }
      }

      console.log(`[LogService] 准备脱敏数据...`);

      // 脱敏敏感数据
      const maskedData = DataMaskingUtil.maskLogData({
        requestHeaders: data.requestHeaders,
        requestBody: data.requestBody,
        responseBody: data.responseBody
      });

      console.log(`[LogService] 准备写入数据库...`);

      // 构建数据对象，只包含非 undefined 的字段
      const logData: any = {
        agentId: data.agentId,
        requestType: data.requestType,
        endpoint: data.endpoint,
        method: data.method,
        requestSummary: requestSummary as any,
        requestHeaders: maskedData.requestHeaders as any,
        requestBody: maskedData.requestBody as any,
        responseBody: maskedData.responseBody as any,
        responseStatus: data.responseStatus,
        responseTimeMs: data.responseTimeMs,
        model: data.model || data.requestBody.model,
      };

      // 只有非 null/undefined 时才添加这些字段
      if (data.firstTokenTimeMs != null) {
        logData.firstTokenTimeMs = data.firstTokenTimeMs;
      }
      if (tokenInput != null) {
        logData.tokenInput = tokenInput;
      }
      if (tokenOutput != null) {
        logData.tokenOutput = tokenOutput;
      }
      if (finishReason) {
        logData.finishReason = finishReason;
      }
      if (toolCalls) {
        logData.toolCalls = toolCalls;
      }
      if (data.policySnapshot) {
        logData.policySnapshot = data.policySnapshot as any;
      }
      if (data.approvalRequestId) {
        logData.approvalRequestId = data.approvalRequestId;
      }

      const logRecord = await prisma.agentLog.create({
        data: logData
      });

      console.log(`[LogService] ✓ 日志记录成功: id=${logRecord.id}, agentId=${data.agentId}, requestType=${data.requestType}, responseStatus=${data.responseStatus}, finishReason=${finishReason}, toolCalls=${toolCalls}`);

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

      console.log(`[LogService] ✓ 统计数据更新成功`);
    } catch (error) {
      console.error('[LogService] ✗ 记录日志失败:', error);
      console.error('[LogService] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[LogService] 日志数据:', JSON.stringify({
        agentId: data.agentId,
        requestType: data.requestType,
        endpoint: data.endpoint,
        responseStatus: data.responseStatus
      }));
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

  /**
   * 根据审批ID更新日志状态
   * 用于审批通过后同步更新关联的日志状态
   *
   * @param approvalId 审批请求ID
   * @param status 新的状态
   */
  async updateLogStatusByApprovalId(approvalId: string, status: string): Promise<void> {
    try {
      await prisma.agentLog.updateMany({
        where: {
          approvalRequestId: approvalId
        },
        data: {
          responseStatus: status
        }
      });
    } catch (error) {
      console.error('Failed to update log status by approval ID:', error);
      // 不抛出错误，避免影响主流程
    }
  }
}

