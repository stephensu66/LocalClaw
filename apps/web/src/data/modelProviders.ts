import type { ModelMode } from '@openclaw/shared';
import type { Locale } from '../i18n';

export interface ModelProviderOption {
  id: ModelMode;
  region: 'cn' | 'us' | 'global' | 'internal';
  label: { en: string; zh: string };
  baseUrl?: { en?: string; zh?: string; default?: string };
  openclawProvider?: string;
  backendModelName?: string;
  requiresCustomName?: boolean;
  requiresBaseUrl?: boolean;
}

export const MODEL_PROVIDERS: ModelProviderOption[] = [
  // {
  //   id: 'builtin',
  //   region: 'internal',
  //   label: { en: 'Built-in', zh: '内置模式' },
  //   openclawProvider: 'openai',
  //   backendModelName: 'openai/gpt-4o',
  // },
  {
    id: 'deepseek',
    region: 'cn',
    label: { en: 'DeepSeek', zh: 'DeepSeek' },
    baseUrl: { default: 'https://api.deepseek.com/v1' },
    openclawProvider: 'openai',
    backendModelName: 'openai/deepseek-chat',
  },
  {
    id: 'alibaba_cloud',
    region: 'cn',
    label: { en: 'Qwen', zh: 'Qwen' },
    baseUrl: {
      zh: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      en: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
    },
    openclawProvider: 'openai',
    backendModelName: 'openai/qwen-max',
  },
  {
    id: 'moonshot',
    region: 'cn',
    label: { en: 'Moonshot AI', zh: 'Moonshot（Kimi）' },
    baseUrl: {
      zh: 'https://api.moonshot.cn/v1',
      en: 'https://api.moonshot.ai/v1',
    },
    openclawProvider: 'openai',
    backendModelName: 'openai/kimi-k2',
  },
  {
    id: 'zhipu',
    region: 'cn',
    label: { en: 'Zhipu AI', zh: '智谱 AI' },
    baseUrl: {
      zh: 'https://open.bigmodel.cn/api/paas/v4',
      en: 'https://api.z.ai/api/paas/v4/',
    },
    openclawProvider: 'openai',
    backendModelName: 'openai/glm-4-plus',
  },
  {
    id: 'minimax',
    region: 'cn',
    label: { en: 'MiniMax', zh: 'MiniMax' },
    baseUrl: { default: 'https://api.minimaxi.chat/v1' },
    openclawProvider: 'openai',
    backendModelName: 'openai/abab6.5s-chat',
  },
  {
    id: 'baidu',
    region: 'cn',
    label: { en: 'Baidu Qianfan', zh: '百度千帆' },
    baseUrl: { default: 'https://qianfan.baidubce.com/v2' },
    openclawProvider: 'openai',
    backendModelName: 'openai/ernie-4.0',
  },
  {
    id: 'tencent_hunyuan',
    region: 'cn',
    label: { en: 'Tencent Hunyuan', zh: '腾讯云混元' },
    baseUrl: { default: 'https://api.hunyuan.cloud.tencent.com/v1' },
    openclawProvider: 'openai',
    backendModelName: 'openai/hunyuan-standard',
  },
  {
    id: 'openai',
    region: 'us',
    label: { en: 'OpenAI', zh: 'OpenAI' },
    baseUrl: { default: 'https://api.openai.com/v1' },
    openclawProvider: 'openai',
    backendModelName: 'openai/gpt-4o',
  },
  {
    id: 'anthropic',
    region: 'us',
    label: { en: 'Anthropic', zh: 'Anthropic' },
    baseUrl: { default: 'https://api.anthropic.com/v1' },
    openclawProvider: 'anthropic',
    backendModelName: 'anthropic/claude-sonnet-4',
  },
  {
    id: 'google',
    region: 'us',
    label: { en: 'Google (Gemini)', zh: 'Google（Gemini）' },
    baseUrl: { default: 'https://generativelanguage.googleapis.com' },
    openclawProvider: 'google',
    backendModelName: 'google/gemini-2.5-pro',
  },
  {
    id: 'groq',
    region: 'us',
    label: { en: 'Groq', zh: 'Groq' },
    baseUrl: { default: 'https://api.groq.com/openai/v1' },
    openclawProvider: 'openai',
    backendModelName: 'openai/llama-3.3-70b',
  },
  {
    id: 'together_ai',
    region: 'us',
    label: { en: 'Together AI', zh: 'Together AI' },
    baseUrl: { default: 'https://api.together.xyz/v1' },
    openclawProvider: 'openai',
    backendModelName: 'openai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  },
  {
    id: 'fireworks_ai',
    region: 'us',
    label: { en: 'Fireworks AI', zh: 'Fireworks AI' },
    baseUrl: { default: 'https://api.fireworks.ai/inference/v1' },
    openclawProvider: 'openai',
    backendModelName: 'openai/llama-v3p1-70b-instruct',
  },
  {
    id: 'perplexity',
    region: 'us',
    label: { en: 'Perplexity AI', zh: 'Perplexity AI' },
    baseUrl: { default: 'https://api.perplexity.ai' },
    openclawProvider: 'openai',
    backendModelName: 'openai/sonar-pro',
  },
  {
    id: 'local_model',
    region: 'internal',
    label: { en: 'Local Model (Reserved)', zh: '本地模型（预留）' },
    openclawProvider: 'ollama',
    backendModelName: 'ollama/qwen2.5:7b',
  },
  {
    id: 'other',
    region: 'global',
    label: { en: 'Other (Custom)', zh: '其他（自定义）' },
    requiresCustomName: true,
    requiresBaseUrl: true,
    openclawProvider: 'openai',
    backendModelName: 'openai/gpt-4o',
  },
];

export function getProviderBaseUrl(providerId: ModelMode, locale: Locale): string | null {
  const provider = MODEL_PROVIDERS.find((item) => item.id === providerId);
  if (!provider?.baseUrl) return null;
  return provider.baseUrl[locale] ?? provider.baseUrl.default ?? null;
}

export function getOrderedProviders(locale: Locale): ModelProviderOption[] {
  const order = locale === 'zh' ? ['cn', 'us', 'global', 'internal'] : ['us', 'global', 'cn', 'internal'];
  return [...MODEL_PROVIDERS].sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region));
}

export function getBackendModelName(providerId: ModelMode): string {
  const provider = MODEL_PROVIDERS.find((item) => item.id === providerId);
  return provider?.backendModelName ?? 'openai/gpt-4o';
}
