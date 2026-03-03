import { FastifyInstance } from 'fastify';
import { prisma } from '../../common/utils/prisma.util';
import { ApprovalService } from './approval.service';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  CreateApprovalDto,
  ApprovalActionDto,
  ApprovalListQuery,
} from './approval.types';

const approvalService = new ApprovalService(prisma);

export async function approvalRoutes(app: FastifyInstance) {
  // 创建审批请求
  app.post<{ Body: CreateApprovalDto }>(
    '/approvals',
    async (request, reply) => {
      const approval = await approvalService.createApproval(request.body);
      return ResponseUtil.success(approval, 'Approval request created');
    }
  );

  // 获取审批请求列表
  app.get<{ Querystring: ApprovalListQuery }>(
    '/approvals',
    async (request, reply) => {
      const query: ApprovalListQuery = {
        page: request.query.page ? parseInt(request.query.page as any) : 1,
        pageSize: request.query.pageSize
          ? parseInt(request.query.pageSize as any)
          : 20,
        status: request.query.status as string,
        agentId: request.query.agentId as string,
        approvalId: request.query.approvalId as string,
      };

      const { approvals, total } = await approvalService.getApprovals(query);

      return ResponseUtil.paginated(approvals, total, query.page!, query.pageSize!);
    }
  );

  // 获取审批请求详情
  app.get<{ Params: { id: string } }>(
    '/approvals/:id',
    async (request, reply) => {
      const approval = await approvalService.getApprovalById(request.params.id);
      return ResponseUtil.success(approval);
    }
  );

  // 批准审批请求
  app.post<{ Params: { id: string }; Body?: ApprovalActionDto }>(
    '/approvals/:id/approve',
    async (request, reply) => {
      const approval = await approvalService.approveApproval(
        request.params.id,
        request.body
      );
      return ResponseUtil.success(approval, 'Approval request approved');
    }
  );

  // 拒绝审批请求
  app.post<{ Params: { id: string }; Body?: ApprovalActionDto }>(
    '/approvals/:id/reject',
    async (request, reply) => {
      const approval = await approvalService.rejectApproval(
        request.params.id,
        request.body
      );
      return ResponseUtil.success(approval, 'Approval request rejected');
    }
  );

  // 获取审批状态(用于客户端轮询)
  app.get<{ Params: { id: string } }>(
    '/approvals/:id/status',
    async (request, reply) => {
      const status = await approvalService.getApprovalStatus(request.params.id);
      return ResponseUtil.success(status);
    }
  );

  // 提交审批申请理由
  app.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/approvals/:id/reason',
    async (request, reply) => {
      const approval = await approvalService.submitReason(
        request.params.id,
        request.body.reason
      );
      return ResponseUtil.success(approval, 'Reason submitted');
    }
  );

  // 获取待审批数量
  app.get('/approvals/pending/count', async (request, reply) => {
    const count = await approvalService.getPendingCount();
    return ResponseUtil.success({ count });
  });
}
