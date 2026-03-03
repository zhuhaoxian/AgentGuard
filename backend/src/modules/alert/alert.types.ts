export interface AlertHistoryQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: string;
}

export interface AlertHistoryResponse {
  id: string;
  ruleId: string | null;
  type: string;
  title: string;
  content: string;
  channelType: string;
  channelDetails: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface SendAlertDto {
  type: string;
  title: string;
  content: string;
  channelType: string;
}
