// API 代理请求类型
export interface ApiProxyRequest {
  url: string;                    // 目标 URL
  method: string;                 // HTTP 方法
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

// API 代理响应类型
export interface ApiProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
}
