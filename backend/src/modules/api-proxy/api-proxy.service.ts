import axios, { AxiosResponse, Method } from 'axios';
import { FastifyReply, FastifyRequest } from 'fastify';
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
    reply: FastifyReply,
    request?: FastifyRequest
  ) {
    const startTime = Date.now();
    const { url, method, headers, body, timeout } = proxyRequest;

    // 提取策略信息（参考旧代码：ProxyServiceImpl.java:863-909）
    const policySnapshot = request?.policyResult?.matchedPolicy;
    const approvalRequestId = request?.approvalRequestId;

    try {
      // 验证目标URL（参考旧代码：ProxyServiceImpl.java:739）
      this.validateTargetUrl(url);

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
        responseTimeMs: responseTime,
        policySnapshot,
        approvalRequestId
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
        responseTimeMs: responseTime,
        policySnapshot,
        approvalRequestId
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

  /**
   * 验证目标URL（参考旧代码：ProxyServiceImpl.java:687-702）
   * 拒绝内网地址访问
   */
  private validateTargetUrl(url: string): void {
    if (!url || url.trim() === '') {
      throw new Error('Invalid target URL: URL cannot be empty');
    }

    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;

      // 拒绝内网地址（参考旧代码：ProxyServiceImpl.java:696-698）
      if (this.isInternalAddress(host)) {
        throw new Error('Internal address access is forbidden');
      }
    } catch (error: any) {
      if (error.message === 'Internal address access is forbidden') {
        throw error;
      }
      throw new Error('Invalid target URL format');
    }
  }

  /**
   * 检查是否为内网地址（参考旧代码：ProxyServiceImpl.java:710-728）
   */
  private isInternalAddress(host: string): boolean {
    if (!host || host.trim() === '') {
      return false;
    }

    // 检查 localhost（参考旧代码：ProxyServiceImpl.java:716-718）
    if (host.toLowerCase() === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return true;
    }

    // 检查私有IP段（参考旧代码：ProxyServiceImpl.java:720-727）
    // 10.0.0.0/8
    if (/^10\./.test(host)) {
      return true;
    }
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
      return true;
    }
    // 192.168.0.0/16
    if (/^192\.168\./.test(host)) {
      return true;
    }
    // 169.254.0.0/16 (链路本地地址)
    if (/^169\.254\./.test(host)) {
      return true;
    }

    return false;
  }
}
