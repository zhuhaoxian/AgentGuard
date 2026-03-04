/**
 * 数据脱敏工具类
 * 用于脱敏日志中的敏感信息，防止泄露 API Key、密码等敏感数据
 */
export class DataMaskingUtil {
  /**
   * 敏感字段列表（小写）
   */
  private static readonly SENSITIVE_FIELDS = [
    'authorization',
    'api-key',
    'x-api-key',
    'x-agentguard-auth',
    'token',
    'password',
    'secret',
    'apikey',
    'accesstoken',
    'apiSecret',
    'privateKey',
  ];

  /**
   * 脱敏 API Key
   * 保留前7位和后4位，中间用 *** 替换
   * 例如: sk-proj-abc123xyz → sk-proj-***xyz
   *
   * @param key API Key
   * @returns 脱敏后的 API Key
   */
  static maskApiKey(key: string): string {
    if (!key || key.length <= 11) {
      return '***';
    }

    const prefix = key.substring(0, 7);
    const suffix = key.substring(key.length - 4);
    return `${prefix}***${suffix}`;
  }

  /**
   * 脱敏请求头
   * 对敏感字段进行脱敏处理
   *
   * @param headers 原始请求头
   * @returns 脱敏后的请求头
   */
  static maskHeaders(headers: Record<string, any>): Record<string, any> {
    if (!headers || typeof headers !== 'object') {
      return headers;
    }

    const masked: Record<string, any> = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();

      // 检查是否为敏感字段
      if (this.SENSITIVE_FIELDS.includes(lowerKey)) {
        if (typeof value === 'string') {
          // 特殊处理 Authorization 头
          if (lowerKey === 'authorization' && value.startsWith('Bearer ')) {
            const token = value.substring(7);
            masked[key] = `Bearer ${this.maskApiKey(token)}`;
          } else {
            masked[key] = this.maskApiKey(value);
          }
        } else {
          masked[key] = '***';
        }
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * 脱敏请求体
   * 递归处理嵌套对象，对敏感字段进行脱敏
   *
   * @param body 原始请求体
   * @returns 脱敏后的请求体
   */
  static maskRequestBody(body: any): any {
    if (!body) {
      return body;
    }

    // 处理数组
    if (Array.isArray(body)) {
      return body.map(item => this.maskRequestBody(item));
    }

    // 处理对象
    if (typeof body === 'object') {
      const masked: Record<string, any> = {};

      for (const [key, value] of Object.entries(body)) {
        const lowerKey = key.toLowerCase();

        // 检查是否为敏感字段
        if (this.SENSITIVE_FIELDS.includes(lowerKey)) {
          if (typeof value === 'string') {
            masked[key] = this.maskApiKey(value);
          } else {
            masked[key] = '***';
          }
        } else if (typeof value === 'object') {
          // 递归处理嵌套对象
          masked[key] = this.maskRequestBody(value);
        } else {
          masked[key] = value;
        }
      }

      return masked;
    }

    // 其他类型直接返回
    return body;
  }

  /**
   * 脱敏响应体
   * 与请求体脱敏逻辑相同
   *
   * @param body 原始响应体
   * @returns 脱敏后的响应体
   */
  static maskResponseBody(body: any): any {
    return this.maskRequestBody(body);
  }

  /**
   * 完整的日志数据脱敏
   * 同时脱敏请求头、请求体和响应体
   *
   * @param data 日志数据
   * @returns 脱敏后的日志数据
   */
  static maskLogData(data: {
    requestHeaders?: Record<string, any>;
    requestBody?: any;
    responseBody?: any;
  }): {
    requestHeaders?: Record<string, any>;
    requestBody?: any;
    responseBody?: any;
  } {
    return {
      requestHeaders: data.requestHeaders
        ? this.maskHeaders(data.requestHeaders)
        : undefined,
      requestBody: data.requestBody
        ? this.maskRequestBody(data.requestBody)
        : undefined,
      responseBody: data.responseBody
        ? this.maskResponseBody(data.responseBody)
        : undefined,
    };
  }
}
