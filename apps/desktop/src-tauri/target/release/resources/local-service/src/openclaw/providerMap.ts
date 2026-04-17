export type UiProviderId =
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
  | 'local_model'
  | 'other'
  | 'builtin';

export interface ProviderMapping {
  openclawProvider: string;
  baseUrl?: string;
  backendModelName?: string;
  notes?: string;
}

export const PROVIDER_MAPPING: Record<UiProviderId, ProviderMapping> = {
  deepseek: { openclawProvider: 'openai', baseUrl: 'https://api.deepseek.com/v1', backendModelName: 'openai/deepseek-chat' },
  alibaba_cloud: {
    openclawProvider: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    backendModelName: 'openai/qwen-max',
  },
  moonshot: { openclawProvider: 'openai', baseUrl: 'https://api.moonshot.cn/v1', backendModelName: 'openai/kimi-k2' },
  zhipu: { openclawProvider: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', backendModelName: 'openai/glm-4-plus' },
  minimax: { openclawProvider: 'openai', baseUrl: 'https://api.minimaxi.chat/v1', backendModelName: 'openai/abab6.5s-chat' },
  baidu: { openclawProvider: 'openai', baseUrl: 'https://qianfan.baidubce.com/v2', backendModelName: 'openai/ernie-4.0' },
  tencent_hunyuan: {
    openclawProvider: 'openai',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    backendModelName: 'openai/hunyuan-standard',
  },
  openai: { openclawProvider: 'openai', baseUrl: 'https://api.openai.com/v1', backendModelName: 'openai/gpt-4o' },
  anthropic: { openclawProvider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', backendModelName: 'anthropic/claude-sonnet-4' },
  google: {
    openclawProvider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    backendModelName: 'google/gemini-2.5-pro',
  },
  groq: { openclawProvider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', backendModelName: 'openai/llama-3.3-70b' },
  together_ai: { openclawProvider: 'openai', baseUrl: 'https://api.together.xyz/v1', backendModelName: 'openai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
  fireworks_ai: { openclawProvider: 'openai', baseUrl: 'https://api.fireworks.ai/inference/v1', backendModelName: 'openai/llama-v3p1-70b-instruct' },
  perplexity: { openclawProvider: 'openai', baseUrl: 'https://api.perplexity.ai', backendModelName: 'openai/sonar-pro' },
  local_model: { openclawProvider: 'ollama', notes: 'Local runtime (ollama/vllm)', backendModelName: 'ollama/qwen2.5:7b' },
  other: { openclawProvider: 'openai', backendModelName: 'openai/gpt-4o' },
  builtin: { openclawProvider: 'openai', backendModelName: 'openai/gpt-4o' },
};

export function getOpenClawProvider(uiProvider: string | null | undefined): string {
  if (!uiProvider) return 'openai';
  const key = uiProvider as UiProviderId;
  return PROVIDER_MAPPING[key]?.openclawProvider ?? 'openai';
}

export function getBackendModelName(uiProvider: string | null | undefined): string {
  if (!uiProvider) return 'openai/gpt-4o';
  const key = uiProvider as UiProviderId;
  return PROVIDER_MAPPING[key]?.backendModelName ?? 'openai/gpt-4o';
}
