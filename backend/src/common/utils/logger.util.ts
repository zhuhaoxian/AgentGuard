import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// 确保 logs 目录存在
const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// 获取当前日期字符串 (YYYY-MM-DD)
function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 创建日志配置对象
export function createLoggerConfig() {
  const isDev = process.env.NODE_ENV === 'development';

  // 开发环境：只输出到控制台
  if (isDev) {
    return {
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    };
  }

  // 生产环境：同时输出到控制台和文件
  return {
    level: 'info',
    transport: {
      targets: [
        // 控制台输出
        {
          target: 'pino-pretty',
          level: 'info',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
        // 文件输出 - 所有日志
        {
          target: 'pino-roll',
          level: 'info',
          options: {
            file: join(logsDir, `agent-guard-${getDateString()}`),
            frequency: 'daily',
            size: '10m',
            mkdir: true,
          },
        },
        // 文件输出 - 错误日志
        {
          target: 'pino-roll',
          level: 'error',
          options: {
            file: join(logsDir, `agent-guard-error-${getDateString()}`),
            frequency: 'daily',
            size: '10m',
            mkdir: true,
          },
        },
      ],
    },
  };
}
