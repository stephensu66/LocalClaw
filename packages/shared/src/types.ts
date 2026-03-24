export type ModelMode =
  | 'builtin'
  | 'local_model'
  | 'deepseek'
  | 'alibaba_cloud'
  | 'moonshot'
  | 'zhipu'
  | 'minimax'
  | 'baidu'
  | 'tencent_hunyuan'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'together_ai'
  | 'fireworks_ai'
  | 'perplexity'
  | 'other';

export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type PermissionKey =
  | 'FILE_READ'
  | 'FILE_WRITE'
  | 'SHELL_EXEC'
  | 'PYTHON_EXEC'
  | 'INTERNET_ACCESS'
  | 'BROWSER';

export interface LocalConfigInput {
  modelMode: ModelMode;
  apiKey?: string | null;
  baseUrl?: string | null;
  customModelName?: string | null;
  modelName: string;
  workDirAuto: boolean;
  workDir: string;
  notificationsEnabled: boolean;
}

export interface LocalConfigView {
  modelMode: ModelMode;
  baseUrl?: string | null;
  customModelName?: string | null;
  modelName: string;
  workDirAuto: boolean;
  workDir: string;
  notificationsEnabled: boolean;
  apiKeySet: boolean;
  onboarded: boolean;
}

export interface TaskCreateInput {
  title?: string;
  input: string;
  requiredPermissions?: PermissionKey[];
  sessionId?: string | null;
}

export interface TaskDTO {
  id: string;
  title?: string | null;
  input: string;
  agentName?: string | null;
  status: TaskStatus;
  requiredPermissions: PermissionKey[];
  externalTaskId?: string | null;
  result?: Record<string, unknown> | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLogDTO {
  id: string;
  taskId: string;
  level: LogLevel;
  message: string;
  createdAt: string;
}

export interface PermissionGrantDTO {
  key: PermissionKey;
  granted: boolean;
  scope?: Record<string, unknown> | null;
  updatedAt: string;
}

export interface AgentHealth {
  status: 'ok' | 'degraded' | 'down';
  message?: string;
  lastCheckedAt: string;
}

export interface EnvCheckResult {
  status: 'ok' | 'warn' | 'fail';
  summary: string;
  details?: Record<string, unknown>;
  checkedAt: string;
}

export interface OpenClawSessionInfo {
  sessionId: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  sessionFile?: string; // The actual filename of the .jsonl file
}

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; name?: string; arguments?: Record<string, unknown>; output?: unknown }>;
}

export interface OpenClawSessionEvent {
  id?: string;
  type: 'message' | 'compaction' | 'model_change' | 'thinking_level_change' | 'tool_call' | 'tool_result' | string;
  timestamp?: string | number;
  message?: OpenClawMessage;
  summary?: string;
  [key: string]: unknown;
}

export interface OpenClawSessionResponse {
  activeSessionId?: string;
  sessions: OpenClawSessionInfo[];
}

export interface OpenClawSessionRecords {
  records: OpenClawSessionEvent[];
}
