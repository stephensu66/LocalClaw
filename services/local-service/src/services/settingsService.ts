import type { PrismaClient, LocalConfig } from '@prisma/client';
import type { LocalConfigInput, LocalConfigView, ModelMode } from '@openclaw/shared';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { localConfigUpdateSchema } from '@openclaw/shared';
import { encryptString, decryptString } from '../utils/encryption';
import { defaultLocalConfig, defaultWorkDir } from '../config/localConfig';
import { getBackendModelName } from '../openclaw/providerMap';
import { PROVIDER_MAPPING } from '../openclaw/providerMap';
import { SseHub } from '../realtime/sse';

const LOCAL_CONFIG_ID = 'local';
const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');

type JsonRecord = Record<string, unknown>;

interface OpenClawConfigFile extends JsonRecord {
  models?: JsonRecord & {
    providers?: Record<string, JsonRecord>;
  };
  agents?: JsonRecord & {
    defaults?: JsonRecord & {
      model?: JsonRecord & {
        primary?: string;
      };
      workspace?: string;
    };
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeBaseUrl(raw?: string | null): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
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

function parseModelRef(modelName: string): { providerId: string; modelId: string } | null {
  const slashIndex = modelName.indexOf('/');
  if (slashIndex <= 0 || slashIndex >= modelName.length - 1) return null;
  return {
    providerId: modelName.slice(0, slashIndex),
    modelId: modelName.slice(slashIndex + 1),
  };
}

function inferModelMode(providerId: string, baseUrl?: string): ModelMode {
  if (providerId === 'ollama') return 'local_model';
  if (providerId === 'anthropic') return 'anthropic';
  if (providerId === 'google') return 'google';
  if (providerId === 'groq') return 'groq';
  if (providerId === 'perplexity') return 'perplexity';

  if (providerId === 'openai') {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized) return 'builtin';
    const match = Object.entries(PROVIDER_MAPPING).find(([, value]) => {
      if (!value.baseUrl) return false;
      return normalizeBaseUrl(value.baseUrl) === normalized;
    });
    if (match) return match[0] as ModelMode;
    return 'other';
  }

  return 'other';
}

export class SettingsService {
  constructor(private prisma: PrismaClient, private sse: SseHub) { }

  private toView(record: LocalConfig, options?: { onboarded?: boolean }): LocalConfigView {
    return {
      modelMode: record.modelMode.toLowerCase() as LocalConfigView['modelMode'],
      baseUrl: record.baseUrl,
      customModelName: record.customModelName,
      modelName: record.modelName,
      workDirAuto: record.workDirAuto,
      workDir: record.workDir,
      notificationsEnabled: record.notificationsEnabled,
      apiKeySet: Boolean(record.apiKeyCiphertext),
      onboarded: options?.onboarded ?? false,
    };
  }

  private toInternal(record: LocalConfig): LocalConfigInput {
    const apiKey =
      record.apiKeyCiphertext && record.apiKeyIv && record.apiKeyTag
        ? decryptString({
          cipherText: record.apiKeyCiphertext,
          iv: record.apiKeyIv,
          tag: record.apiKeyTag,
        })
        : null;

    return {
      modelMode: record.modelMode.toLowerCase() as LocalConfigInput['modelMode'],
      apiKey,
      baseUrl: record.baseUrl,
      customModelName: record.customModelName,
      modelName: record.modelName,
      workDirAuto: record.workDirAuto,
      workDir: record.workDir,
      notificationsEnabled: record.notificationsEnabled,
    };
  }

  async getView(): Promise<LocalConfigView> {
    const record = await this.getOrCreate();
    const onboarded = await this.hasOpenClawConfig();
    return this.toView(record, { onboarded });
  }

  async getInternal(): Promise<LocalConfigInput> {
    const record = await this.getOrCreate();
    return this.toInternal(record);
  }

