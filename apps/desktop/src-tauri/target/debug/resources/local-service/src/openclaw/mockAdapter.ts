import { randomUUID } from 'crypto';
import type {
  OpenClawAdapter,
  AdapterTaskInput,
  AdapterContext,
  AdapterTaskHandle,
  AdapterEvent,
  AgentCreateInput,
  AgentCreateResult,
  AgentModelSelection,
  AgentModelUpdateResult,
  AgentWorkspaceInfo,
} from './adapter';
import type { AgentHealth, EnvCheckResult, LocalConfigInput } from '@openclaw/shared';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenClawMockAdapter implements OpenClawAdapter {
  private modelsByAgent = new Map<string, string>([
    ['main', 'openai/gpt-4o'],
    ['mock', 'anthropic/claude-sonnet-4'],
  ]);
  private workspaceByAgent = new Map<string, string>([
    ['main', '~/.openclaw/workspace'],
    ['mock', '~/.openclaw/workspace-mock'],
  ]);

  async submitTask(input: AdapterTaskInput, _ctx: AdapterContext): Promise<AdapterTaskHandle> {
    const externalTaskId = `mock_${randomUUID()}`;

    async function* stream(): AsyncGenerator<AdapterEvent, void, unknown> {
      yield {
        type: 'status',
        status: 'running',
        message: 'Task started',
      } satisfies AdapterEvent;

      yield {
        type: 'log',
        level: 'info',
        message: 'Mock agent received task',
      } satisfies AdapterEvent;

      await delay(400);

      yield {
        type: 'log',
        level: 'info',
        message: `Input: ${input.input}${input.agentName ? ` (agent: ${input.agentName})` : ''}`,
      } satisfies AdapterEvent;

      await delay(600);

      yield {
        type: 'result',
        output: { summary: 'Mock completed', echo: input.input },
      } satisfies AdapterEvent;

      yield {
        type: 'status',
        status: 'succeeded',
        message: 'Task done',
      } satisfies AdapterEvent;
    }

    return { externalTaskId, eventStream: stream() };
  }

  async getTaskStatus(): Promise<{ status: 'running' | 'succeeded' }> {
    return { status: 'running' };
  }

  async getTaskLogs(): Promise<Array<{ level: 'info'; message: string }>> {
    return [];
  }

  async *streamTaskEvents(): AsyncIterable<AdapterEvent> {
    return;
  }

  async syncLocalConfig(
    _config: LocalConfigInput,
    _options?: { skipGatewayRestart?: boolean }
  ): Promise<void> {
    return;
  }

  async checkEnvironment(): Promise<EnvCheckResult> {
    return {
      status: 'ok',
      summary: 'Mock environment ready',
      checkedAt: new Date().toISOString(),
      details: {},
    };
  }

  async getAgentHealth(): Promise<AgentHealth> {
    return {
      status: 'ok',
      message: 'Mock agent healthy',
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async listAgents(): Promise<string[]> {
    return ['main', 'mock'];
  }

  async listModels(): Promise<string[]> {
    return ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-pro'];
  }

  async createAgent(input: AgentCreateInput): Promise<AgentCreateResult> {
    this.modelsByAgent.set(input.name, input.model);
    return {
      name: input.name,
      steps: [
        {
          step: 'create_agent',
          command: ['openclaw', 'agents', 'add', input.name, '--workspace', input.workspace, '--agent-dir', input.agentDir, '--model', input.model, '--non-interactive'],
          status: 'succeeded',
          exitCode: 0,
          stdout: 'mock create agent success',
          stderr: '',
        },
        {
          step: 'init_session',
          command: ['openclaw', 'agent', '--agent', input.name, '--message', '你好'],
          status: 'succeeded',
          exitCode: 0,
          stdout: 'mock init session success',
          stderr: '',
        },
        {
          step: 'restart_gateway',
          command: ['openclaw', 'gateway', 'restart'],
          status: 'succeeded',
          exitCode: 0,
          stdout: 'mock restart gateway success',
          stderr: '',
        },
      ],
    };
  }

  async getAgentModel(agentName: string): Promise<AgentModelSelection> {
    const agents = await this.listAgents();
    const index = agents.findIndex((name) => name === agentName);
    if (index < 0) {
      throw new Error(`Agent not found: ${agentName}`);
    }
    return {
      agentName,
      agentIndex: index,
      model: this.modelsByAgent.get(agentName) ?? null,
    };
  }

  async setAgentModel(agentName: string, model: string): Promise<AgentModelUpdateResult> {
    const current = await this.getAgentModel(agentName);
    this.modelsByAgent.set(agentName, model);
    return {
      agentName,
      agentIndex: current.agentIndex,
      model,
      command: ['openclaw', 'config', 'set', `agents.list[${current.agentIndex}].model`, model],
    };
  }

  async getAgentWorkspace(agentName: string): Promise<AgentWorkspaceInfo> {
    const agents = await this.listAgents();
    const index = agents.findIndex((name) => name === agentName);
    if (index < 0) {
      throw new Error(`Agent not found: ${agentName}`);
    }
    return {
      agentName,
      agentIndex: index,
      workspace: this.workspaceByAgent.get(agentName) ?? '~/.openclaw/workspace',
      defaultWorkspace: '~/.openclaw/workspace',
    };
  }
}
