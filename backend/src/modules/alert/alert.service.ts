import { PrismaClient } from '@prisma/client';
import {
  AlertHistoryQuery,
  AlertHistoryResponse,
  SendAlertDto,
} from './alert.types';

export class AlertService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 获取告警历史列表
   */
  async getAlertHistory(
    query: AlertHistoryQuery
  ): Promise<{ alerts: AlertHistoryResponse[]; total: number }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [alerts, total] = await Promise.all([
      this.prisma.alertHistory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.alertHistory.count({ where }),
    ]);

    return {
      alerts: alerts.map(alert => this.toAlertResponse(alert)),
      total,
    };
  }

  /**
   * 获取告警详情
   */
  async getAlertById(id: string): Promise<AlertHistoryResponse | null> {
    const alert = await this.prisma.alertHistory.findUnique({
      where: { id },
    });

    if (!alert) {
      return null;
    }

    return this.toAlertResponse(alert);
  }

  /**
   * 创建告警记录
   */
  async createAlert(dto: SendAlertDto): Promise<AlertHistoryResponse> {
    const alert = await this.prisma.alertHistory.create({
      data: {
        type: dto.type,
        title: dto.title,
        content: dto.content,
        channelType: dto.channelType,
        status: 'SUCCESS',
        sentAt: new Date(),
      },
    });

    return this.toAlertResponse(alert);
  }

  /**
   * 获取告警统计
   */
  async getAlertStats() {
    const [total, todayCount, failedCount] = await Promise.all([
      this.prisma.alertHistory.count(),
      this.prisma.alertHistory.count({
        where: {
          createdAt: {
            gte: new Date(new Date().toISOString().split('T')[0]),
          },
        },
      }),
      this.prisma.alertHistory.count({
        where: { status: 'FAILED' },
      }),
    ]);

    return {
      total,
      todayCount,
      failedCount,
    };
  }

  /**
   * 转换为告警响应对象
   */
  private toAlertResponse(alert: any): AlertHistoryResponse {
    return {
      id: alert.id,
      ruleId: alert.ruleId,
      type: alert.type,
      title: alert.title,
      content: alert.content,
      channelType: alert.channelType,
      channelDetails: alert.channelDetails,
      status: alert.status,
      errorMessage: alert.errorMessage,
      sentAt: alert.sentAt,
      createdAt: alert.createdAt,
    };
  }
}
