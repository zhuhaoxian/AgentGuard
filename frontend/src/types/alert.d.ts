/**
 * 告警相关类型定义（仅告警历史）
 *
 * @author zhuhx
 */

/**
 * 告警类型
 */
export type AlertType = 'RPM' | 'ERROR_RATE' | 'APPROVAL' | 'SYSTEM'

/**
 * 告警状态
 */
export type AlertStatus = 'SUCCESS' | 'FAILED'

/**
 * 通知渠道接收人信息
 */
export interface ChannelRecipient {
  channelType: string
  channelName: string
  recipient: string
}

/**
 * 告警历史记录
 */
export interface AlertHistory {
  id: string
  type: AlertType
  title: string
  content: string
  channelType: string
  channelRecipients?: ChannelRecipient[]
  status: AlertStatus
  errorMessage?: string
  sentAt: string
  createdAt: string
}

/**
 * 告警历史查询参数
 */
export interface AlertHistoryQuery {
  current?: number
  size?: number
  type?: AlertType
  status?: AlertStatus
  startTime?: string
  endTime?: string
}
