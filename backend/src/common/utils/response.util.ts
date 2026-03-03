export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: number;
}

export class ResponseUtil {
  /**
   * 成功响应
   */
  static success<T>(data?: T, message: string = 'Success'): ApiResponse<T> {
    return {
      code: 200,
      message,
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * 失败响应
   */
  static error(message: string, code: number = 500): ApiResponse {
    return {
      code,
      message,
      timestamp: Date.now(),
    };
  }

  /**
   * 分页响应
   */
  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number
  ): ApiResponse<{
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.success({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }
}
