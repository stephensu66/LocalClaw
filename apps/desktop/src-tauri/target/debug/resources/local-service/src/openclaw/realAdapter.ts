import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type {
  OpenClawAdapter,
  AdapterTaskInput,
  AdapterContext,
  AdapterTaskHandle,
  AdapterEvent,
  AgentCreateInput,
  AgentCreateResult,
  AgentCreateStep,
  AgentCreateStepResult,
  AgentModelSelection,
  AgentModelUpdateResult,
  AgentWorkspaceInfo,
} from './adapter';
import type { AgentHealth, EnvCheckResult, LogLevel, TaskStatus } from '@openclaw/shared';
import { env } from '../config/env';
import { runCommand } from './cli';
import { getOpenClawProvider, getBackendModelName } from './providerMap';

interface TaskRecord {
  status: TaskStatus;
  logs: Array<{ level: LogLevel; message: string }>;
  result?: Record<string, unknown>;
  events: AdapterEvent[];
}

type JsonRecord = Record<string, unknown>;

interface OpenClawProviderModelEntry extends JsonRecord {
  id: string;
}

interface OpenClawProviderEntry extends JsonRecord {
  api?: string;
  apiKey?: string;
  baseUrl?: string;
  models?: OpenClawProviderModelEntry[];
}

interface OpenClawConfigFile extends JsonRecord {
  models?: JsonRecord & {
    mode?: string;
    providers?: Record<string, OpenClawProviderEntry>;
  };
  agents?: JsonRecord & {
    defaults?: JsonRecord & {
      model?: JsonRecord & {
        primary?: string;
      };
      models?: Record<string, JsonRecord>;
      workspace?: string;
    };
  };
  tools?: JsonRecord & {
    web?: JsonRecord;
  };
}

interface WebToolsConfigInput {
  search?: JsonRecord;
  fetch?: JsonRecord;
}

interface WebToolsEnvConfig {
  searchEnabled?: boolean;
  searchProvider?: string;
  searchApiKey?: string;
  searchPerplexityBaseUrl?: string;
  searchPerplexityModel?: string;
  fetchEnabled?: boolean;
}

interface WebToolsConfigResult {
  search?: JsonRecord;
  fetch?: JsonRecord;
  changed: boolean;
}

interface WebSearchHint {
  configured: boolean;
  summary: string;
}

interface OpenClawExecResult {
  code: number;
  stdout: string;
  stderr: string;
  error?: string;
}

type AgentCreateErrorCode =
  | 'AGENT_EXISTS'
  | 'CLI_NOT_FOUND'
  | 'MODEL_INVALID'
  | 'PATH_PERMISSION_DENIED'
  | 'SESSION_INIT_FAILED'
  | 'GATEWAY_RESTART_FAILED'
  | 'COMMAND_FAILED';

