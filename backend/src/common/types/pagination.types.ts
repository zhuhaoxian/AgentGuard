/**
 * 通用分页结果类型
 */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 分页查询参数
 */
export interface PageParams {
  page?: number;
  pageSize?: number;
}

/**
 * 创建分页结果的辅助函数
 */
export function createPageResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PageResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}
