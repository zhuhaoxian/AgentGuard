export interface AlertHistoryQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export interface ChannelRecipient {
  channel: string;
  recipient: string;
  status: string;
  errorMessage?: string;
}

export interface AlertHistoryResponse {
  id: string;
  ruleId: string | null;
  type: string;
  title: string;
  content: string;
  channelType: string;
  channelRecipients: ChannelRecipient[] | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface SendAlertDto {
  type: string;
  title: string;
  content: string;
  channelType: string;
}
