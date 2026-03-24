import type {
  LocalConfigView,
  LocalConfigInput,
  TaskDTO,
  TaskCreateInput,
  TaskLogDTO,
  PermissionGrantDTO,
  AgentHealth,
  EnvCheckResult,
  OpenClawSessionResponse,
  OpenClawSessionRecords,
} from '@openclaw/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3980';

export type AgentCreateStep = 'create_agent' | 'init_session' | 'restart_gateway';

export interface AgentCreateStepResult {
  step: AgentCreateStep;
  command: string[];
  status: 'succeeded' | 'failed';
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface AgentCreatePayload {
  name: string;
  workspace: string;
  agentDir: string;
  model: string;
}

export interface AgentCreateResponse {
  name: string;
  steps: AgentCreateStepResult[];
}

export interface AgentModelResponse {
  agentName: string;
  agentIndex: number;
  model: string | null;
}

export interface AgentModelSetPayload {
  agentName: string;
  model: string;
}

export interface AgentModelSetResponse extends AgentModelResponse {
  command: string[];
}

export interface AgentWorkspaceResponse {
  agentName: string;
  agentIndex: number;
  workspace: string;
  defaultWorkspace: string | null;
}

function withQuery(path: string, query?: Record<string, string | null | undefined>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (!value) return;
    params.set(key, value);
  });
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message =
      (typeof error?.message === 'string' && error.message) ||
      (typeof error?.error === 'string' && error.error) ||
      `Request failed: ${res.status}`;
    const apiError = new Error(message) as Error & {
      status?: number;
      details?: Record<string, unknown>;
    };
    apiError.status = res.status;
    apiError.details = error;
    throw apiError;
  }
  return res.json() as Promise<T>;
}

export const api = {
  getConfig: () => request<LocalConfigView>('/api/config'),
  updateConfig: (input: Partial<LocalConfigInput>) =>
    request<LocalConfigView>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  switchToOpenClaw: () => request('/api/config/switch-to-openclaw', { method: 'POST' }),
  listTasks: () => request<TaskDTO[]>('/api/tasks'),
  getTask: (id: string) => request<TaskDTO>(`/api/tasks/${id}`),
  getTaskLogs: (id: string) => request<TaskLogDTO[]>(`/api/tasks/${id}/logs`),
  createTask: (input: TaskCreateInput & { agentName?: string | null }) =>
    request<TaskDTO>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  listPermissions: () => request<PermissionGrantDTO[]>('/api/permissions'),
  updatePermission: (key: string, input: { granted: boolean; scope?: Record<string, unknown> }) =>
    request<PermissionGrantDTO>(`/api/permissions/${key}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getAgentStatus: () => request<AgentHealth>('/api/agent/status'),
  envCheck: () => request<EnvCheckResult>('/api/agent/env-check', { method: 'POST' }),
  listSessions: (agentName?: string | null) =>
    request<OpenClawSessionResponse>(withQuery('/api/sessions', { agentName })),
  getSession: (sessionId: string, agentName?: string | null) =>
    request<OpenClawSessionRecords>(withQuery(`/api/sessions/${sessionId}`, { agentName })),
  listAgents: () => request<{ agents: string[] }>('/api/agent/list'),
  listAgentModels: () => request<{ models: string[] }>('/api/agent/models'),
  getAgentModel: (agentName: string) =>
    request<AgentModelResponse>(withQuery('/api/agent/model', { agentName })),
  getAgentWorkspace: (agentName: string) =>
    request<AgentWorkspaceResponse>(withQuery('/api/agent/workspace', { agentName })),
  setAgentModel: (input: AgentModelSetPayload) =>
    request<AgentModelSetResponse>('/api/agent/model', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  createAgent: (input: AgentCreatePayload) =>
    request<AgentCreateResponse>('/api/agent/create', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export function getEventSource(): EventSource {
  return new EventSource(`${BASE_URL}/api/events`);
}
