export interface Result<T = any> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  items: T[]
  total: number
  pageSize: number
  page: number
  totalPages: number
}
