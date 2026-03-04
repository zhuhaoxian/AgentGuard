import axios, { AxiosResponse } from 'axios';
import { FastifyReply, FastifyRequest } from 'fastify';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk
} from './proxy.types';
import { LogService } from '../log/log.service';

const logService = new LogService();

export class ProxyService {
  /**
   * 转发聊天补全请求到 LLM 供应商
   */
  async forwardChatCompletion(
    agentId: string,
    llmApiKey: string,
    llmBaseUrl: string,
    requestBody: ChatCompletionRequest,
    reply: FastifyReply,
    request?: FastifyRequest  // 添加 request 参数以获取策略信息
  ) {
    const startTime = Date.now();
    const isStream = requestBody.stream || false;

    // 构建目标 URL
    const targetUrl = `${llmBaseUrl}/chat/completions`;

    // 提取策略信息
    const policySnapshot = request?.policyResult?.matchedPolicy;
    const approvalRequestId = request?.approvalRequestId;

    try {
      if (isStream) {
        // 流式请求
        return await this.handleStreamRequest(
          agentId,
          llmApiKey,
          targetUrl,
          requestBody,
          reply,
          startTime,
          policySnapshot,
          approvalRequestId
        );
      } else {
        // 非流式请求
        return await this.handleNonStreamRequest(
          agentId,
          llmApiKey,
          targetUrl,
          requestBody,
          reply,
          startTime,
          policySnapshot,
          approvalRequestId
        );
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // 记录错误日志
      await logService.createLog({
        agentId,
        requestType: 'LLM_CALL',
        endpoint: targetUrl,
        method: 'POST',
        requestBody,
        responseBody: error.response?.data || error.message,
        responseStatus: 'ERROR',
        responseTimeMs: responseTime,
        policySnapshot,
        approvalRequestId
      });

      // 返回错误响应
      const statusCode = error.response?.status || 500;
      return reply.status(statusCode).send(
        error.response?.data || {
          error: {
            message: error.message,
            type: 'proxy_error',
            code: 'llm_request_failed'
          }
        }
      );
    }
  }

  /**
   * 处理非流式请求
   */
  private async handleNonStreamRequest(
    agentId: string,
    llmApiKey: string,
    targetUrl: string,
    requestBody: ChatCompletionRequest,
    reply: FastifyReply,
    startTime: number,
    policySnapshot?: any,
    approvalRequestId?: string
  ) {
    const response: AxiosResponse<ChatCompletionResponse> = await axios.post(
      targetUrl,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmApiKey}`
        }
      }
    );

    const responseTime = Date.now() - startTime;
    const responseData = response.data;

    // 记录日志
    await logService.createLog({
      agentId,
      requestType: 'LLM_CALL',
      endpoint: targetUrl,
      method: 'POST',
      requestBody,
      responseBody: responseData,
      responseStatus: 'SUCCESS',
      responseTimeMs: responseTime,
      policySnapshot,
      approvalRequestId
    });

    // 返回响应
    return reply.status(200).send(responseData);
  }

  /**
   * 处理流式请求（SSE）
   * 参考旧代码：ProxyServiceImpl.java:333-349
   */
  private async handleStreamRequest(
    agentId: string,
    llmApiKey: string,
    targetUrl: string,
    requestBody: ChatCompletionRequest,
    reply: FastifyReply,
    startTime: number,
    policySnapshot?: any,
    approvalRequestId?: string
  ) {
    // 修改请求体，添加 stream_options 以获取 token 使用统计
    const modifiedBody = { ...requestBody };
    if (!modifiedBody.stream_options) {
      modifiedBody.stream_options = { include_usage: true };
    }

    const response = await axios.post(targetUrl, modifiedBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmApiKey}`
      },
      responseType: 'stream'
    });

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // 用于缓存完整响应
    const chunks: ChatCompletionChunk[] = [];
    let firstTokenTime: number | null = null;
    let buffer = '';

    response.data.on('data', (chunk: Buffer) => {
      if (!firstTokenTime) {
        firstTokenTime = Date.now() - startTime;
      }

      const chunkStr = chunk.toString();
      buffer += chunkStr;

      // 解析 SSE 数据
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          // 转发给客户端
          reply.raw.write(`data: ${data}\n\n`);

          // 缓存数据（除了 [DONE]）
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data) as ChatCompletionChunk;
              chunks.push(parsed);
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    });

    response.data.on('end', async () => {
      const responseTime = Date.now() - startTime;

      // 构建完整响应用于日志记录
      const fullResponse = this.reconstructStreamResponse(chunks);

      // 记录日志
      await logService.createLog({
        agentId,
        requestType: 'LLM_CALL',
        endpoint: targetUrl,
        method: 'POST',
        requestBody,
        responseBody: fullResponse,
        responseStatus: 'SUCCESS',
        responseTimeMs: responseTime,
        firstTokenTimeMs: firstTokenTime || undefined,
        policySnapshot,
        approvalRequestId
      });

      reply.raw.end();
    });

    response.data.on('error', async (error: Error) => {
      const responseTime = Date.now() - startTime;

      // 记录错误日志
      await logService.createLog({
        agentId,
        requestType: 'LLM_CALL',
        endpoint: targetUrl,
        method: 'POST',
        requestBody,
        responseBody: error.message,
        responseStatus: 'ERROR',
        responseTimeMs: responseTime,
        policySnapshot,
        approvalRequestId
      });

      reply.raw.end();
    });
  }

  /**
   * 从流式 chunks 重构完整响应
   * 参考旧代码：ProxyServiceImpl.java:546-602
   */
  private reconstructStreamResponse(chunks: ChatCompletionChunk[]): any {
    if (chunks.length === 0) return null;

    const firstChunk = chunks[0];
    const lastChunk = chunks[chunks.length - 1];

    // 合并所有 delta 内容
    let content = '';
    let finishReason: string | null = null;
    let usage: any = null;

    for (const chunk of chunks) {
      // 提取内容
      if (chunk.choices?.[0]?.delta?.content) {
        content += chunk.choices[0].delta.content;
      }

      // 提取 finish_reason（从包含 finish_reason 的 chunk 中获取）
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }

      // 提取 usage 信息（通常在最后一个 chunk 中）
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    const response: any = {
      id: firstChunk.id,
      object: 'chat.completion',
      created: firstChunk.created,
      model: firstChunk.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content
          },
          finish_reason: finishReason
        }
      ]
    };

    // 如果有 usage 信息，添加到响应中
    if (usage) {
      response.usage = usage;
    }

    return response;
  }
}

