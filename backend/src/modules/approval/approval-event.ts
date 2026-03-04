import { EventEmitter } from 'events';

/**
 * 审批事件管理器（参考旧代码：ApprovalApprovedEvent.java 和 ApprovalEventListener.java）
 * 使用 EventEmitter 实现事件驱动的审批执行
 */
export class ApprovalEventManager extends EventEmitter {
  private static instance: ApprovalEventManager;

  private constructor() {
    super();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ApprovalEventManager {
    if (!ApprovalEventManager.instance) {
      ApprovalEventManager.instance = new ApprovalEventManager();
    }
    return ApprovalEventManager.instance;
  }

  /**
   * 发布审批通过事件（参考旧代码：ApprovalServiceImpl.java:137）
   */
  emitApprovalApproved(approvalId: string): void {
    console.log(`发布审批通过事件: approvalId=${approvalId}`);
    this.emit('approval:approved', approvalId);
  }

  /**
   * 监听审批通过事件（参考旧代码：ApprovalEventListener.java:30）
   */
  onApprovalApproved(handler: (approvalId: string) => void): void {
    this.on('approval:approved', handler);
  }
}

// 导出单例实例
export const approvalEventManager = ApprovalEventManager.getInstance();
