import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { ApprovalService } from './approval.service';
import { approvalEventManager } from './approval-event';
import { EncryptionUtil } from '@common/utils/encryption.util';

export class ApprovalExecutor {
  private prisma: PrismaClient;
  private approvalService: ApprovalService;
  private autoExecuteEnabled: boolean = true; // 默认启用自动执行

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.approvalService = new ApprovalService(prisma);

    // 注册事件监听器（参考旧代码：ApprovalEventListener.java:29-40）
    this.registerEventListeners();
  }

  /**
   * 注册审批事件监听器
   */
  private registerEventListeners(): void {
    approvalEventManager.onApprovalApproved((approvalId: string) => {
      console.log(`收到审批通过事件，准备异步执行: approvalId=${approvalId}`);

      // 检查是否配置为自动执行（参考旧代码：ApprovalEventListener.java:35-39）
      if (this.autoExecuteEnabled) {
        this.executeApprovalAsync(approvalId);
      } else {
        console.log(`自动执行已禁用，跳过执行: approvalId=${approvalId}`);
      }
    });
  }

  /**
   * 异步执行审批请求
   */
  private executeApprovalAsync(approvalId: string): void {
    this.executeApproval(approvalId).catch(error => {
      console.error(`异步执行审批失败 ${approvalId}:`, error);
    });
  }

  /**
   * 检查自动执行是否启用
   */
  isAutoExecuteEnabled(): boolean {
    return this.autoExecuteEnabled;
  }

  /**
   * 设置自动执行开关
   */
  setAutoExecuteEnabled(enabled: boolean): void {
    this.autoExecuteEnabled = enabled;
  }

  /**
   * 执行已批准的审批请求
   */
  async executeApproval(approvalId: string): Promise<void> {
    try {
      // 获取审批请求
      const approval = await this.prisma.approvalRequest.findUnique({
        where: { id: approvalId },
        include: {
          agent: true,
        },
      });

      if (!approval) {
        throw new Error('Approval request not found');
      }

      if (approval.status !== 'APPROVED') {
        throw new Error('Approval request is not approved');
      }

      // 标记为执行中
      await this.approvalService.updateExecutionStatus(approvalId, 'EXECUTING');

      // 执行原始请求
      const requestData = approval.requestData as any;
      const agent = approval.agent;

      // 构建请求
      const llmBaseUrl = agent.llmBaseUrl || 'https://api.openai.com';
      // 解密 API Key（参考旧代码：ApprovalExecutorImpl.java 中使用 encryptionUtil.decrypt）
      const llmApiKey = EncryptionUtil.decryptString(agent.llmApiKey);

      const response = await axios.post(
        `${llmBaseUrl}/v1/chat/completions`,
        requestData.body,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmApiKey}`,
          },
          timeout: 60000,
        }
      );

      // 记录执行结果
      await this.approvalService.updateExecutionStatus(
        approvalId,
        'SUCCESS',
        JSON.stringify(response.data)
      );
    } catch (error: any) {
      // 记录执行失败
      await this.approvalService.updateExecutionStatus(
        approvalId,
        'FAILED',
        error.message
      );
    }
  }

  /**
   * 批量执行已批准的审批请求
   */
  async executeApprovedApprovals(): Promise<void> {
    // 查找所有已批准但未执行的审批请求
    const approvals = await this.prisma.approvalRequest.findMany({
      where: {
        status: 'APPROVED',
        executionStatus: null,
      },
      take: 10, // 每次最多执行10个
    });

    // 异步执行
    for (const approval of approvals) {
      this.executeApproval(approval.id).catch(error => {
        console.error(`Failed to execute approval ${approval.id}:`, error);
      });
    }
  }
}
