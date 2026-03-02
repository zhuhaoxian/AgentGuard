// OpenAI Chat Completion 请求类型
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: Tool[];
  tool_choice?: string | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

// OpenAI Chat Completion 响应类型
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: string | null;
  logprobs?: any;
}

// 流式响应类型
export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  system_fingerprint?: string;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: {
    role?: string;
    content?: string;
    tool_calls?: ToolCall[];
  };
  finish_reason: string | null;
  logprobs?: any;
}

// Models 响应类型
export interface ModelsResponse {
  object: 'list';
  data: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}
