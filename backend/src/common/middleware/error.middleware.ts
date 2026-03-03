import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { BusinessException } from '../exceptions/business.exception';
import { ResponseUtil } from '../utils/response.util';

export async function errorMiddleware(
  error: FastifyError | BusinessException,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // 记录错误日志
  request.log.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  });

  // 业务异常
  if (error instanceof BusinessException) {
    return reply.status(error.code).send(
      ResponseUtil.error(error.message, error.code)
    );
  }

  // Fastify 验证错误
  if (error.validation) {
    return reply.status(400).send(
      ResponseUtil.error('Validation failed', 400)
    );
  }

  // 默认服务器错误
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : error.message;

  return reply.status(statusCode).send(
    ResponseUtil.error(message, statusCode)
  );
}