  async update(input: Partial<LocalConfigInput>): Promise<LocalConfigView> {
    const parsed = localConfigUpdateSchema.parse(input);
    const current = await this.getOrCreate();

    const hasBaseUrl = Object.prototype.hasOwnProperty.call(parsed, 'baseUrl');
    const hasCustomName = Object.prototype.hasOwnProperty.call(parsed, 'customModelName');
    const hasModelMode = Object.prototype.hasOwnProperty.call(parsed, 'modelMode');

    let apiKeyCiphertext = current.apiKeyCiphertext;
    let apiKeyIv = current.apiKeyIv;
    let apiKeyTag = current.apiKeyTag;

    if (Object.prototype.hasOwnProperty.call(parsed, 'apiKey')) {
      if (!parsed.apiKey) {
        apiKeyCiphertext = null;
        apiKeyIv = null;
        apiKeyTag = null;
      } else {
        const encrypted = encryptString(parsed.apiKey);
        apiKeyCiphertext = encrypted.cipherText;
        apiKeyIv = encrypted.iv;
        apiKeyTag = encrypted.tag;
      }
    }

    const nextWorkDirAuto = parsed.workDirAuto ?? current.workDirAuto;
    const nextWorkDir = nextWorkDirAuto ? defaultWorkDir() : parsed.workDir ?? current.workDir;

    const desiredModelName =
      parsed.modelName ??
      (parsed.modelMode ? getBackendModelName(parsed.modelMode) : current.modelName);

    const updated = await this.prisma.localConfig.update({
      where: { id: LOCAL_CONFIG_ID },
      data: {
        ...(hasModelMode
          ? { modelMode: parsed.modelMode!.toUpperCase() as LocalConfig['modelMode'] }
          : {}),
        baseUrl: hasBaseUrl ? parsed.baseUrl ?? null : current.baseUrl,
        customModelName: hasCustomName ? parsed.customModelName ?? null : current.customModelName,
        modelName: desiredModelName,
        workDirAuto: nextWorkDirAuto,
        workDir: nextWorkDir,
        notificationsEnabled: parsed.notificationsEnabled ?? current.notificationsEnabled,
        apiKeyCiphertext,
        apiKeyIv,
        apiKeyTag,
      },
    });

    const onboarded = await this.hasOpenClawConfig();
    const view = this.toView(updated, { onboarded });
    this.sse.broadcast({ type: 'config.updated', payload: view });
    return view;
  }

  async hasOpenClawConfig(): Promise<boolean> {
    try {
      await fs.access(OPENCLAW_CONFIG_PATH);
      return true;
    } catch {
      return false;
    }
  }

  private async readOpenClawConfigFile(): Promise<OpenClawConfigFile | null> {
    try {
      const raw = await fs.readFile(OPENCLAW_CONFIG_PATH, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? (parsed as OpenClawConfigFile) : null;
    } catch {
      return null;
    }
  }

  private async buildSeedFromOpenClaw(): Promise<{ input: LocalConfigInput; apiKey?: string | null } | null> {
    const config = await this.readOpenClawConfigFile();
    if (!config) return null;

    const primaryModel = getNestedString(config, ['agents', 'defaults', 'model', 'primary']);
    if (!primaryModel) return null;
    const modelRef = parseModelRef(primaryModel);
    if (!modelRef) return null;

    const modelsSection = isRecord(config.models) ? config.models : undefined;
    const providersRaw = modelsSection?.providers;
    const providers = isRecord(providersRaw) ? (providersRaw as Record<string, JsonRecord>) : undefined;
    const providerEntry = providers ? providers[modelRef.providerId] : undefined;
    const provider = isRecord(providerEntry) ? providerEntry : undefined;

    const baseUrl = normalizeOptionalString(provider?.baseUrl as string | undefined);
    const apiKey = normalizeOptionalString(provider?.apiKey as string | undefined) ?? null;

    const workspace = getNestedString(config, ['agents', 'defaults', 'workspace']);
    const workDirAuto = !workspace;
    const workDir = workspace ?? defaultWorkDir();

    const modelMode = inferModelMode(modelRef.providerId, baseUrl);
    const customModelName = modelMode === 'other' ? modelRef.providerId : null;

    return {
      input: {
        modelMode,
        apiKey: null,
        baseUrl: baseUrl ?? null,
        customModelName,
        modelName: primaryModel,
        workDirAuto,
        workDir,
        notificationsEnabled: true,
      },
      apiKey,
    };
  }

  private async getOrCreate(): Promise<LocalConfig> {
    const existing = await this.prisma.localConfig.findUnique({ where: { id: LOCAL_CONFIG_ID } });
    if (existing) return existing;

    const defaults = defaultLocalConfig();
    const seed = await this.buildSeedFromOpenClaw();
    const source = seed?.input ?? defaults;
    const apiKey = seed?.apiKey ?? null;
    const encrypted = apiKey ? encryptString(apiKey) : null;

    return this.prisma.localConfig.create({
      data: {
        id: LOCAL_CONFIG_ID,
        modelMode: source.modelMode.toUpperCase() as LocalConfig['modelMode'],
        baseUrl: source.baseUrl,
        customModelName: source.customModelName,
        modelName: source.modelName,
        workDirAuto: source.workDirAuto,
        workDir: source.workDir,
        notificationsEnabled: source.notificationsEnabled,
        apiKeyCiphertext: encrypted?.cipherText ?? null,
        apiKeyIv: encrypted?.iv ?? null,
        apiKeyTag: encrypted?.tag ?? null,
      },
    });
  }
}
