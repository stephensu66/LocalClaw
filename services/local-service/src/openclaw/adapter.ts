import type {
  AgentHealth,
  EnvCheckResult,
  LocalConfigInput,
  LogLevel,
  TaskStatus,
} from '@openclaw/shared';

export interface AdapterTaskInput {
  taskId: string;
  title?: string;
  input: string;
  sessionId?: string | null;
  agentName?: string | null;
}

export interface AdapterContext {
  config: LocalConfigInput;
}

export type AdapterEvent =
  | { type: 'status'; status: TaskStatus; message?: string }
  | { type: 'log'; level: LogLevel; message: string; meta?: Record<string, unknown> }
  | { type: 'result'; output?: Record<string, unknown> };

export interface AdapterTaskHandle {
  externalTaskId: string;
  eventStream: AsyncIterable<AdapterEvent>;
}

export type AgentCreateStep = 'create_agent' | 'init_session' | 'restart_gateway';

export interface AgentCreateInput {
  name: string;
  workspace: string;
  agentDir: string;
  model: string;
}

export interface AgentCreateStepResult {
  step: AgentCreateStep;
  command: string[];
  status: 'succeeded' | 'failed';
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface AgentCreateResult {
  name: string;
  steps: AgentCreateStepResult[];
}

export interface AgentModelSelection {
  agentName: string;
  agentIndex: number;
  model: string | null;
}

export interface AgentModelUpdateResult extends AgentModelSelection {
  command: string[];
}

export interface AgentWorkspaceInfo {
  agentName: string;
  agentIndex: number;
  workspace: string;
  defaultWorkspace: string | null;
}

export interface OpenClawAdapter {
  submitTask(input: AdapterTaskInput, ctx: AdapterContext): Promise<AdapterTaskHandle>;
  getTaskStatus(externalTaskId: string): Promise<{ status: TaskStatus }>;
  getTaskLogs(externalTaskId: string): Promise<Array<{ level: LogLevel; message: string }>>;
  streamTaskEvents(externalTaskId: string): AsyncIterable<AdapterEvent>;
  syncLocalConfig(config: LocalConfigInput, options?: { skipGatewayRestart?: boolean }): Promise<void>;
  checkEnvironment(): Promise<EnvCheckResult>;
  getAgentHealth(): Promise<AgentHealth>;
  listAgents(): Promise<string[]>;
  listModels(options?: { timeoutMs?: number }): Promise<string[]>;
  createAgent(input: AgentCreateInput): Promise<AgentCreateResult>;
  getAgentModel(agentName: string): Promise<AgentModelSelection>;
  setAgentModel(agentName: string, model: string): Promise<AgentModelUpdateResult>;
  getAgentWorkspace(agentName: string): Promise<AgentWorkspaceInfo>;
}
