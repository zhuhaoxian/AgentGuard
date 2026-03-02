import axios, { AxiosResponse, Method } from 'axios';
import { FastifyReply } from 'fastify';
import type { ApiProxyRequest } from './api-proxy.types';
import { LogService } from '../log/log.service';

const logService = new LogService();

export class ApiProxyService {
  /**
   * 转发 API 请求到目标服务
   */
  async forwardApiRequest(
    agentId: string,
    proxyRequest: ApiProxyRequest,
    reply: FastifyReply
  ) {
    const startTime = Date.now();
    const { url, method, headers, body, timeout } = proxyRequest;

    try {
      // 发起请求
      const response: AxiosResponse = await axios({
        url,
        method: method.toUpperCase() as Method,
        headers: headers || {},
        data: body,
        timeout: timeout || 30000,
        validateStatus: () => true // 接受所有状态码
      });

      const responseTime = Date.now() - startTime;

      // 记录日志
      await logService.createLog({
        agentId,
        requestType: 'API_CALL',
        endpoint: url,
        method: method.toUpperCase(),
        requestBody: body || {},
        requestHeaders: headers,
        responseBody: response.data,
        responseStatus: 'SUCCESS',
        responseTimeMs: responseTime
      });

      // 返回响应
      return reply
        .status(response.status)
        .headers(this.filterResponseHeaders(response.headers))
        .send(response.data);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // 记录错误日志
      await logService.createLog({
        agentId,
        requestType: 'API_CALL',
        endpoint: url,
        method: method.toUpperCase(),
        requestBody: body || {},
        requestHeaders: headers,
        responseBody: error.response?.data || error.message,
        responseStatus: 'ERROR',
        responseTimeMs: responseTime
      });

      // 返回错误响应
      const statusCode = error.response?.status || 500;
      return reply.status(statusCode).send({
        error: {
          message: error.message,
          type: 'api_proxy_error',
          code: 'api_request_failed',
          details: error.response?.data
        }
      });
    }
  }

  /**
   * 过滤响应头，移除不应该转发的头
   */
  private filterResponseHeaders(headers: Record<string, any>): Record<string, string> {
    const filtered: Record<string, string> = {};
    const excludeHeaders = [
      'transfer-encoding',
      'connection',
      'keep-alive',
      'upgrade',
      'content-encoding'
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (!excludeHeaders.includes(key.toLowerCase()) && value) {
        filtered[key] = String(value);
      }
    }

    return filtered;
  }
}
