import { FastifyInstance } from 'fastify';
import { LogService } from './log.service';
import { logController } from './log.controller';

export async function logRoutes(app: FastifyInstance) {
  const logService = new LogService();
  await logController(app, logService);
}