class OpenClawAgentCreateError extends Error {
  constructor(
    readonly step: AgentCreateStep,
    readonly code: AgentCreateErrorCode,
    readonly stepResult: AgentCreateStepResult,
    readonly steps: AgentCreateStepResult[]
  ) {
    super(stepResult.error ?? 'Failed to create agent');
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseModelRef(modelName: string): { providerId: string; modelId: string } | null {
  const slashIndex = modelName.indexOf('/');
  if (slashIndex <= 0 || slashIndex >= modelName.length - 1) return null;
  return {
    providerId: modelName.slice(0, slashIndex),
    modelId: modelName.slice(slashIndex + 1),
  };
}

function toProviderApiKeyEnvName(providerId: string): string {
  const normalized = providerId.trim().replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  return `${normalized || 'OPENAI'}_API_KEY`;
}

function escapeDoubleQuotedShellValue(value: string): string {
  return value.replace(/(["\\$`])/g, '\\$1');
}

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

function resolveWorkDir(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/')) return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
}

const WEB_SEARCH_PROVIDERS = new Set(['brave', 'perplexity', 'gemini', 'grok', 'kimi']);

function normalizeOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeWebSearchProvider(value?: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return WEB_SEARCH_PROVIDERS.has(normalized) ? normalized : undefined;
}

function getNestedRecord(parent: JsonRecord | undefined, key: string): JsonRecord | null {
  if (!parent) return null;
  const value = parent[key];
  return isRecord(value) ? (value as JsonRecord) : null;
}

function getNestedString(parent: JsonRecord | undefined, keys: string[]): string | undefined {
  let current: JsonRecord | null = parent ?? null;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (!current) return undefined;
    current = getNestedRecord(current, keys[i]);
  }
  if (!current) return undefined;
  const raw = current[keys[keys.length - 1]];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function extractWebSearchKey(search: JsonRecord): { provider: string; key: string } | null {
  const braveKey = getNestedString(search, ['apiKey']);
  if (braveKey) return { provider: 'brave', key: braveKey };
  const perplexityKey = getNestedString(search, ['perplexity', 'apiKey']);
  if (perplexityKey) return { provider: 'perplexity', key: perplexityKey };
  const geminiKey = getNestedString(search, ['gemini', 'apiKey']);
  if (geminiKey) return { provider: 'gemini', key: geminiKey };
  const grokKey = getNestedString(search, ['grok', 'apiKey']);
  if (grokKey) return { provider: 'grok', key: grokKey };
  const kimiKey = getNestedString(search, ['kimi', 'apiKey']);
  if (kimiKey) return { provider: 'kimi', key: kimiKey };
  return null;
}

export function buildWebToolsConfig(
  existing: WebToolsConfigInput,
  envConfig: WebToolsEnvConfig
): WebToolsConfigResult {
  const currentSearch = existing.search ?? {};
  const currentFetch = existing.fetch ?? {};
  const nextSearch: JsonRecord = { ...currentSearch };
  const nextFetch: JsonRecord = { ...currentFetch };
  let changed = false;

  const providerFromEnv = normalizeWebSearchProvider(envConfig.searchProvider);
  const providerFromConfig =
    typeof currentSearch.provider === 'string' ? currentSearch.provider.trim().toLowerCase() : undefined;
  const provider = providerFromEnv ?? providerFromConfig;

  if (providerFromEnv && providerFromEnv !== providerFromConfig) {
    nextSearch.provider = providerFromEnv;
    changed = true;
  }

  const apiKey = normalizeOptionalString(envConfig.searchApiKey);
  const searchEnabled =
    envConfig.searchEnabled !== undefined ? envConfig.searchEnabled : apiKey ? true : undefined;
  if (searchEnabled !== undefined && searchEnabled !== currentSearch.enabled) {
    nextSearch.enabled = searchEnabled;
    changed = true;
  }

  if (apiKey) {
    const targetProvider = provider ?? 'brave';
    if (targetProvider === 'brave') {
      if (nextSearch.apiKey !== apiKey) {
        nextSearch.apiKey = apiKey;
        changed = true;
      }
    } else {
      const providerSection = getNestedRecord(nextSearch, targetProvider) ?? {};
      if (providerSection.apiKey !== apiKey) {
        nextSearch[targetProvider] = { ...providerSection, apiKey };
        changed = true;
      }
    }
    if (!provider && !providerFromEnv) {
      nextSearch.provider = 'brave';
      changed = true;
    }
  }

  const perplexityBaseUrl = normalizeOptionalString(envConfig.searchPerplexityBaseUrl);
  const perplexityModel = normalizeOptionalString(envConfig.searchPerplexityModel);
  if (perplexityBaseUrl || perplexityModel) {
    const perplexitySection = getNestedRecord(nextSearch, 'perplexity') ?? {};
    const nextPerplexity: JsonRecord = { ...perplexitySection };
    if (perplexityBaseUrl && nextPerplexity.baseUrl !== perplexityBaseUrl) {
      nextPerplexity.baseUrl = perplexityBaseUrl;
      changed = true;
    }
    if (perplexityModel && nextPerplexity.model !== perplexityModel) {
      nextPerplexity.model = perplexityModel;
      changed = true;
    }
    nextSearch.perplexity = nextPerplexity;
  }

  const fetchEnabled = envConfig.fetchEnabled;
  if (fetchEnabled !== undefined && fetchEnabled !== currentFetch.enabled) {
    nextFetch.enabled = fetchEnabled;
    changed = true;
  } else if (fetchEnabled === undefined && searchEnabled === true && currentFetch.enabled === undefined) {
    nextFetch.enabled = true;
    changed = true;
  }

  return {
    search: changed ? nextSearch : currentSearch,
    fetch: changed ? nextFetch : currentFetch,
    changed,
  };
}

async function readOpenClawConfigFile(): Promise<OpenClawConfigFile | null> {
  const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as OpenClawConfigFile) : null;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') return null;
    return null;
  }
}

function getWebSearchHintFromConfig(config: OpenClawConfigFile | null): WebSearchHint | null {
  if (!config) return null;
  const tools = isRecord(config.tools) ? config.tools : undefined;
  const web = tools ? getNestedRecord(tools, 'web') : null;
  const search = web ? getNestedRecord(web, 'search') : null;
  if (!search) {
    return { configured: false, summary: 'tools.web.search not configured' };
  }
  const enabled = typeof search.enabled === 'boolean' ? search.enabled : undefined;
  if (enabled === false) {
    return { configured: false, summary: 'tools.web.search.enabled=false' };
  }
  const provider =
    typeof search.provider === 'string' && search.provider.trim() ? search.provider.trim() : undefined;
  const keyInfo = extractWebSearchKey(search);
  if (!keyInfo) {
    return { configured: false, summary: 'missing web search API key' };
  }
  const resolvedProvider = provider ?? keyInfo.provider;
  return { configured: true, summary: `provider=${resolvedProvider}` };
}

function getWebSearchHintFromEnv(): WebSearchHint | null {
  const enabled = env.openclawWebSearchEnabled;
  const provider = env.openclawWebSearchProvider;
  const apiKey = env.openclawWebSearchApiKey;
  const hasAny =
    enabled !== undefined ||
    Boolean(provider) ||
    Boolean(apiKey) ||
    Boolean(env.openclawWebSearchPerplexityBaseUrl) ||
    Boolean(env.openclawWebSearchPerplexityModel);
  if (!hasAny) return null;
  if (enabled === false) {
    return { configured: false, summary: 'OPENCLAW_WEB_SEARCH_ENABLED=false' };
  }
  if (!apiKey) {
    return { configured: false, summary: 'OPENCLAW_WEB_SEARCH_API_KEY missing' };
  }
  return {
    configured: true,
    summary: provider ? `env provider=${provider}` : 'env provider not set (defaulting to brave)',
  };
}

async function resolveWebSearchHint(): Promise<WebSearchHint | null> {
  const config = await readOpenClawConfigFile();
  const fromConfig = getWebSearchHintFromConfig(config);
  if (fromConfig) return fromConfig;
  return getWebSearchHintFromEnv();
}

function shouldApplyFilePromptGuard(userInput: string): boolean {
  const text = userInput.trim();
  if (!text) return false;
  return /创建|新建|生成|写入|保存|追加|文件|空文件|文本|create|new file|write|append|save|touch|\.txt|\.md|\.json|\.yaml|\.yml|\.csv|\.xml/i.test(
    text
  );
}

function shouldApplyWebPromptGuard(userInput: string): boolean {
  const text = userInput.trim();
  if (!text) return false;
  return /今天|最新|实时|新闻|股票|股市|市场|行情|指数|汇率|天气|today|latest|current|news|stock|stocks|market|price|quote|exchange rate|weather/i.test(
    text
  );
}

function buildFilePromptGuard(userInput: string): string | null {
  if (!shouldApplyFilePromptGuard(userInput)) return null;
  return [
    'Tool-call guard for file requests:',
    '1) If user asks to create a file but provides no content, treat it as empty file creation.',
    '2) For empty file creation, do not call write without content; use exec with touch instead.',
    '3) Use write only when explicit content is provided.',
    '4) For write, always provide path/content/append and keep content exactly as user requested.',
  ].join('\n');
}

function buildWebPromptGuard(userInput: string, hint?: WebSearchHint | null): string | null {
  if (!shouldApplyWebPromptGuard(userInput)) return null;
  const hintLine = hint
    ? hint.configured
      ? `Web search config: configured (${hint.summary}).`
      : `Web search config: missing (${hint.summary}).`
    : 'Web search config: unknown.';
  return [
    'Tool-call guard for web questions:',
    '1) This question requires up-to-date information. You must call web_search before answering.',
    '2) If web_search fails, return a clear error with the underlying reason and missing config.',
    `3) ${hintLine}`,
  ].join('\n');
}

function buildPromptWithGuards(userInput: string, options?: { webSearchHint?: WebSearchHint | null }): string {
  const guards: string[] = [];
  const fileGuard = buildFilePromptGuard(userInput);
  if (fileGuard) guards.push(fileGuard);
  const webGuard = buildWebPromptGuard(userInput, options?.webSearchHint ?? null);
  if (webGuard) guards.push(webGuard);
  if (guards.length === 0) return userInput;
  return [...guards, '', `User request: ${userInput}`].join('\n');
}

function parseJsonOutput(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function summarizeStderr(raw: string, maxLines = 3): string {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  return lines.slice(-maxLines).join(' | ');
}

function extractOutputError(output: Record<string, unknown>): string | null {
  const error = output.error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  const errors = output.errors;
  if (Array.isArray(errors)) {
    const messages = errors
      .map((item) => (typeof item === 'string' ? item : isRecord(item) ? item.message : null))
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    if (messages.length > 0) return messages.join('; ');
  }
  return null;
}

function hasTextPayload(output: Record<string, unknown>): boolean {
  const payloads = output.payloads;
  if (!Array.isArray(payloads)) return false;
  return payloads.some((payload) => isRecord(payload) && typeof payload.text === 'string' && payload.text.trim());
}

function truncateOutput(raw: string, maxChars = 2000): string {
  if (!raw) return '';
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(raw.length - maxChars)}\n...[truncated]`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function parseWorkspaceValue(stdout: string): string | null {
  const cleaned = stripAnsi(stdout).trim();
  if (!cleaned) return null;
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
  } catch {
    // Non-JSON output is expected for some openclaw config outputs.
  }
  const unquoted = cleaned.replace(/^["']|["']$/g, '').trim();
  return unquoted || null;
}

function parseModelList(stdout: string): string[] {
  const models = new Set<string>();
  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/missing/i.test(line)) return;
      const match = line.match(/([a-z0-9_.-]+\/[a-z0-9_.:/-]+)/i);
      if (match?.[1]) {
        models.add(match[1]);
      }
    });
  return [...models];
}

function parseAgentList(stdout: string): string[] {
  const cleaned = stripAnsi(stdout).trim();
  if (!cleaned) return [];

  const collectFromJson = (input: unknown): string[] => {
    const names: string[] = [];
    const seen = new Set<string>();
    const pushName = (raw: unknown) => {
      if (typeof raw !== 'string') return;
      const trimmed = raw.trim();
      if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && !seen.has(trimmed)) {
        seen.add(trimmed);
        names.push(trimmed);
      }
    };

    if (Array.isArray(input)) {
      input.forEach((item) => {
        if (typeof item === 'string') {
          pushName(item);
          return;
        }
        if (isRecord(item)) {
          pushName(item.name);
          pushName(item.agent);
          pushName(item.id);
        }
      });
      return names;
    }

    if (isRecord(input)) {
      const maybeList = input.agents;
      if (Array.isArray(maybeList)) {
        return collectFromJson(maybeList);
      }
    }

    return names;
  };

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const fromJson = collectFromJson(parsed);
    if (fromJson.length > 0) {
      return fromJson;
    }
  } catch {
    // Not JSON output, continue with plain-text parser.
  }

  const agents: string[] = [];
  const seen = new Set<string>();
  const ignoreTokens = new Set([
    'name',
    'agent',
    'agents',
    'model',
    'status',
    'workspace',
    'directory',
    'default',
    'current',
    'available',
    'active',
    'none',
    'no',
    'all',
    'total',
    'count',
    'configured',
    'using',
  ]);

  cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/^[-=+|]+$/.test(line)) return;
      if (line.endsWith(':')) return;

      let candidate = '';
      if (line.includes('|')) {
        const firstCell = line
          .split('|')
          .map((cell) => cell.trim())
          .find(Boolean);
        candidate = (firstCell ?? '').replace(/^[*>\-•\s]+/, '').replace(/[:*]+$/, '');
      } else {
        const matched = line.match(/^[*>\-•\s]*([a-zA-Z0-9_-]+)(?:\s+|$)/);
        candidate = (matched?.[1] ?? '').replace(/[:*]+$/, '');
      }

      if (!candidate) return;
      const normalized = candidate.trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) return;
      if (ignoreTokens.has(normalized.toLowerCase())) return;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        agents.push(normalized);
      }
    });

  return agents;
}

function parseAgentConfigList(stdout: string): Array<{ name: string; model: string | null }> {
  const cleaned = stripAnsi(stdout).trim();
  if (!cleaned) return [];

  const normalizeName = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
    return trimmed;
  };

  const normalizeModel = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const collect = (input: unknown): Array<{ name: string; model: string | null }> => {
    if (!Array.isArray(input)) return [];
    const output: Array<{ name: string; model: string | null }> = [];
    input.forEach((item) => {
      if (!isRecord(item)) return;
      const name =
        normalizeName(item.name) ??
        normalizeName(item.id) ??
        normalizeName(item.agent);
      if (!name) return;
      output.push({ name, model: normalizeModel(item.model) });
    });
    return output;
  };

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) {
      return collect(parsed);
    }
    if (isRecord(parsed) && Array.isArray(parsed.agents)) {
      return collect(parsed.agents);
    }
  } catch {
    // Ignore malformed config output and fallback to empty list.
  }

  return [];
}

function parseAgentWorkspaceConfigList(stdout: string): Array<{ name: string; workspace: string | null }> {
  const cleaned = stripAnsi(stdout).trim();
  if (!cleaned) return [];

  const normalizeName = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
    return trimmed;
  };

  const normalizeWorkspace = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!isRecord(item)) return null;
        const name =
          normalizeName(item.name) ??
          normalizeName(item.id) ??
          normalizeName(item.agent);
        if (!name) return null;
        return { name, workspace: normalizeWorkspace(item.workspace) };
      })
      .filter((item): item is { name: string; workspace: string | null } => Boolean(item));
  } catch {
    return [];
  }
}

function classifyAgentCreateError(
  step: AgentCreateStep,
  result: OpenClawExecResult
): { code: AgentCreateErrorCode; message: string } {
  const text = `${result.error ?? ''}\n${result.stderr}\n${result.stdout}`.toLowerCase();
  if (text.includes('enoent') || text.includes('not found') || text.includes('is not recognized')) {
    return { code: 'CLI_NOT_FOUND', message: 'OpenClaw CLI not found or not executable' };
  }
  if (text.includes('already exists') || text.includes('agent exists')) {
    return { code: 'AGENT_EXISTS', message: 'Agent already exists' };
  }
  if (text.includes('invalid model') || text.includes('unknown model') || text.includes('model not found')) {
    return { code: 'MODEL_INVALID', message: 'Model is invalid or unavailable' };
  }
  if (text.includes('permission denied') || text.includes('eacces') || text.includes('eperm')) {
    return { code: 'PATH_PERMISSION_DENIED', message: 'Permission denied for workspace or agent directory path' };
  }
  if (step === 'init_session') {
    return { code: 'SESSION_INIT_FAILED', message: 'Failed to initialize local session for the new agent' };
  }
  if (step === 'restart_gateway') {
    return { code: 'GATEWAY_RESTART_FAILED', message: 'Failed to restart OpenClaw gateway' };
  }
  return { code: 'COMMAND_FAILED', message: 'OpenClaw command execution failed' };
}

function getCommandText(result: OpenClawExecResult): string {
  return stripAnsi(`${result.error ?? ''}\n${result.stderr}\n${result.stdout}`).trim();
}

function isUnsupportedCommandOutput(output: string): boolean {
  const text = output.toLowerCase();
  return (
    text.includes('unknown command') ||
    text.includes('unknown option') ||
    text.includes('not a valid command') ||
    text.includes('did you mean') ||
    text.includes('invalid choice')
  );
}

function inferGatewayState(output: string): boolean | null {
  const text = output.toLowerCase();
  if (!text.trim()) return null;
  if (
    text.includes('not running') ||
    text.includes('stopped') ||
    text.includes('inactive') ||
    text.includes('down') ||
    text.includes('failed')
  ) {
    return false;
  }
  if (
    text.includes('running') ||
    text.includes('started') ||
    text.includes('healthy') ||
    text.includes('ready') ||
    text.includes('listening') ||
    text.includes('active') ||
    /\bok\b/.test(text)
  ) {
    return true;
  }
  return null;
}

class AsyncEventQueue {
  private queue: AdapterEvent[] = [];
  private resolvers: Array<(value: IteratorResult<AdapterEvent>) => void> = [];
  private closed = false;

  push(event: AdapterEvent) {
    if (this.closed) return;
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      resolve?.({ value: event, done: false });
      return;
    }
    this.queue.push(event);
  }

  close() {
    this.closed = true;
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      resolve?.({ value: undefined as any, done: true });
    }
  }

  async *stream(): AsyncIterable<AdapterEvent> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift() as AdapterEvent;
        continue;
      }
      if (this.closed) return;
      const next = await new Promise<IteratorResult<AdapterEvent>>((resolve) => {
        this.resolvers.push(resolve);
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

export class OpenClawRealAdapter implements OpenClawAdapter {
  private tasks = new Map<string, TaskRecord>();

  constructor(private options: { cliPath?: string }) { }

  private getOpenClawBinary(): string {
    const configured = this.options.cliPath?.trim() || env.openclawBinary?.trim();
    return configured || 'openclaw';
  }

  private runOpenClawCommand(
    args: string[],
    options?: { cwd?: string; timeoutMs?: number }
  ): Promise<OpenClawExecResult> {
    return new Promise((resolve) => {
      const binary = this.getOpenClawBinary();
      const timeoutMs = options?.timeoutMs ?? 120_000;
      const proc = spawn(binary, args, {
        cwd: options?.cwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      let timeout: NodeJS.Timeout | null = null;

      const finish = (result: OpenClawExecResult) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        resolve(result);
      };

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (error) => {
        finish({ code: 1, stdout, stderr, error: error.message });
      });

      proc.on('close', (code) => {
        finish({ code: code ?? 1, stdout, stderr });
      });

      timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        finish({
          code: 1,
          stdout,
          stderr,
          error: `Command timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);
    });
  }

  async listAgents(): Promise<string[]> {
    const result = await this.runOpenClawCommand(['agents', 'list']);
    const agents = parseAgentList(result.stdout);
    if (result.code !== 0) {
      const detail = summarizeStderr(result.stderr);
      throw new Error(`Failed to list agents${detail ? `: ${detail}` : ''}`);
    }

    if (agents.length === 0) return [];

    const agentsRoot = path.join(os.homedir(), '.openclaw', 'agents');
    try {
      const entries = await fs.readdir(agentsRoot, { withFileTypes: true });
      const dirAgents = new Set(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name.trim())
          .filter((name) => /^[a-zA-Z0-9_-]+$/.test(name))
      );
      return agents.filter((name) => dirAgents.has(name));
    } catch {
      // If local directory cannot be read, trust CLI output.
      return agents;
    }
  }

  async listModels(): Promise<string[]> {
    const result = await this.runOpenClawCommand(['models', 'list']);
    const models = parseModelList(result.stdout);
    if (models.length > 0) {
      return models;
    }
    const detail = summarizeStderr(result.stderr);
    if (result.code !== 0) {
      throw new Error(`Failed to list models${detail ? `: ${detail}` : ''}`);
    }
    return [];
  }

  async getAgentModel(agentName: string): Promise<AgentModelSelection> {
    const targetAgent = agentName.trim();
    if (!targetAgent) {
      throw new Error('Agent name is required');
    }

    const agents = await this.listAgents();
    const agentIndex = agents.findIndex((name) => name === targetAgent);
    if (agentIndex < 0) {
      throw new Error(`Agent not found: ${targetAgent}`);
    }

    const configResult = await this.runOpenClawCommand(['config', 'get', 'agents.list']);
    if (configResult.code !== 0) {
      const detail = summarizeStderr(configResult.stderr);
      throw new Error(`Failed to read agent model from config${detail ? `: ${detail}` : ''}`);
    }

    const configList = parseAgentConfigList(configResult.stdout);
    const byIndex = configList[agentIndex];
    if (byIndex && byIndex.name === targetAgent) {
      return { agentName: targetAgent, agentIndex, model: byIndex.model };
    }

    const byName = configList.find((item) => item.name === targetAgent);
    return {
      agentName: targetAgent,
      agentIndex,
      model: byName?.model ?? null,
    };
  }

  async setAgentModel(agentName: string, model: string): Promise<AgentModelUpdateResult> {
    const targetAgent = agentName.trim();
    const targetModel = model.trim();
    if (!targetAgent) {
      throw new Error('Agent name is required');
    }
    if (!targetModel) {
      throw new Error('Model is required');
    }

    const selection = await this.getAgentModel(targetAgent);
    const binary = this.getOpenClawBinary();
    const args = ['config', 'set', `agents.list[${selection.agentIndex}].model`, targetModel];
    const result = await this.runOpenClawCommand(args, { timeoutMs: 120_000 });
    if (result.code !== 0) {
      const detail = summarizeStderr(result.stderr);
      throw new Error(`Failed to set agent model${detail ? `: ${detail}` : ''}`);
    }

    return {
      agentName: targetAgent,
      agentIndex: selection.agentIndex,
      model: targetModel,
      command: [binary, ...args],
    };
  }

  async getAgentWorkspace(agentName: string): Promise<AgentWorkspaceInfo> {
    const targetAgent = agentName.trim();
    if (!targetAgent) {
      throw new Error('Agent name is required');
    }

    const agents = await this.listAgents();
    const agentIndex = agents.findIndex((name) => name === targetAgent);
    if (agentIndex < 0) {
      throw new Error(`Agent not found: ${targetAgent}`);
    }

    const defaultWorkspaceResult = await this.runOpenClawCommand(['config', 'get', 'agents.defaults.workspace']);
    if (defaultWorkspaceResult.code !== 0) {
      const detail = summarizeStderr(defaultWorkspaceResult.stderr);
      throw new Error(`Failed to read default workspace${detail ? `: ${detail}` : ''}`);
    }
    const defaultWorkspace = parseWorkspaceValue(defaultWorkspaceResult.stdout);

    const configResult = await this.runOpenClawCommand(['config', 'get', 'agents.list']);
    let workspaceFromAgent: string | null = null;
    if (configResult.code === 0) {
      const list = parseAgentWorkspaceConfigList(configResult.stdout);
      const byIndex = list[agentIndex];
      if (byIndex?.name === targetAgent && byIndex.workspace) {
        workspaceFromAgent = byIndex.workspace;
      } else {
        workspaceFromAgent = list.find((item) => item.name === targetAgent)?.workspace ?? null;
      }
    }

    const workspace = workspaceFromAgent ?? defaultWorkspace;
    if (!workspace) {
      throw new Error(`Workspace not found for agent: ${targetAgent}`);
    }

    return {
      agentName: targetAgent,
      agentIndex,
      workspace,
      defaultWorkspace,
    };
  }

  async createAgent(input: AgentCreateInput): Promise<AgentCreateResult> {
    const name = input.name.trim();
    const workspace = input.workspace.trim();
    const agentDir = input.agentDir.trim();
    const model = input.model.trim();
    const binary = this.getOpenClawBinary();
    const steps: AgentCreateStepResult[] = [];

    const runCreateStep = async (step: AgentCreateStep, args: string[]) => {
      const result = await this.runOpenClawCommand(args, { timeoutMs: 180_000 });
      const baseStep: AgentCreateStepResult = {
        step,
        command: [binary, ...args],
        status: result.code === 0 ? 'succeeded' : 'failed',
        exitCode: result.code,
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr),
      };
      if (result.code !== 0 || result.error) {
        const classified = classifyAgentCreateError(step, result);
        const detail = summarizeStderr(result.stderr);
        const errorMessage = [classified.message, result.error, detail].filter(Boolean).join(': ');
        const failedStep: AgentCreateStepResult = {
          ...baseStep,
          status: 'failed',
          error: errorMessage || classified.message,
        };
        steps.push(failedStep);
        throw new OpenClawAgentCreateError(step, classified.code, failedStep, [...steps]);
      }
      steps.push(baseStep);
    };

    await runCreateStep('create_agent', [
      'agents',
      'add',
      name,
      '--workspace',
      workspace,
      '--agent-dir',
      agentDir,
      '--model',
      model,
      '--non-interactive',
    ]);

    await runCreateStep('init_session', ['agent', '--agent', name, '--message', '你好']);

    await runCreateStep('restart_gateway', ['gateway', 'restart']);

    return { name, steps };
  }

  private async ensureOpenClawConfig(config: {
    modelName: string;
    baseUrl?: string | null;
    apiKey?: string | null;
    workDir?: string | null;
  }): Promise<void> {
    const modelRef = parseModelRef(config.modelName);
    const baseUrl = normalizeBaseUrl(config.baseUrl ?? '');
    const isOpenAiCompatModel = modelRef?.providerId === 'openai';

    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    let raw = '';
    let current: OpenClawConfigFile = {};

    try {
      raw = await fs.readFile(configPath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) current = parsed as OpenClawConfigFile;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        console.warn(`[openclaw] failed to read config file: ${err.message}`);
        return;
      }
    }

    const modelsSection = isRecord(current.models) ? current.models : {};
    const providersRaw = modelsSection.providers;
    const providers: Record<string, OpenClawProviderEntry> =
      isRecord(providersRaw) ? (providersRaw as Record<string, OpenClawProviderEntry>) : {};

    let nextProviders = providers;
    if (isOpenAiCompatModel && modelRef && baseUrl) {
      const existingProviderRaw = providers[modelRef.providerId];
      const existingProvider: OpenClawProviderEntry = isRecord(existingProviderRaw) ? existingProviderRaw : {};

      const existingModelsRaw = existingProvider.models;
      const existingModels: OpenClawProviderModelEntry[] = Array.isArray(existingModelsRaw)
        ? existingModelsRaw.filter(
          (entry): entry is OpenClawProviderModelEntry => isRecord(entry) && typeof entry.id === 'string'
        )
        : [];

      const hasModel = existingModels.some((entry) => entry.id === modelRef.modelId);
      const nextModels = hasModel
        ? existingModels
        : [
          ...existingModels,
          {
            id: modelRef.modelId,
            name: `${modelRef.modelId} (Local Service)`,
            reasoning: false,
            input: ['text'],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 32000,
            maxTokens: 4096,
          },
        ];

      const nextProvider: OpenClawProviderEntry = {
        ...existingProvider,
        baseUrl,
        api: typeof existingProvider.api === 'string' ? existingProvider.api : 'openai-completions',
        models: nextModels,
      };

      const apiKey = config.apiKey?.trim();
      if (apiKey) {
        nextProvider.apiKey = apiKey;
      }

      nextProviders = {
        ...providers,
        [modelRef.providerId]: nextProvider,
      };
    }

    const agentsSection = isRecord(current.agents) ? current.agents : {};
    const defaultsSection = isRecord(agentsSection.defaults) ? agentsSection.defaults : {};
    const modelSection = isRecord(defaultsSection.model) ? defaultsSection.model : {};
    const modelAliasesRaw = defaultsSection.models;
    const modelAliases: Record<string, JsonRecord> =
      isRecord(modelAliasesRaw) ? (modelAliasesRaw as Record<string, JsonRecord>) : {};
    const existingAlias = modelAliases[config.modelName];
    const safeAlias = isRecord(existingAlias) ? existingAlias : {};

    const configuredWorkDir = config.workDir?.trim() ? resolveWorkDir(config.workDir) : undefined;

    const toolsSection = isRecord(current.tools) ? current.tools : {};
    const webSection = getNestedRecord(toolsSection, 'web') ?? {};
    const searchSection = getNestedRecord(webSection, 'search') ?? {};
    const fetchSection = getNestedRecord(webSection, 'fetch') ?? {};
    const webTools = buildWebToolsConfig(
      { search: searchSection, fetch: fetchSection },
      {
        searchEnabled: env.openclawWebSearchEnabled,
        searchProvider: env.openclawWebSearchProvider,
        searchApiKey: env.openclawWebSearchApiKey,
        searchPerplexityBaseUrl: env.openclawWebSearchPerplexityBaseUrl,
        searchPerplexityModel: env.openclawWebSearchPerplexityModel,
        fetchEnabled: env.openclawWebFetchEnabled,
      }
    );
    const nextTools = webTools.changed
      ? {
        ...toolsSection,
        web: {
          ...webSection,
          ...(webTools.search ? { search: webTools.search } : {}),
          ...(webTools.fetch ? { fetch: webTools.fetch } : {}),
        },
      }
      : toolsSection;

    const next: OpenClawConfigFile = {
      ...current,
      models: {
        ...modelsSection,
        mode: typeof modelsSection.mode === 'string' ? modelsSection.mode : 'merge',
        providers: nextProviders,
      },
      agents: {
        ...agentsSection,
        defaults: {
          ...defaultsSection,
          model: {
            ...modelSection,
            primary: config.modelName,
          },
          models: {
            ...modelAliases,
            [config.modelName]: safeAlias,
          },
          ...(configuredWorkDir ? { workspace: configuredWorkDir } : {}),
        },
      },
      ...(webTools.changed ? { tools: nextTools } : {}),
    };

    const nextRaw = `${JSON.stringify(next, null, 2)}\n`;
    if (nextRaw === raw) return;

    try {
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tempPath, nextRaw, 'utf8');
      await fs.rename(tempPath, configPath);
    } catch (error) {
      const err = error as Error;
      console.warn(`[openclaw] failed to update config file: ${err.message}`);
    }
  }

  async submitTask(input: AdapterTaskInput, ctx: AdapterContext): Promise<AdapterTaskHandle> {
    const externalTaskId = `cli_${randomUUID()}`;
    const record: TaskRecord = {
      status: 'running',
      logs: [],
      events: [],
    };
    this.tasks.set(externalTaskId, record);

    const queue = new AsyncEventQueue();

    const pushEvent = (event: AdapterEvent) => {
      record.events.push(event);
      if (event.type === 'log') {
        record.logs.push({ level: event.level, message: event.message });
      }
      if (event.type === 'status') {
        record.status = event.status;
      }
      if (event.type === 'result') {
        record.result = event.output ?? {};
      }
      queue.push(event);
    };

    pushEvent({ type: 'status', status: 'running', message: 'OpenClaw CLI started' });

    const workspace = resolveWorkDir(ctx.config.workDir);
    try {
      await fs.mkdir(workspace, { recursive: true });
    } catch (error) {
      const err = error as Error;
      pushEvent({ type: 'status', status: 'failed', message: `Workspace prepare failed: ${err.message}` });
      queue.close();
      return { externalTaskId, eventStream: queue.stream() };
    }

    const webSearchHint = await resolveWebSearchHint();
    if (shouldApplyWebPromptGuard(input.input) && webSearchHint && !webSearchHint.configured) {
      pushEvent({
        type: 'log',
        level: 'warn',
        message: `Web search not configured: ${webSearchHint.summary}`,
      });
    }
    const guardedInput = buildPromptWithGuards(input.input, { webSearchHint });
    const hasCustomRunTemplate = Boolean(env.openclawRunCmd);
    const rawAgentName = input.agentName?.trim();
    const resolvedAgentName =
      rawAgentName && /^[a-zA-Z0-9_-]+$/.test(rawAgentName) ? rawAgentName : 'main';
    const defaultArgs = ['agent', '--local', '--agent', resolvedAgentName, '--message', guardedInput, '--json'];
    if (input.sessionId?.trim()) {
      defaultArgs.splice(defaultArgs.length - 1, 0, '--session-id', input.sessionId.trim());
    }

    const proc = hasCustomRunTemplate
      ? (() => {
        const template = env.openclawRunCmd ?? `openclaw agent --message "{prompt}" --json`;
        const resolvedSessionId = input.sessionId?.trim() ?? '';
        const command = template
          .replace(/\{prompt\}/g, guardedInput.replace(/"/g, '\\"'))
          .replace(/\{workspace\}/g, workspace.replace(/"/g, '\\"'))
          .replace(/\{agent\}/g, resolvedAgentName.replace(/"/g, '\\"'))
          .replace(/\{sessionId\}/g, resolvedSessionId.replace(/"/g, '\\"'));
        const shellCommand = `cd '${workspace.replace(/'/g, `'\\''`)}' && ${command}`;
        return spawn(shellCommand, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
      })()
      : spawn(this.getOpenClawBinary(), defaultArgs, { cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      const raw = chunk.toString();
      stderr += raw;
      const message = raw.trim();
      if (message) {
        pushEvent({ type: 'log', level: 'info', message });
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const detail = summarizeStderr(stderr);
        pushEvent({
          type: 'status',
          status: 'failed',
          message: `OpenClaw CLI failed (exit ${code})${detail ? `: ${detail}` : ''}`,
        });
        queue.close();
        return;
      }
      const output = parseJsonOutput(stdout);
      if (!output) {
        const detail = summarizeStderr(stderr);
        pushEvent({
          type: 'result',
          output: { raw: stdout },
        });
        pushEvent({
          type: 'status',
          status: 'failed',
          message: `OpenClaw CLI returned non-JSON output${detail ? `: ${detail}` : ''}`,
        });
        queue.close();
        return;
      }
      const outputError = extractOutputError(output);
      if (outputError) {
        pushEvent({ type: 'result', output });
        pushEvent({
          type: 'status',
          status: 'failed',
          message: `OpenClaw CLI error: ${outputError}`,
        });
        queue.close();
        return;
      }
      if (!hasTextPayload(output)) {
        const detail = summarizeStderr(stderr);
        if (detail) {
          pushEvent({ type: 'log', level: 'warn', message: `OpenClaw CLI warning: ${detail}` });
        }
      }
      pushEvent({ type: 'result', output });
      pushEvent({ type: 'status', status: 'succeeded', message: 'OpenClaw CLI completed' });
      queue.close();
    });

    proc.on('error', (err) => {
      pushEvent({ type: 'status', status: 'failed', message: err.message });
      queue.close();
    });

    return { externalTaskId, eventStream: queue.stream() };
  }

  async getTaskStatus(externalTaskId: string): Promise<{ status: TaskStatus }> {
    return { status: this.tasks.get(externalTaskId)?.status ?? 'failed' };
  }

  async getTaskLogs(externalTaskId: string): Promise<Array<{ level: LogLevel; message: string }>> {
    return this.tasks.get(externalTaskId)?.logs ?? [];
  }

  async *streamTaskEvents(externalTaskId: string): AsyncIterable<AdapterEvent> {
    const record = this.tasks.get(externalTaskId);
    if (!record) return;
    for (const event of record.events) {
      yield event;
    }
  }

  async syncLocalConfig(config: {
    modelName: string;
    apiKey?: string | null;
    modelMode?: string;
    baseUrl?: string | null;
    workDir?: string | null;
  }, options?: { skipGatewayRestart?: boolean }): Promise<void> {
    const provider = getOpenClawProvider(config.modelMode ?? null);
    const modelName = config?.modelName ?? getBackendModelName(config.modelMode ?? null);
    if (!modelName) return;
    const modelRef = parseModelRef(modelName);
    const providerFromModel = modelRef?.providerId?.trim() || provider || 'openai';

    const parseModelCandidates = (raw: string): string[] =>
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^([a-z0-9_.-]+\/[\w./:-]+)\b/i);
          if (!match) return null;
          return /missing/i.test(line) ? null : match[1];
        })
        .filter((value): value is string => Boolean(value));

    // Keep OpenClaw runtime config in sync: model alias, workspace,
    // and openai-compatible provider model registration.
    await this.ensureOpenClawConfig({
      modelName,
      baseUrl: config.baseUrl ?? null,
      apiKey: config.apiKey ?? null,
      workDir: config.workDir ?? null,
    });

    // 1) Check whether target model exists in list.
    const listBefore = await runCommand('openclaw models list');
    if (listBefore.code !== 0) {
      console.warn(`[openclaw] models list failed: ${listBefore.stderr || listBefore.stdout}`);
    } else {
      const hasTargetModel = listBefore.stdout
        .split('\n')
        .map((line) => line.trim())
        .some((line) => line.startsWith(modelName) && !/missing/i.test(line));
      if (!hasTargetModel) {
        console.warn(`[openclaw] target model not found in models list: ${modelName}`);
      }
    }

    // 2) Export provider-specific API key env var (OPENAI_API_KEY / ANTHROPIC_API_KEY / ...).
    const apiKey = config.apiKey?.trim();
    if (apiKey) {
      const keyEnvName = toProviderApiKeyEnvName(providerFromModel);
      process.env[keyEnvName] = apiKey;
      const exportCmd = `export ${keyEnvName}="${escapeDoubleQuotedShellValue(apiKey)}"`;
      console.log(`[openclaw] exec: ${exportCmd}`);
      const exportResult = await runCommand(exportCmd);
      if (exportResult.code !== 0) {
        console.warn(`[openclaw] export ${keyEnvName} failed: ${exportResult.stderr || exportResult.stdout}`);
      }
    }

    // Optional auth setup (provider + baseUrl + apiKey)
    if (provider !== 'openai' && env.openclawAuthCmd && config.apiKey) {
      const authCmd = env.openclawAuthCmd
        .replace(/\{provider\}/g, provider)
        .replace(/\{apiKey\}/g, config.apiKey.replace(/\"/g, '\\"'))
        .replace(/\{baseUrl\}/g, (config.baseUrl ?? '').replace(/\"/g, '\\"'));
      const authResult = await runCommand(authCmd);
      if (authResult.code !== 0) {
        console.warn(`[openclaw] auth setup failed: ${authResult.stderr || authResult.stdout}`);
      }
    }

    // 3) Set default model
    const setCmd = `openclaw models set "${modelName.replace(/\"/g, '\\"')}"`;
    const setResult = await runCommand(setCmd);

    const pickFallback = async (cachedListStdout?: string) => {
      if (cachedListStdout) {
        const cachedCandidates = parseModelCandidates(cachedListStdout);
        if (cachedCandidates.length > 0) return cachedCandidates[0];
      }
      const listResult = await runCommand('openclaw models list');
      const candidates = parseModelCandidates(listResult.stdout);
      return candidates[0];
    };

    let activeModel = modelName;
    if (setResult.code !== 0) {
      const fallback = await pickFallback(listBefore.stdout);
      if (fallback) {
        const fallbackSetCmd = `openclaw models set "${fallback.replace(/\"/g, '\\"')}"`;
        console.log(`[openclaw] exec: ${fallbackSetCmd}`);
        const fallbackSet = await runCommand(fallbackSetCmd);
        if (fallbackSet.code !== 0) {
          throw new Error(`Failed to set model: ${modelName}`);
        }
        activeModel = fallback;
        console.warn(`[openclaw] model not found: ${modelName}, fallback to ${fallback}`);
      } else {
        throw new Error(`Failed to set model: ${modelName}`);
      }
    }

    // Verify model isn't marked missing
    console.log('[openclaw] exec: openclaw models list');
    const listResult2 = await runCommand('openclaw models list');
    const line = listResult2.stdout
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith(activeModel));
    if (line && /missing/i.test(line)) {
      const fallback = await pickFallback();
      if (fallback) {
        const fallbackSetCmd = `openclaw models set "${fallback.replace(/\"/g, '\\"')}"`;
        console.log(`[openclaw] exec: ${fallbackSetCmd}`);
        const fallbackSet = await runCommand(fallbackSetCmd);
        if (fallbackSet.code === 0) {
          activeModel = fallback;
          console.warn(`[openclaw] model missing: ${modelName}, fallback to ${fallback}`);
        }
      }
    }

    // 4) Restart gateway (optional skip at process startup to avoid redundant restart)
    if (options?.skipGatewayRestart) {
      console.log('[openclaw] skip gateway restart (startup sync)');
    } else {
      console.log('[openclaw] exec: openclaw gateway restart');
      const restartResult = await runCommand('openclaw gateway restart');
      if (restartResult.code !== 0) {
        console.warn(`[openclaw] gateway restart failed: ${restartResult.stderr || restartResult.stdout}`);
      }
    }

    // 5) Check model status
    console.log('[openclaw] exec: openclaw models status');
    const statusResult = await runCommand('openclaw models status');
    if (statusResult.code !== 0) {
      console.warn(`[openclaw] models status failed: ${statusResult.stderr || statusResult.stdout}`);
    }

    // 6) Probe model status
    console.log('[openclaw] exec: openclaw models status --probe');
    const probeResult = await runCommand('openclaw models status --probe');
    if (probeResult.code !== 0) {
      console.warn(`[openclaw] models status --probe failed: ${probeResult.stderr || probeResult.stdout}`);
    }
  }

  async checkEnvironment(): Promise<EnvCheckResult> {
    const checkedAt = new Date().toISOString();
    const binary = this.getOpenClawBinary();
    const versionResult = await this.runOpenClawCommand(['--version'], { timeoutMs: 10_000 });
    const versionOutput = getCommandText(versionResult);
    const cliAvailable = versionResult.code === 0 && !versionResult.error;
    if (!cliAvailable) {
      const detail = summarizeStderr(versionResult.stderr) || versionResult.error || versionOutput;
      return {
        status: 'fail',
        summary: `OpenClaw CLI unavailable${detail ? `: ${detail}` : ''}`,
        checkedAt,
        details: {
          binary,
          cliAvailable: false,
          command: [binary, '--version'],
          error: detail || 'CLI probe failed',
        },
      };
    }

    const version = versionOutput
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    const [agentsResult, modelsResult, gatewayResult] = await Promise.all([
      this.runOpenClawCommand(['agents', 'list'], { timeoutMs: 20_000 }),
      this.runOpenClawCommand(['models', 'list'], { timeoutMs: 20_000 }),
      this.runOpenClawCommand(['gateway', 'status'], { timeoutMs: 15_000 }),
    ]);

    const agents = agentsResult.code === 0 ? parseAgentList(agentsResult.stdout) : [];
    const models = modelsResult.code === 0 ? parseModelList(modelsResult.stdout) : [];
    const gatewayOutput = getCommandText(gatewayResult);
    const gatewayUnsupported = isUnsupportedCommandOutput(gatewayOutput);
    const gatewayState = gatewayUnsupported ? null : inferGatewayState(gatewayOutput);
    const warnings: string[] = [];
    let status: EnvCheckResult['status'] = 'ok';

    if (agentsResult.code !== 0) warnings.push('agents list failed');
    if (modelsResult.code !== 0) warnings.push('models list failed');
    if (modelsResult.code === 0 && models.length === 0) warnings.push('no available models');
    if (gatewayResult.code !== 0 && !gatewayUnsupported) warnings.push('gateway status check failed');
    if (gatewayState === false) warnings.push('gateway not running');
    if (warnings.length > 0) {
      status = agentsResult.code !== 0 && modelsResult.code !== 0 ? 'fail' : 'warn';
    }

    const summary =
      warnings.length === 0
        ? 'OpenClaw runtime checks passed'
        : `OpenClaw runtime checks completed with ${status === 'fail' ? 'failures' : 'warnings'}: ${warnings.join(', ')}`;

    return {
      status,
      summary,
      checkedAt,
      details: {
        binary,
        cliAvailable: true,
        version: version ?? null,
        agentsCount: agents.length,
        modelsCount: models.length,
        gateway: {
          supported: !gatewayUnsupported,
          healthy: gatewayState,
          command: [binary, 'gateway', 'status'],
          exitCode: gatewayResult.code,
          detail: summarizeStderr(gatewayResult.stderr) || null,
        },
      },
    };
  }

  async getAgentHealth(): Promise<AgentHealth> {
    const lastCheckedAt = new Date().toISOString();
    const binary = this.getOpenClawBinary();
    const versionResult = await this.runOpenClawCommand(['--version'], { timeoutMs: 10_000 });
    const versionOutput = getCommandText(versionResult);
    if (versionResult.code !== 0 || versionResult.error) {
      const detail = summarizeStderr(versionResult.stderr) || versionResult.error || versionOutput;
      return {
        status: 'down',
        message: detail
          ? `OpenClaw CLI unavailable: ${detail}`
          : `OpenClaw CLI unavailable: failed to execute ${binary}`,
        lastCheckedAt,
      };
    }

    const gatewayResult = await this.runOpenClawCommand(['gateway', 'status'], { timeoutMs: 12_000 });
    const gatewayOutput = getCommandText(gatewayResult);
    const gatewayUnsupported = isUnsupportedCommandOutput(gatewayOutput);
    if (gatewayUnsupported) {
      const fallback = await this.runOpenClawCommand(['models', 'status', '--probe'], { timeoutMs: 12_000 });
      if (fallback.code === 0) {
        return {
          status: 'ok',
          message: 'OpenClaw CLI available',
          lastCheckedAt,
        };
      }
      const detail = summarizeStderr(fallback.stderr) || summarizeStderr(gatewayResult.stderr);
      return {
        status: 'degraded',
        message: detail
          ? `OpenClaw CLI available, but probe failed: ${detail}`
          : 'OpenClaw CLI available, but probe failed',
        lastCheckedAt,
      };
    }

    const inferredGatewayState = inferGatewayState(gatewayOutput);
    if (gatewayResult.code === 0 && inferredGatewayState !== false) {
      return {
        status: 'ok',
        message: 'OpenClaw CLI available',
        lastCheckedAt,
      };
    }

    if (inferredGatewayState === false) {
      return {
        status: 'down',
        message: 'OpenClaw gateway is not running',
        lastCheckedAt,
      };
    }

    const detail = summarizeStderr(gatewayResult.stderr);
    return {
      status: 'degraded',
      message: detail
        ? `OpenClaw CLI available, but gateway status is unclear: ${detail}`
        : 'OpenClaw CLI available, but gateway status is unclear',
      lastCheckedAt,
    };
  }
}
