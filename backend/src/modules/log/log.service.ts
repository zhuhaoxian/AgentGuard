import { prisma } from '../../common/utils/prisma.util';
import type { ChatCompletionRequest, ChatCompletionResponse } from '../proxy/proxy.types';

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

export class LogService {
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
    } catch (error) {
      console.error('Failed to create log:', error);
      // 不抛出错误，避免影响主流程
    }
  }
}
