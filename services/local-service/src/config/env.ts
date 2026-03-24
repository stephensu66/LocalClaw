import os from 'os';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3980),
  OPENCLAW_MODE: z.enum(['mock', 'real']).default('mock'),
  OPENCLAW_BINARY: z.string().default('openclaw'),
  OPENCLAW_INSTALL_SH: z.string().default('https://openclaw.ai/install.sh'),
  OPENCLAW_INSTALL_PS: z.string().default('https://openclaw.ai/install.ps1'),
  OPENCLAW_ONBOARD_CMD: z.string().optional(),
  OPENCLAW_GATEWAY_CMD: z.string().optional(),
  OPENCLAW_RUN_CMD: z.string().optional(),
  OPENCLAW_PLUGINS_LIST_CMD: z.string().default('openclaw plugins list'),
  OPENCLAW_PLUGIN_INSTALL_CMD: z.string().default('openclaw plugins install {provider}'),
  OPENCLAW_AUTH_CMD: z.string().optional(),
  OPENCLAW_WEB_SEARCH_ENABLED: z.string().optional(),
  OPENCLAW_WEB_SEARCH_PROVIDER: z.string().optional(),
  OPENCLAW_WEB_SEARCH_API_KEY: z.string().optional(),
  OPENCLAW_WEB_SEARCH_PERPLEXITY_BASE_URL: z.string().optional(),
  OPENCLAW_WEB_SEARCH_PERPLEXITY_MODEL: z.string().optional(),
  OPENCLAW_WEB_FETCH_ENABLED: z.string().optional(),
  APP_DATA_DIR: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const raw = envSchema.parse(process.env);
// console.log(2, raw, process.env)

const normalizeOptionalString = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parseOptionalBoolean = (value?: string) => {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const appDataDir = raw.APP_DATA_DIR ?? path.join(os.homedir(), '.openclaw');
const dbPath = path.join(appDataDir, 'openclaw.db');
const databaseUrl = process.env.DATABASE_URL ?? `file:${dbPath}`;
process.env.DATABASE_URL = databaseUrl;

export const env = {
  port: raw.PORT,
  openclawMode: raw.OPENCLAW_MODE,
  openclawBinary: raw.OPENCLAW_BINARY,
  openclawInstallSh: raw.OPENCLAW_INSTALL_SH,
  openclawInstallPs: raw.OPENCLAW_INSTALL_PS,
  openclawOnboardCmd: raw.OPENCLAW_ONBOARD_CMD,
  openclawGatewayCmd: raw.OPENCLAW_GATEWAY_CMD,
  openclawRunCmd: raw.OPENCLAW_RUN_CMD,
  openclawPluginsListCmd: raw.OPENCLAW_PLUGINS_LIST_CMD,
  openclawPluginInstallCmd: raw.OPENCLAW_PLUGIN_INSTALL_CMD,
  openclawAuthCmd: raw.OPENCLAW_AUTH_CMD,
  openclawWebSearchEnabled: parseOptionalBoolean(raw.OPENCLAW_WEB_SEARCH_ENABLED),
  openclawWebSearchProvider: normalizeOptionalString(raw.OPENCLAW_WEB_SEARCH_PROVIDER),
  openclawWebSearchApiKey: normalizeOptionalString(raw.OPENCLAW_WEB_SEARCH_API_KEY),
  openclawWebSearchPerplexityBaseUrl: normalizeOptionalString(raw.OPENCLAW_WEB_SEARCH_PERPLEXITY_BASE_URL),
  openclawWebSearchPerplexityModel: normalizeOptionalString(raw.OPENCLAW_WEB_SEARCH_PERPLEXITY_MODEL),
  openclawWebFetchEnabled: parseOptionalBoolean(raw.OPENCLAW_WEB_FETCH_ENABLED),
  appDataDir,
  databaseUrl,
  allowedOrigins: raw.ALLOWED_ORIGINS
    ? raw.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  logLevel: raw.LOG_LEVEL,
};

export type Env = typeof env;
