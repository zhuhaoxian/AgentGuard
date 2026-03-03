import { PrismaClient } from '@prisma/client';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/business.exception';
import {
  CreateApprovalDto,
  ApprovalActionDto,
  ApprovalResponse,
  ApprovalListQuery,
  ApprovalStatusResponse,
} from './approval.types';

export class ApprovalService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 创建审批请求
   */
  async createApproval(dto: CreateApprovalDto): Promise<ApprovalResponse> {
    const approval = await this.prisma.approvalRequest.create({
      data: {
        policyId: dto.policyId,
        agentId: dto.agentId,
        requestData: dto.requestData,
        applicationReason: dto.applicationReason,
        expiresAt: dto.expiresAt,
        status: 'PENDING',
      },
    });

    return this.toApprovalResponse(approval);
  }

  /**
   * 获取审批请求详情
   */
  async getApprovalById(id: string): Promise<ApprovalResponse> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    return this.toApprovalResponse(approval);
  }

  /**
   * 获取审批请求列表
   */
  async getApprovals(
    query: ApprovalListQuery
  ): Promise<{ approvals: ApprovalResponse[]; total: number }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.agentId) {
      where.agentId = query.agentId;
    }

    const [approvals, total] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return {
      approvals: approvals.map(approval => this.toApprovalResponse(approval)),
      total,
    };
  }

  /**
   * 批准审批请求
   */
  async approveApproval(
    id: string,
    dto: ApprovalActionDto
  ): Promise<ApprovalResponse> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    if (approval.status !== 'PENDING') {
      throw new ValidationException('Approval request is not pending');
    }

    // 检查是否过期
    if (new Date() > approval.expiresAt) {
      throw new ValidationException('Approval request has expired');
    }

    const updatedApproval = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId: dto.approverId,
        approvedAt: new Date(),
        remark: dto.remark,
      },
    });

    return this.toApprovalResponse(updatedApproval);
  }

  /**
   * 拒绝审批请求
   */
  async rejectApproval(
    id: string,
    dto: ApprovalActionDto
  ): Promise<ApprovalResponse> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    if (approval.status !== 'PENDING') {
      throw new ValidationException('Approval request is not pending');
    }

    const updatedApproval = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId: dto.approverId,
        approvedAt: new Date(),
        remark: dto.remark,
      },
    });

    return this.toApprovalResponse(updatedApproval);
  }

  /**
   * 更新执行状态
   */
  async updateExecutionStatus(
    id: string,
    executionStatus: string,
    executionResult?: string
  ): Promise<void> {
    await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        executionStatus,
        executionResult,
        executedAt: new Date(),
      },
    });
  }

  /**
   * 处理过期的审批请求
   */
  async expireOverdueApprovals(): Promise<number> {
    const result = await this.prisma.approvalRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return result.count;
  }

  /**
   * 获取待审批数量
   */
  async getPendingCount(): Promise<number> {
    return this.prisma.approvalRequest.count({
      where: { status: 'PENDING' },
    });
  }

  /**
   * 获取审批状态(用于客户端轮询)
   */
  async getApprovalStatus(id: string): Promise<ApprovalStatusResponse> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    return {
      id: approval.id,
      status: approval.status,
      executionStatus: approval.executionStatus,
      executionResult: approval.executionResult,
      remark: approval.remark,
    };
  }

  /**
   * 提交审批申请理由
   */
  async submitReason(id: string, reason: string): Promise<ApprovalResponse> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    const updatedApproval = await this.prisma.approvalRequest.update({
      where: { id },
      data: { applicationReason: reason },
    });

    return this.toApprovalResponse(updatedApproval);
  }

  /**
   * 转换为审批响应对象
   */
  private toApprovalResponse(approval: any): ApprovalResponse {
    return {
      id: approval.id,
      policyId: approval.policyId,
      agentId: approval.agentId,
      requestData: approval.requestData,
      applicationReason: approval.applicationReason,
      status: approval.status,
      approverId: approval.approverId,
      approvedAt: approval.approvedAt,
      remark: approval.remark,
      executionStatus: approval.executionStatus,
      executionResult: approval.executionResult,
      executedAt: approval.executedAt,
      expiresAt: approval.expiresAt,
      createdAt: approval.createdAt,
    };
  }
}
