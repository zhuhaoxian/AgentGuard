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

  // 开发环境和生产环境都输出到控制台和文件
  return {
    level: isDev ? 'debug' : 'info',
    // 自定义时间戳格式化
    timestamp: () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      return `,"time":"${year}-${month}-${day} ${hours}:${minutes}:${seconds}"`;
    },
    transport: {
      targets: [
        // 控制台输出
        {
          target: 'pino-pretty',
          level: isDev ? 'debug' : 'info',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
        // 文件输出 - 所有日志
        {
          target: 'pino/file',
          level: isDev ? 'debug' : 'info',
          options: {
            destination: join(logsDir, `agent-guard-${getDateString()}.log`),
            mkdir: true,
          },
        },
        // 文件输出 - 错误日志
        {
          target: 'pino/file',
          level: 'error',
          options: {
            destination: join(logsDir, `agent-guard-error-${getDateString()}.log`),
            mkdir: true,
          },
        },
      ],
    },
  };
}
