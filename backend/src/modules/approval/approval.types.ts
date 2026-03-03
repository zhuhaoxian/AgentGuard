export interface CreateApprovalDto {
  policyId: string;
  agentId: string;
  requestData: any;
  applicationReason?: string;
  expiresAt: Date;
}

export interface ApprovalActionDto {
  approverId?: string;
  remark?: string;
}

export interface ApprovalResponse {
  id: string;
  policyId: string;
  policyName: string | null;
  agentId: string;
  agentName: string | null;
  requestData: any;
  applicationReason: string | null;
  status: string;
  approverId: string | null;
  approvedAt: string | null;
  remark: string | null;
  executionStatus: string | null;
  executionResult: string | null;
  executedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ApprovalListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  agentId?: string;
  approvalId?: string; // 支持模糊匹配
}

export interface ApprovalStatusResponse {
  id: string;
  status: string;
  executionStatus: string | null;
  executionResult: string | null;
  remark: string | null;
}
