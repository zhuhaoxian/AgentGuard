import { PrismaClient } from '@prisma/client';
import {
  AlertHistoryQuery,
  AlertHistoryResponse,
  SendAlertDto,
  ChannelRecipient,
} from './alert.types';
import { formatDateTime } from '../../common/utils/date.util';

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

    if (query.startTime) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(query.startTime),
      };
    }

    if (query.endTime) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(query.endTime),
      };
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
   * 统计告警数量
   */
  async countAlerts(query: AlertHistoryQuery): Promise<number> {
    const where: any = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startTime) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(query.startTime),
      };
    }

    if (query.endTime) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(query.endTime),
      };
    }

    return this.prisma.alertHistory.count({ where });
  }

  /**
   * 导出告警历史
   */
  async exportAlerts(query: AlertHistoryQuery): Promise<AlertHistoryResponse[]> {
    const where: any = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startTime) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(query.startTime),
      };
    }

    if (query.endTime) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(query.endTime),
      };
    }

    const alerts = await this.prisma.alertHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map(alert => this.toAlertResponse(alert));
  }

  /**
   * 获取最近的告警历史
   */
  async getRecentAlerts(limit: number): Promise<AlertHistoryResponse[]> {
    const alerts = await this.prisma.alertHistory.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map(alert => this.toAlertResponse(alert));
  }

  /**
   * 转换为告警响应对象
   */
  private toAlertResponse(alert: any): AlertHistoryResponse {
    let channelRecipients: ChannelRecipient[] | null = null;

    // 解析 channelDetails JSON 字符串
    if (alert.channelDetails) {
      try {
        channelRecipients = JSON.parse(alert.channelDetails);
      } catch (error) {
        console.error('Failed to parse channelDetails:', error);
      }
    }

    return {
      id: alert.id,
      ruleId: alert.ruleId,
      type: alert.type,
      title: alert.title,
      content: alert.content,
      channelType: alert.channelType,
      channelRecipients,
      status: alert.status,
      errorMessage: alert.errorMessage,
      sentAt: formatDateTime(alert.sentAt),
      createdAt: formatDateTime(alert.createdAt),
    };
  }
}
