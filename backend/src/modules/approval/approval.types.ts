export interface CreateApprovalDto {
  policyId: string;
  agentId: string;
  requestData: any;
  applicationReason?: string;
  expiresAt: Date;
}

export interface ApprovalActionDto {
  approverId: string;
  remark?: string;
}

export interface ApprovalResponse {
  id: string;
  policyId: string;
  agentId: string;
  requestData: any;
  applicationReason: string | null;
  status: string;
  approverId: string | null;
  approvedAt: Date | null;
  remark: string | null;
  executionStatus: string | null;
  executionResult: string | null;
  executedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface ApprovalListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  agentId?: string;
}

export interface ApprovalStatusResponse {
  id: string;
  status: string;
  executionStatus: string | null;
  executionResult: string | null;
  remark: string | null;
}
