import { PrismaClient } from '@prisma/client';

// 创建全局 Prisma Client 单例
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    // Prisma 7 直接使用环境变量中的 DATABASE_URL
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });
  }
  return prismaInstance;
}

// 导出单例实例
export const prisma = getPrismaClient();

// 优雅关闭
export async function disconnectPrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
