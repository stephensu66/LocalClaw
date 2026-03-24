import type { ModelMode } from '@openclaw/shared';
import type { Locale } from '../i18n';
import { MODEL_PROVIDERS, getBackendModelName, getProviderBaseUrl } from './modelProviders';

export type Tier2Provider = {
  id: string;
  label: { en: string; zh: string };
  baseUrl?: { default?: string; en?: string; zh?: string };
  models: Array<{ id: string; label?: { en: string; zh: string }; input?: string; ctx?: string }>;
};

export type Tier1Entry = {
  id: ModelMode;
  label: { en: string; zh: string };
  providers: Tier2Provider[];
};

const TOP_LEVEL_ORDER: ModelMode[] = [
  'deepseek',
  'alibaba_cloud',
  'moonshot',
  'zhipu',
  'minimax',
  'baidu',
  // 'tencent_hunyuan',
  'openai',
  'anthropic',
  'google',
  'groq',
  'together_ai',
  'fireworks_ai',
  'perplexity',
  'local_model',
  'other',
];

const PROVIDER_LABELS: Record<string, { en: string; zh: string }> = {
  openai: { en: 'OpenAI Compatible', zh: 'OpenAI 兼容' },
  'amazon-bedrock': { en: 'Amazon Bedrock', zh: 'Amazon Bedrock' },
  'azure-openai-responses': { en: 'Azure OpenAI (Responses)', zh: 'Azure OpenAI（Responses）' },
  openrouter: { en: 'OpenRouter', zh: 'OpenRouter' },
  anthropic: { en: 'Anthropic', zh: 'Anthropic' },
  google: { en: 'Google', zh: 'Google' },
  'google-vertex': { en: 'Google Vertex AI', zh: 'Google Vertex AI' },
  'google-gemini-cli': { en: 'Google Gemini CLI', zh: 'Google Gemini CLI' },
  'google-antigravity': { en: 'Google Antigravity', zh: 'Google Antigravity' },
  'github-copilot': { en: 'GitHub Copilot', zh: 'GitHub Copilot' },
  'openai-codex': { en: 'OpenAI Codex', zh: 'OpenAI Codex' },
  'vercel-ai-gateway': { en: 'Vercel AI Gateway', zh: 'Vercel AI Gateway' },
  'qwen-portal': { en: 'Qwen Portal', zh: 'Qwen Portal' },
  'kimi-coding': { en: 'Kimi Coding', zh: 'Kimi Coding' },
  cerebras: { en: 'Cerebras', zh: 'Cerebras' },
  huggingface: { en: 'Hugging Face', zh: 'Hugging Face' },
  opencode: { en: 'OpenCode', zh: 'OpenCode' },
  'opencode-go': { en: 'OpenCode Go', zh: 'OpenCode Go' },
  minimax: { en: 'MiniMax', zh: 'MiniMax' },
  'minimax-cn': { en: 'MiniMax CN', zh: 'MiniMax CN' },
  zai: { en: 'ZAI', zh: 'ZAI' },
  ollama: { en: 'Ollama', zh: 'Ollama' },
  groq: { en: 'Groq', zh: 'Groq' },
  together_ai: { en: 'Together AI', zh: 'Together AI' },
  fireworks_ai: { en: 'Fireworks AI', zh: 'Fireworks AI' },
  perplexity: { en: 'Perplexity AI', zh: 'Perplexity AI' },
};

export function parseModelName(modelName: string | null | undefined) {
  if (!modelName) return null;
  const slashIndex = modelName.indexOf('/');
  if (slashIndex <= 0 || slashIndex >= modelName.length - 1) return null;
  return {
    providerId: modelName.slice(0, slashIndex),
    modelId: modelName.slice(slashIndex + 1),
  };
}

const getLabelForMode = (id: ModelMode) => {
  const provider = MODEL_PROVIDERS.find((item) => item.id === id);
  return provider?.label ?? { en: id, zh: id };
};

const getProviderLabel = (id: string) => PROVIDER_LABELS[id] ?? { en: id, zh: id };
const m = (id: string, input?: string, ctx?: string) => ({ id, input, ctx });

const buildDefaultProviders = (mode: ModelMode): Tier2Provider[] => {
  const provider = MODEL_PROVIDERS.find((item) => item.id === mode);
  const backendModelName = provider?.backendModelName ?? getBackendModelName(mode);
  const parsed = parseModelName(backendModelName);
  const providerId = parsed?.providerId ?? provider?.openclawProvider ?? 'openai';
  const modelId = parsed?.modelId ?? backendModelName;
  return [
    {
      id: providerId,
      label: getProviderLabel(providerId),
      baseUrl: provider?.baseUrl,
      models: [{ id: modelId }],
    },
  ];
};

const deepseekBaseUrl = MODEL_PROVIDERS.find((item) => item.id === 'deepseek')?.baseUrl;
const openrouterBaseUrl = { default: 'https://openrouter.ai/api/v1' };

const DEEPSEEK_PROVIDERS: Tier2Provider[] = [
  {
    id: 'openai',
    label: {
      en: 'DeepSeek (OpenAI Compatible)',
      zh: 'DeepSeek（OpenAI 兼容）',
    },
    baseUrl: deepseekBaseUrl,
    models: [m('deepseek-chat', 'text', '16k')],
  },
  {
    id: 'amazon-bedrock',
    label: getProviderLabel('amazon-bedrock'),
    models: [
      m('deepseek.r1-v1:0', 'text', '125k'),
      m('deepseek.v3-v1:0', 'text', '160k'),
      m('deepseek.v3.2', 'text', '160k'),
    ],
  },
  {
    id: 'groq',
    label: getProviderLabel('groq'),
    models: [m('deepseek-r1-distill-llama-70b', 'text', '128k')],
  },
  {
    id: 'huggingface',
    label: getProviderLabel('huggingface'),
    models: [
      m('deepseek-ai/DeepSeek-R1-0528', 'text', '160k'),
      m('deepseek-ai/DeepSeek-V3.2', 'text', '160k'),
    ],
  },

  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('deepseek/deepseek-chat', 'text', '160k'),
      m('deepseek/deepseek-chat-v3-0324', 'text', '160k'),
      m('deepseek/deepseek-chat-v3.1', 'text', '32k'),
      m('deepseek/deepseek-r1', 'text', '63k'),
      m('deepseek/deepseek-r1-0528', 'text', '160k'),
      m('deepseek/deepseek-v3.1-terminus', 'text', '160k'),
      m('deepseek/deepseek-v3.2', 'text', '160k'),
      m('deepseek/deepseek-v3.2-exp', 'text', '160k'),
      m('nex-agi/deepseek-v3.1-nex-n1', 'text', '128k'),
      m('tngtech/deepseek-r1t2-chimera', 'text', '160k'),
    ],
  },
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('deepseek/deepseek-r1', 'text', '125k'),
      m('deepseek/deepseek-v3', 'text', '160k'),
      m('deepseek/deepseek-v3.1', 'text', '160k'),
      m('deepseek/deepseek-v3.1-terminus', 'text', '128k'),
      m('deepseek/deepseek-v3.2', 'text', '125k'),
      m('deepseek/deepseek-v3.2-thinking', 'text', '125k'),
    ],
  },
];

const ALIBABA_PROVIDERS: Tier2Provider[] = [
  {
    id: 'qwen-portal',
    label: getProviderLabel('qwen-portal'),
    models: [
      m('coder-model', 'text', '125k'),
      m('vision-model', 'text+image', '125k'),
    ],
  },
  {
    id: 'amazon-bedrock',
    label: getProviderLabel('amazon-bedrock'),
    models: [
      m('qwen.qwen3-235b-a22b-2507-v1:0', 'text', '256k'),
      m('qwen.qwen3-32b-v1:0', 'text', '16k'),
      m('qwen.qwen3-coder-30b-a3b-v1:0', 'text', '256k'),
      m('qwen.qwen3-coder-480b-a35b-v1:0', 'text', '128k'),
      m('qwen.qwen3-next-80b-a3b', 'text', '256k'),
      m('qwen.qwen3-vl-235b-a22b', 'text+image', '256k'),
    ],
  },
  {
    id: 'cerebras',
    label: getProviderLabel('cerebras'),
    models: [m('qwen-3-235b-a22b-instruct-2507', 'text', '128k')],
  },
  {
    id: 'groq',
    label: getProviderLabel('groq'),
    models: [
      m('qwen-qwq-32b', 'text', '128k'),
      m('qwen/qwen3-32b', 'text', '128k'),
    ],
  },
  {
    id: 'huggingface',
    label: getProviderLabel('huggingface'),
    models: [
      m('Qwen/Qwen3-235B-A22B-Thinking-2507', 'text', '256k'),
      m('Qwen/Qwen3-Coder-480B-A35B-Instruct', 'text', '256k'),
      m('Qwen/Qwen3-Coder-Next', 'text', '256k'),
      m('Qwen/Qwen3-Next-80B-A3B-Instruct', 'text', '256k'),
      m('Qwen/Qwen3-Next-80B-A3B-Thinking', 'text', '256k'),
      m('Qwen/Qwen3.5-397B-A17B', 'text+image', '256k'),
    ],
  },
  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('alibaba/tongyi-deepresearch-30b-a3b', 'text', '128k'),
      m('qwen/qwen-2.5-72b-instruct', 'text', '32k'),
      m('qwen/qwen-2.5-7b-instruct', 'text', '32k'),
      m('qwen/qwen-max', 'text', '32k'),
      m('qwen/qwen-plus', 'text', '977k'),
      m('qwen/qwen-plus-2025-07-28', 'text', '977k'),
      m('qwen/qwen-plus-2025-07-28:thinking', 'text', '977k'),
      m('qwen/qwen-turbo', 'text', '128k'),
      m('qwen/qwen-vl-max', 'text+image', '128k'),
      m('qwen/qwen3-14b', 'text', '40k'),
      m('qwen/qwen3-235b-a22b', 'text', '128k'),
      m('qwen/qwen3-235b-a22b-2507', 'text', '256k'),
      m('qwen/qwen3-235b-a22b-thinking-2507', 'text', '256k'),
      m('qwen/qwen3-30b-a3b', 'text', '40k'),
      m('qwen/qwen3-30b-a3b-instruct-2507', 'text', '256k'),
      m('qwen/qwen3-30b-a3b-thinking-2507', 'text', '32k'),
      m('qwen/qwen3-32b', 'text', '40k'),
      m('qwen/qwen3-4b:free', 'text', '40k'),
      m('qwen/qwen3-8b', 'text', '40k'),
      m('qwen/qwen3-coder', 'text', '256k'),
      m('qwen/qwen3-coder-30b-a3b-instruct', 'text', '156k'),
      m('qwen/qwen3-coder-flash', 'text', '977k'),
      m('qwen/qwen3-coder-next', 'text', '256k'),
      m('qwen/qwen3-coder-plus', 'text', '977k'),
      m('qwen/qwen3-coder:free', 'text', '256k'),
      m('qwen/qwen3-max', 'text', '256k'),
      m('qwen/qwen3-max-thinking', 'text', '256k'),
      m('qwen/qwen3-next-80b-a3b-instruct', 'text', '128k'),
      m('qwen/qwen3-next-80b-a3b-instruct:free', 'text', '256k'),
      m('qwen/qwen3-next-80b-a3b-thinking', 'text', '128k'),
      m('qwen/qwen3-vl-235b-a22b-instruct', 'text+image', '256k'),
      m('qwen/qwen3-vl-235b-a22b-thinking', 'text+image', '128k'),
      m('qwen/qwen3-vl-30b-a3b-instruct', 'text+image', '128k'),
      m('qwen/qwen3-vl-30b-a3b-thinking', 'text+image', '128k'),
      m('qwen/qwen3-vl-32b-instruct', 'text+image', '128k'),
      m('qwen/qwen3-vl-8b-instruct', 'text+image', '128k'),
      m('qwen/qwen3-vl-8b-thinking', 'text+image', '128k'),
      m('qwen/qwen3.5-122b-a10b', 'text+image', '256k'),
      m('qwen/qwen3.5-27b', 'text+image', '256k'),
      m('qwen/qwen3.5-35b-a3b', 'text+image', '256k'),
      m('qwen/qwen3.5-397b-a17b', 'text+image', '256k'),
      m('qwen/qwen3.5-9b', 'text+image', '250k'),
      m('qwen/qwen3.5-flash-02-23', 'text+image', '977k'),
      m('qwen/qwen3.5-plus-02-15', 'text+image', '977k'),
      m('qwen/qwq-32b', 'text', '32k'),
    ],
  },
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('alibaba/qwen-3-14b', 'text', '40k'),
      m('alibaba/qwen-3-235b', 'text', '40k'),
      m('alibaba/qwen-3-30b', 'text', '40k'),
      m('alibaba/qwen-3-32b', 'text', '128k'),
      m('alibaba/qwen3-235b-a22b-thinking', 'text+image', '256k'),
      m('alibaba/qwen3-coder', 'text', '256k'),
      m('alibaba/qwen3-coder-30b-a3b', 'text', '256k'),
      m('alibaba/qwen3-coder-next', 'text', '250k'),
      m('alibaba/qwen3-coder-plus', 'text', '977k'),
      m('alibaba/qwen3-max', 'text', '256k'),
      m('alibaba/qwen3-max-preview', 'text', '256k'),
      m('alibaba/qwen3-max-thinking', 'text', '250k'),
      m('alibaba/qwen3-vl-thinking', 'text+image', '250k'),
      m('alibaba/qwen3.5-flash', 'text+image', '977k'),
      m('alibaba/qwen3.5-plus', 'text+image', '977k'),
    ],
  },
];

const MOONSHOT_PROVIDERS: Tier2Provider[] = [
  {
    id: 'kimi-coding',
    label: getProviderLabel('kimi-coding'),
    models: [
      m('k2p5', 'text+image', '256k'),
      m('kimi-k2-thinking', 'text', '256k'),
    ],
  },
  {
    id: 'amazon-bedrock',
    label: getProviderLabel('amazon-bedrock'),
    models: [
      m('moonshot.kimi-k2-thinking', 'text', '250k'),
      m('moonshotai.kimi-k2.5', 'text+image', '250k'),
    ],
  },
  {
    id: 'groq',
    label: getProviderLabel('groq'),
    models: [
      m('moonshotai/kimi-k2-instruct', 'text', '128k'),
      m('moonshotai/kimi-k2-instruct-0905', 'text', '256k'),
    ],
  },
  {
    id: 'huggingface',
    label: getProviderLabel('huggingface'),
    models: [
      m('moonshotai/Kimi-K2-Instruct', 'text', '128k'),
      m('moonshotai/Kimi-K2-Instruct-0905', 'text', '256k'),
      m('moonshotai/Kimi-K2-Thinking', 'text', '256k'),
      m('moonshotai/Kimi-K2.5', 'text+image', '256k'),
    ],
  },
  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('moonshotai/kimi-k2', 'text', '128k'),
      m('moonshotai/kimi-k2-0905', 'text', '128k'),
      m('moonshotai/kimi-k2-thinking', 'text', '128k'),
      m('moonshotai/kimi-k2.5', 'text+image', '256k'),
    ],
  },
  {
    id: 'opencode',
    label: getProviderLabel('opencode'),
    models: [m('kimi-k2.5', 'text+image', '256k')],
  },
  {
    id: 'opencode-go',
    label: getProviderLabel('opencode-go'),
    models: [m('kimi-k2.5', 'text+image', '256k')],
  },
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('moonshotai/kimi-k2', 'text', '128k'),
      m('moonshotai/kimi-k2-0905', 'text', '250k'),
      m('moonshotai/kimi-k2-thinking', 'text', '256k'),
      m('moonshotai/kimi-k2-thinking-turbo', 'text', '256k'),
      m('moonshotai/kimi-k2-turbo', 'text', '250k'),
      m('moonshotai/kimi-k2.5', 'text+image', '256k'),
    ],
  },
];

const ZHIPU_PROVIDERS: Tier2Provider[] = [
  {
    id: 'zai',
    label: getProviderLabel('zai'),
    models: [
      m('glm-4.5', 'text', '128k'),
      m('glm-4.5-air', 'text', '128k'),
      m('glm-4.5-flash', 'text', '128k'),
      m('glm-4.5v', 'text+image', '63k'),
      m('glm-4.6', 'text', '200k'),
      m('glm-4.6v', 'text+image', '125k'),
      m('glm-4.7', 'text', '200k'),
      m('glm-4.7-flash', 'text', '195k'),
      m('glm-5', 'text', '200k'),
    ],
  },
  {
    id: 'amazon-bedrock',
    label: getProviderLabel('amazon-bedrock'),
    models: [
      m('zai.glm-4.7', 'text', '200k'),
      m('zai.glm-4.7-flash', 'text', '195k'),
    ],
  },
  {
    id: 'cerebras',
    label: getProviderLabel('cerebras'),
    models: [m('zai-glm-4.7', 'text', '128k')],
  },
  {
    id: 'huggingface',
    label: getProviderLabel('huggingface'),
    models: [
      m('zai-org/GLM-4.7', 'text', '200k'),
      m('zai-org/GLM-4.7-Flash', 'text', '195k'),
      m('zai-org/GLM-5', 'text', '198k'),
    ],
  },
  {
    id: 'opencode',
    label: getProviderLabel('opencode'),
    models: [
      m('glm-4.6', 'text', '200k'),
      m('glm-4.7', 'text', '200k'),
      m('glm-5', 'text', '200k'),
    ],
  },
  {
    id: 'opencode-go',
    label: getProviderLabel('opencode-go'),
    models: [m('glm-5', 'text', '200k')],
  },
  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('z-ai/glm-4-32b', 'text', '125k'),
      m('z-ai/glm-4.5', 'text', '128k'),
      m('z-ai/glm-4.5-air', 'text', '128k'),
      m('z-ai/glm-4.5-air:free', 'text', '128k'),
      m('z-ai/glm-4.5v', 'text+image', '64k'),
      m('z-ai/glm-4.6', 'text', '200k'),
      m('z-ai/glm-4.6v', 'text+image', '128k'),
      m('z-ai/glm-4.7', 'text', '198k'),
      m('z-ai/glm-4.7-flash', 'text', '198k'),
      m('z-ai/glm-5', 'text', '198k'),
    ],
  },
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('zai/glm-4.5', 'text', '125k'),
      m('zai/glm-4.5-air', 'text', '125k'),
      m('zai/glm-4.5v', 'text+image', '64k'),
      m('zai/glm-4.6', 'text', '195k'),
      m('zai/glm-4.6v', 'text+image', '125k'),
      m('zai/glm-4.6v-flash', 'text+image', '125k'),
      m('zai/glm-4.7', 'text', '195k'),
      m('zai/glm-4.7-flash', 'text', '195k'),
      m('zai/glm-4.7-flashx', 'text', '195k'),
      m('zai/glm-5', 'text', '198k'),
    ],
  }
];

const MINIMAX_PROVIDERS: Tier2Provider[] = [
  {
    id: 'minimax',
    label: getProviderLabel('minimax'),
    models: [
      m('MiniMax-M2', 'text', '192k'),
      m('MiniMax-M2.1', 'text', '200k'),
      m('MiniMax-M2.5', 'text', '200k'),
      m('MiniMax-M2.5-highspeed', 'text', '200k'),
    ],
  },
  {
    id: 'minimax-cn',
    label: getProviderLabel('minimax-cn'),
    models: [
      m('MiniMax-M2', 'text', '192k'),
      m('MiniMax-M2.1', 'text', '200k'),
      m('MiniMax-M2.5', 'text', '200k'),
      m('MiniMax-M2.5-highspeed', 'text', '200k'),
    ],
  },
  {
    id: 'amazon-bedrock',
    label: getProviderLabel('amazon-bedrock'),
    models: [
      m('minimax.minimax-m2', 'text', '200k'),
      m('minimax.minimax-m2.1', 'text', '200k'),
    ],
  },
  {
    id: 'huggingface',
    label: getProviderLabel('huggingface'),
    models: [
      m('MiniMaxAI/MiniMax-M2.1', 'text', '200k'),
      m('MiniMaxAI/MiniMax-M2.5', 'text', '200k'),
    ],
  },
  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('minimax/minimax-m1', 'text', '977k'),
      m('minimax/minimax-m2', 'text', '192k'),
      m('minimax/minimax-m2.1', 'text', '192k'),
      m('minimax/minimax-m2.5', 'text', '192k'),
    ],
  },
  {
    id: 'opencode',
    label: getProviderLabel('opencode'),
    models: [
      m('minimax-m2.1', 'text', '200k'),
      m('minimax-m2.5', 'text', '200k'),
      m('minimax-m2.5-free', 'text', '200k'),
    ],
  },
  {
    id: 'opencode-go',
    label: getProviderLabel('opencode-go'),
    models: [m('minimax-m2.5', 'text', '200k')],
  },
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('minimax/minimax-m2', 'text', '200k'),
      m('minimax/minimax-m2.1', 'text', '200k'),
      m('minimax/minimax-m2.1-lightning', 'text', '200k'),
      m('minimax/minimax-m2.5', 'text', '200k'),
      m('minimax/minimax-m2.5-highspeed', 'text', '4k'),
    ],
  },
];

const BAIDU_PROVIDERS: Tier2Provider[] = [
  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('baidu/ernie-4.5-21b-a3b', 'text', '117k'),
      m('baidu/ernie-4.5-vl-28b-a3b', 'text+image', '29k'),
    ],
  },
];

const OPENAI_PROVIDERS: Tier2Provider[] = [
  {
    id: 'openai',
    label: getProviderLabel('openai'),
    models: [
      m('codex-mini-latest', 'text', '195k'),
      m('gpt-4', 'text', '8k'),
      m('gpt-4-turbo', 'text+image', '125k'),
      m('gpt-4.1', 'text+image', '1023k'),
      m('gpt-4.1-mini', 'text+image', '1023k'),
      m('gpt-4.1-nano', 'text+image', '1023k'),
      m('gpt-4o', 'text+image', '125k'),
      m('gpt-4o-2024-05-13', 'text+image', '125k'),
      m('gpt-4o-2024-08-06', 'text+image', '125k'),
      m('gpt-4o-2024-11-20', 'text+image', '125k'),
      m('gpt-4o-mini', 'text+image', '125k'),
      m('gpt-5', 'text+image', '391k'),
      m('gpt-5-chat-latest', 'text+image', '125k'),
      m('gpt-5-codex', 'text+image', '391k'),
      m('gpt-5-mini', 'text+image', '391k'),
      m('gpt-5-nano', 'text+image', '391k'),
      m('gpt-5-pro', 'text+image', '391k'),
      m('gpt-5.1', 'text+image', '391k'),
      m('gpt-5.1-chat-latest', 'text+image', '125k'),
      m('gpt-5.1-codex', 'text+image', '391k'),
      m('gpt-5.1-codex-max', 'text+image', '391k'),
      m('gpt-5.1-codex-mini', 'text+image', '391k'),
      m('gpt-5.2', 'text+image', '391k'),
      m('gpt-5.2-chat-latest', 'text+image', '125k'),
      m('gpt-5.2-codex', 'text+image', '391k'),
      m('gpt-5.2-pro', 'text+image', '391k'),
      m('gpt-5.3-codex', 'text+image', '391k'),
      m('gpt-5.4', 'text+image', '266k'),
      m('gpt-5.4-pro', 'text+image', '1025k'),
      m('o1', 'text+image', '195k'),
      m('o1-pro', 'text+image', '195k'),
      m('o3', 'text+image', '195k'),
      m('o3-deep-research', 'text+image', '195k'),
      m('o3-mini', 'text', '195k'),
      m('o3-pro', 'text+image', '195k'),
      m('o4-mini', 'text+image', '195k'),
      m('o4-mini-deep-research', 'text+image', '195k'),
    ],
  },
  {
    id: 'openai-codex',
    label: getProviderLabel('openai-codex'),
    models: [
      m('gpt-5.1', 'text+image', '266k'),
      m('gpt-5.1-codex-max', 'text+image', '266k'),
      m('gpt-5.1-codex-mini', 'text+image', '266k'),
      m('gpt-5.2', 'text+image', '266k'),
      m('gpt-5.2-codex', 'text+image', '266k'),
      m('gpt-5.3-codex', 'text+image', '266k'),
      m('gpt-5.3-codex-spark', 'text', '125k'),
      m('gpt-5.4', 'text+image', '266k'),
    ],
  },
  {
    id: 'amazon-bedrock',
    label: getProviderLabel('amazon-bedrock'),
    models: [
      m('openai.gpt-oss-120b-1:0', 'text', '125k'),
      m('openai.gpt-oss-20b-1:0', 'text', '125k'),
      m('openai.gpt-oss-safeguard-120b', 'text', '125k'),
      m('openai.gpt-oss-safeguard-20b', 'text', '125k'),
    ],
  },
  {
    id: 'azure-openai-responses',
    label: getProviderLabel('azure-openai-responses'),
    models: [
      m('codex-mini-latest', 'text', '195k'),
      m('gpt-4', 'text', '8k'),
      m('gpt-4-turbo', 'text+image', '125k'),
      m('gpt-4.1', 'text+image', '1023k'),
      m('gpt-4.1-mini', 'text+image', '1023k'),
      m('gpt-4.1-nano', 'text+image', '1023k'),
      m('gpt-4o', 'text+image', '125k'),
      m('gpt-4o-2024-05-13', 'text+image', '125k'),
      m('gpt-4o-2024-08-06', 'text+image', '125k'),
      m('gpt-4o-2024-11-20', 'text+image', '125k'),
      m('gpt-4o-mini', 'text+image', '125k'),
      m('gpt-5', 'text+image', '391k'),
      m('gpt-5-chat-latest', 'text+image', '125k'),
      m('gpt-5-codex', 'text+image', '391k'),
      m('gpt-5-mini', 'text+image', '391k'),
      m('gpt-5-nano', 'text+image', '391k'),
      m('gpt-5-pro', 'text+image', '391k'),
      m('gpt-5.1', 'text+image', '391k'),
      m('gpt-5.1-chat-latest', 'text+image', '125k'),
      m('gpt-5.1-codex', 'text+image', '391k'),
      m('gpt-5.1-codex-max', 'text+image', '391k'),
      m('gpt-5.1-codex-mini', 'text+image', '391k'),
      m('gpt-5.2', 'text+image', '391k'),
      m('gpt-5.2-chat-latest', 'text+image', '125k'),
      m('gpt-5.2-codex', 'text+image', '391k'),
      m('gpt-5.2-pro', 'text+image', '391k'),
      m('gpt-5.3-codex', 'text+image', '391k'),
      m('gpt-5.4', 'text+image', '266k'),
      m('gpt-5.4-pro', 'text+image', '1025k'),
      m('o1', 'text+image', '195k'),
      m('o1-pro', 'text+image', '195k'),
      m('o3', 'text+image', '195k'),
      m('o3-deep-research', 'text+image', '195k'),
      m('o3-mini', 'text', '195k'),
      m('o3-pro', 'text+image', '195k'),
      m('o4-mini', 'text+image', '195k'),
      m('o4-mini-deep-research', 'text+image', '195k'),
    ],
  },
  {
    id: 'cerebras',
    label: getProviderLabel('cerebras'),
    models: [m('gpt-oss-120b', 'text', '128k')],
  },
  {
    id: 'github-copilot',
    label: getProviderLabel('github-copilot'),
    models: [
      m('gpt-4.1', 'text+image', '63k'),
      m('gpt-4o', 'text+image', '63k'),
      m('gpt-5', 'text+image', '125k'),
      m('gpt-5-mini', 'text+image', '125k'),
      m('gpt-5.1', 'text+image', '125k'),
      m('gpt-5.1-codex', 'text+image', '125k'),
      m('gpt-5.1-codex-max', 'text+image', '125k'),
      m('gpt-5.1-codex-mini', 'text+image', '125k'),
      m('gpt-5.2', 'text+image', '258k'),
      m('gpt-5.2-codex', 'text+image', '391k'),
      m('gpt-5.3-codex', 'text+image', '391k'),
      m('gpt-5.4', 'text+image', '391k'),
    ],
  },
  {
    id: 'google-antigravity',
    label: getProviderLabel('google-antigravity'),
    models: [m('gpt-oss-120b-medium', 'text', '128k')],
  },
  {
    id: 'groq',
    label: getProviderLabel('groq'),
    models: [
      m('openai/gpt-oss-120b', 'text', '128k'),
      m('openai/gpt-oss-20b', 'text', '128k'),
    ],
  },
  {
    id: 'opencode',
    label: getProviderLabel('opencode'),
    models: [
      m('gpt-5', 'text+image', '391k'),
      m('gpt-5-codex', 'text+image', '391k'),
      m('gpt-5-nano', 'text+image', '391k'),
      m('gpt-5.1', 'text+image', '391k'),
      m('gpt-5.1-codex', 'text+image', '391k'),
      m('gpt-5.1-codex-max', 'text+image', '391k'),
      m('gpt-5.1-codex-mini', 'text+image', '391k'),
      m('gpt-5.2', 'text+image', '391k'),
      m('gpt-5.2-codex', 'text+image', '391k'),
      m('gpt-5.3-codex', 'text+image', '391k'),
      m('gpt-5.4', 'text+image', '266k'),
      m('gpt-5.4-pro', 'text+image', '1025k'),
    ],
  },
  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('openai/gpt-3.5-turbo', 'text', '16k'),
      m('openai/gpt-3.5-turbo-0613', 'text', '4k'),
      m('openai/gpt-3.5-turbo-16k', 'text', '16k'),
      m('openai/gpt-4', 'text', '8k'),
      m('openai/gpt-4-0314', 'text', '8k'),
      m('openai/gpt-4-1106-preview', 'text', '125k'),
      m('openai/gpt-4-turbo', 'text+image', '125k'),
      m('openai/gpt-4-turbo-preview', 'text', '125k'),
      m('openai/gpt-4.1', 'text+image', '1023k'),
      m('openai/gpt-4.1-mini', 'text+image', '1023k'),
      m('openai/gpt-4.1-nano', 'text+image', '1023k'),
      m('openai/gpt-4o', 'text+image', '125k'),
      m('openai/gpt-4o-2024-05-13', 'text+image', '125k'),
      m('openai/gpt-4o-2024-08-06', 'text+image', '125k'),
      m('openai/gpt-4o-2024-11-20', 'text+image', '125k'),
      m('openai/gpt-4o-audio-preview', 'text', '125k'),
      m('openai/gpt-4o-mini', 'text+image', '125k'),
      m('openai/gpt-4o-mini-2024-07-18', 'text+image', '125k'),
      m('openai/gpt-4o:extended', 'text+image', '125k'),
      m('openai/gpt-5', 'text+image', '391k'),
      m('openai/gpt-5-codex', 'text+image', '391k'),
      m('openai/gpt-5-image', 'text+image', '391k'),
      m('openai/gpt-5-image-mini', 'text+image', '391k'),
      m('openai/gpt-5-mini', 'text+image', '391k'),
      m('openai/gpt-5-nano', 'text+image', '391k'),
      m('openai/gpt-5-pro', 'text+image', '391k'),
      m('openai/gpt-5.1', 'text+image', '391k'),
      m('openai/gpt-5.1-chat', 'text+image', '125k'),
      m('openai/gpt-5.1-codex', 'text+image', '391k'),
      m('openai/gpt-5.1-codex-max', 'text+image', '391k'),
      m('openai/gpt-5.1-codex-mini', 'text+image', '391k'),
      m('openai/gpt-5.2', 'text+image', '391k'),
      m('openai/gpt-5.2-chat', 'text+image', '125k'),
      m('openai/gpt-5.2-codex', 'text+image', '391k'),
      m('openai/gpt-5.2-pro', 'text+image', '391k'),
      m('openai/gpt-5.3-chat', 'text+image', '125k'),
      m('openai/gpt-5.3-codex', 'text+image', '391k'),
      m('openai/gpt-5.4', 'text+image', '1025k'),
      m('openai/gpt-5.4-pro', 'text+image', '1025k'),
      m('openai/gpt-oss-120b', 'text', '128k'),
      m('openai/gpt-oss-120b:free', 'text', '128k'),
      m('openai/gpt-oss-20b', 'text', '128k'),
      m('openai/gpt-oss-20b:free', 'text', '128k'),
      m('openai/gpt-oss-safeguard-20b', 'text', '128k'),
      m('openai/o1', 'text+image', '195k'),
      m('openai/o3', 'text+image', '195k'),
      m('openai/o3-deep-research', 'text+image', '195k'),
      m('openai/o3-mini', 'text', '195k'),
      m('openai/o3-mini-high', 'text', '195k'),
      m('openai/o3-pro', 'text+image', '195k'),
      m('openai/o4-mini', 'text+image', '195k'),
      m('openai/o4-mini-deep-research', 'text+image', '195k'),
      m('openai/o4-mini-high', 'text+image', '195k'),
    ],
  },
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('openai/gpt-4-turbo', 'text+image', '125k'),
      m('openai/gpt-4.1', 'text+image', '1023k'),
      m('openai/gpt-4.1-mini', 'text+image', '1023k'),
      m('openai/gpt-4.1-nano', 'text+image', '1023k'),
      m('openai/gpt-4o', 'text+image', '125k'),
      m('openai/gpt-4o-mini', 'text+image', '125k'),
      m('openai/gpt-5', 'text+image', '391k'),
      m('openai/gpt-5-chat', 'text+image', '125k'),
      m('openai/gpt-5-codex', 'text', '391k'),
      m('openai/gpt-5-mini', 'text+image', '391k'),
      m('openai/gpt-5-nano', 'text+image', '391k'),
      m('openai/gpt-5-pro', 'text+image', '391k'),
      m('openai/gpt-5.1-codex', 'text+image', '391k'),
      m('openai/gpt-5.1-codex-max', 'text+image', '391k'),
      m('openai/gpt-5.1-codex-mini', 'text+image', '391k'),
      m('openai/gpt-5.1-instant', 'text+image', '125k'),
      m('openai/gpt-5.1-thinking', 'text+image', '391k'),
      m('openai/gpt-5.2', 'text+image', '391k'),
      m('openai/gpt-5.2-chat', 'text+image', '125k'),
      m('openai/gpt-5.2-codex', 'text+image', '391k'),
      m('openai/gpt-5.2-pro', 'text+image', '391k'),
      m('openai/gpt-5.3-chat', 'text+image', '125k'),
      m('openai/gpt-5.3-codex', 'text+image', '391k'),
      m('openai/gpt-5.4', 'text+image', '1025k'),
      m('openai/gpt-5.4-pro', 'text+image', '1025k'),
      m('openai/gpt-oss-20b', 'text', '125k'),
      m('openai/gpt-oss-safeguard-20b', 'text', '128k'),
      m('openai/o1', 'text+image', '195k'),
      m('openai/o3', 'text+image', '195k'),
      m('openai/o3-deep-research', 'text+image', '195k'),
      m('openai/o3-mini', 'text', '195k'),
      m('openai/o3-pro', 'text+image', '195k'),
      m('openai/o4-mini', 'text+image', '195k'),
    ],
  },
];

const ANTHROPIC_PROVIDERS: Tier2Provider[] = [
  {
    id: 'anthropic',
    label: getProviderLabel('anthropic'),
    models: [
      m('claude-3-5-haiku-20241022', 'text+image', '195k'),
      m('claude-3-5-haiku-latest', 'text+image', '195k'),
      m('claude-3-5-sonnet-20240620', 'text+image', '195k'),
      m('claude-3-5-sonnet-20241022', 'text+image', '195k'),
      m('claude-3-7-sonnet-20250219', 'text+image', '195k'),
      m('claude-3-7-sonnet-latest', 'text+image', '195k'),
      m('claude-3-haiku-20240307', 'text+image', '195k'),
      m('claude-3-opus-20240229', 'text+image', '195k'),
      m('claude-3-sonnet-20240229', 'text+image', '195k'),
      m('claude-haiku-4-5', 'text+image', '195k'),
      m('claude-haiku-4-5-20251001', 'text+image', '195k'),
      m('claude-opus-4-0', 'text+image', '195k'),
      m('claude-opus-4-1', 'text+image', '195k'),
      m('claude-opus-4-1-20250805', 'text+image', '195k'),
      m('claude-opus-4-20250514', 'text+image', '195k'),
      m('claude-opus-4-5', 'text+image', '195k'),
      m('claude-opus-4-5-20251101', 'text+image', '195k'),
      m('claude-opus-4-6', 'text+image', '977k'),
      m('claude-sonnet-4-0', 'text+image', '195k'),
      m('claude-sonnet-4-20250514', 'text+image', '195k'),
      m('claude-sonnet-4-5', 'text+image', '195k'),
      m('claude-sonnet-4-5-20250929', 'text+image', '195k'),
      m('claude-sonnet-4-6', 'text+image', '977k'),
    ],
  },
  {
    id: 'amazon-bedrock',
    label: getProviderLabel('amazon-bedrock'),
    models: [
      m('anthropic.claude-3-5-haiku-20241022-v1:0', 'text+image', '195k'),
      m('anthropic.claude-3-5-sonnet-20240620-v1:0', 'text+image', '195k'),
      m('anthropic.claude-3-5-sonnet-20241022-v2:0', 'text+image', '195k'),
      m('anthropic.claude-3-7-sonnet-20250219-v1:0', 'text+image', '195k'),
      m('anthropic.claude-3-haiku-20240307-v1:0', 'text+image', '195k'),
      m('anthropic.claude-haiku-4-5-20251001-v1:0', 'text+image', '195k'),
      m('anthropic.claude-opus-4-1-20250805-v1:0', 'text+image', '195k'),
      m('anthropic.claude-opus-4-20250514-v1:0', 'text+image', '195k'),
      m('anthropic.claude-opus-4-5-20251101-v1:0', 'text+image', '195k'),
      m('anthropic.claude-opus-4-6-v1', 'text+image', '977k'),
      m('anthropic.claude-sonnet-4-20250514-v1:0', 'text+image', '195k'),
      m('anthropic.claude-sonnet-4-5-20250929-v1:0', 'text+image', '195k'),
      m('anthropic.claude-sonnet-4-6', 'text+image', '977k'),
      m('eu.anthropic.claude-haiku-4-5-20251001-v1:0', 'text+image', '195k'),
      m('eu.anthropic.claude-opus-4-5-20251101-v1:0', 'text+image', '195k'),
      m('eu.anthropic.claude-opus-4-6-v1', 'text+image', '977k'),
      m('eu.anthropic.claude-sonnet-4-20250514-v1:0', 'text+image', '195k'),
      m('eu.anthropic.claude-sonnet-4-5-20250929-v1:0', 'text+image', '195k'),
      m('eu.anthropic.claude-sonnet-4-6', 'text+image', '977k'),
      m('global.anthropic.claude-haiku-4-5-20251001-v1:0', 'text+image', '195k'),
      m('global.anthropic.claude-opus-4-5-20251101-v1:0', 'text+image', '195k'),
      m('global.anthropic.claude-opus-4-6-v1', 'text+image', '977k'),
      m('global.anthropic.claude-sonnet-4-20250514-v1:0', 'text+image', '195k'),
      m('global.anthropic.claude-sonnet-4-5-20250929-v1:0', 'text+image', '195k'),
      m('global.anthropic.claude-sonnet-4-6', 'text+image', '977k'),
      m('us.anthropic.claude-haiku-4-5-20251001-v1:0', 'text+image', '195k'),
      m('us.anthropic.claude-opus-4-1-20250805-v1:0', 'text+image', '195k'),
      m('us.anthropic.claude-opus-4-20250514-v1:0', 'text+image', '195k'),
      m('us.anthropic.claude-opus-4-5-20251101-v1:0', 'text+image', '195k'),
      m('us.anthropic.claude-opus-4-6-v1', 'text+image', '977k'),
      m('us.anthropic.claude-sonnet-4-20250514-v1:0', 'text+image', '195k'),
      m('us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'text+image', '195k'),
      m('us.anthropic.claude-sonnet-4-6', 'text+image', '977k'),
    ],
  },
  {
    id: 'github-copilot',
    label: getProviderLabel('github-copilot'),
    models: [
      m('claude-haiku-4.5', 'text+image', '125k'),
      m('claude-opus-4.5', 'text+image', '125k'),
      m('claude-opus-4.6', 'text+image', '125k'),
      m('claude-sonnet-4', 'text+image', '125k'),
      m('claude-sonnet-4.5', 'text+image', '125k'),
      m('claude-sonnet-4.6', 'text+image', '125k'),
    ],
  },
  {
    id: 'google-antigravity',
    label: getProviderLabel('google-antigravity'),
    models: [
      m('claude-opus-4-5-thinking', 'text+image', '195k'),
      m('claude-opus-4-6-thinking', 'text+image', '195k'),
      m('claude-sonnet-4-5', 'text+image', '195k'),
      m('claude-sonnet-4-5-thinking', 'text+image', '195k'),
      m('claude-sonnet-4-6', 'text+image', '195k'),
    ],
  },
  {
    id: 'opencode',
    label: getProviderLabel('opencode'),
    models: [
      m('claude-3-5-haiku', 'text+image', '195k'),
      m('claude-haiku-4-5', 'text+image', '195k'),
      m('claude-opus-4-1', 'text+image', '195k'),
      m('claude-opus-4-5', 'text+image', '195k'),
      m('claude-opus-4-6', 'text+image', '977k'),
      m('claude-sonnet-4', 'text+image', '195k'),
      m('claude-sonnet-4-5', 'text+image', '195k'),
      m('claude-sonnet-4-6', 'text+image', '977k'),
    ],
  },
  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('anthropic/claude-3-haiku', 'text+image', '195k'),
      m('anthropic/claude-3.5-haiku', 'text+image', '195k'),
      m('anthropic/claude-3.5-sonnet', 'text+image', '195k'),
      m('anthropic/claude-3.7-sonnet', 'text+image', '195k'),
      m('anthropic/claude-3.7-sonnet:thinking', 'text+image', '195k'),
      m('anthropic/claude-haiku-4.5', 'text+image', '195k'),
      m('anthropic/claude-opus-4', 'text+image', '195k'),
      m('anthropic/claude-opus-4.1', 'text+image', '195k'),
      m('anthropic/claude-opus-4.5', 'text+image', '195k'),
      m('anthropic/claude-opus-4.6', 'text+image', '977k'),
      m('anthropic/claude-sonnet-4', 'text+image', '195k'),
      m('anthropic/claude-sonnet-4.5', 'text+image', '977k'),
      m('anthropic/claude-sonnet-4.6', 'text+image', '977k'),
    ],
  },
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('anthropic/claude-3-haiku', 'text+image', '195k'),
      m('anthropic/claude-3.5-haiku', 'text+image', '195k'),
      m('anthropic/claude-3.5-sonnet', 'text+image', '195k'),
      m('anthropic/claude-3.5-sonnet-20240620', 'text+image', '195k'),
      m('anthropic/claude-3.7-sonnet', 'text+image', '195k'),
      m('anthropic/claude-haiku-4.5', 'text+image', '195k'),
      m('anthropic/claude-opus-4', 'text+image', '195k'),
      m('anthropic/claude-opus-4.1', 'text+image', '195k'),
      m('anthropic/claude-opus-4.5', 'text+image', '195k'),
      m('anthropic/claude-opus-4.6', 'text+image', '977k'),
      m('anthropic/claude-sonnet-4', 'text+image', '977k'),
      m('anthropic/claude-sonnet-4.5', 'text+image', '977k'),
      m('anthropic/claude-sonnet-4.6', 'text+image', '977k'),
    ],
  },
];

const GOOGLE_PROVIDERS: Tier2Provider[] = [
  {
    id: 'google',
    label: getProviderLabel('google'),
    models: [
      m('gemini-1.5-flash', 'text+image', '977k'),
      m('gemini-1.5-flash-8b', 'text+image', '977k'),
      m('gemini-1.5-pro', 'text+image', '977k'),
      m('gemini-2.0-flash', 'text+image', '1024k'),
      m('gemini-2.0-flash-lite', 'text+image', '1024k'),
      m('gemini-2.5-flash', 'text+image', '1024k'),
      m('gemini-2.5-flash-lite', 'text+image', '1024k'),
      m('gemini-2.5-flash-lite-preview-06-17', 'text+image', '1024k'),
      m('gemini-2.5-flash-lite-preview-09-2025', 'text+image', '1024k'),
      m('gemini-2.5-flash-preview-04-17', 'text+image', '1024k'),
      m('gemini-2.5-flash-preview-05-20', 'text+image', '1024k'),
      m('gemini-2.5-flash-preview-09-2025', 'text+image', '1024k'),
      m('gemini-2.5-pro', 'text+image', '1024k'),
      m('gemini-2.5-pro-preview-05-06', 'text+image', '1024k'),
      m('gemini-2.5-pro-preview-06-05', 'text+image', '1024k'),
      m('gemini-3-flash-preview', 'text+image', '1024k'),
      m('gemini-3-pro-preview', 'text+image', '977k'),
      m('gemini-3.1-flash-lite-preview', 'text+image', '1024k'),
      m('gemini-3.1-pro-preview', 'text+image', '1024k'),
      m('gemini-3.1-pro-preview-customtools', 'text+image', '1024k'),
      m('gemini-flash-latest', 'text+image', '1024k'),
      m('gemini-flash-lite-latest', 'text+image', '1024k'),
      m('gemini-live-2.5-flash', 'text+image', '125k'),
      m('gemini-live-2.5-flash-preview-native-audio', 'text', '128k'),
    ],
  },
  {
    id: 'google-antigravity',
    label: getProviderLabel('google-antigravity'),
    models: [
      m('gemini-3-flash', 'text+image', '1024k'),
      m('gemini-3.1-pro-high', 'text+image', '1024k'),
      m('gemini-3.1-pro-low', 'text+image', '1024k'),
    ],
  },
  {
    id: 'google-gemini-cli',
    label: getProviderLabel('google-gemini-cli'),
    models: [
      m('gemini-2.0-flash', 'text+image', '1024k'),
      m('gemini-2.5-flash', 'text+image', '1024k'),
      m('gemini-2.5-pro', 'text+image', '1024k'),
      m('gemini-3-flash-preview', 'text+image', '1024k'),
      m('gemini-3-pro-preview', 'text+image', '1024k'),
      m('gemini-3.1-pro-preview', 'text+image', '1024k'),
    ],
  },
  {
    id: 'google-vertex',
    label: getProviderLabel('google-vertex'),
    models: [
      m('gemini-1.5-flash', 'text+image', '977k'),
      m('gemini-1.5-flash-8b', 'text+image', '977k'),
      m('gemini-1.5-pro', 'text+image', '977k'),
      m('gemini-2.0-flash', 'text+image', '1024k'),
      m('gemini-2.0-flash-lite', 'text+image', '1024k'),
      m('gemini-2.5-flash', 'text+image', '1024k'),
      m('gemini-2.5-flash-lite', 'text+image', '1024k'),
      m('gemini-2.5-flash-lite-preview-09-2025', 'text+image', '1024k'),
      m('gemini-2.5-pro', 'text+image', '1024k'),
      m('gemini-3-flash-preview', 'text+image', '1024k'),
      m('gemini-3-pro-preview', 'text+image', '977k'),
      m('gemini-3.1-pro-preview', 'text+image', '1024k'),
    ],
  },
  {
    id: 'amazon-bedrock',
    label: getProviderLabel('amazon-bedrock'),
    models: [
      m('google.gemma-3-27b-it', 'text+image', '198k'),
      m('google.gemma-3-4b-it', 'text+image', '125k'),
    ],
  },
  {
    id: 'github-copilot',
    label: getProviderLabel('github-copilot'),
    models: [
      m('gemini-2.5-pro', 'text+image', '125k'),
      m('gemini-3-flash-preview', 'text+image', '125k'),
      m('gemini-3-pro-preview', 'text+image', '125k'),
      m('gemini-3.1-pro-preview', 'text+image', '125k'),
    ],
  },
  {
    id: 'opencode',
    label: getProviderLabel('opencode'),
    models: [
      m('gemini-3-flash', 'text+image', '1024k'),
      m('gemini-3-pro', 'text+image', '1024k'),
      m('gemini-3.1-pro', 'text+image', '1024k'),
    ],
  },
  {
    id: 'openrouter',
    label: getProviderLabel('openrouter'),
    baseUrl: openrouterBaseUrl,
    models: [
      m('google/gemini-2.0-flash-001', 'text+image', '1024k'),
      m('google/gemini-2.0-flash-lite-001', 'text+image', '1024k'),
      m('google/gemini-2.5-flash', 'text+image', '1024k'),
      m('google/gemini-2.5-flash-lite', 'text+image', '1024k'),
      m('google/gemini-2.5-flash-lite-preview-09-2025', 'text+image', '1024k'),
      m('google/gemini-2.5-pro', 'text+image', '1024k'),
      m('google/gemini-2.5-pro-preview', 'text+image', '1024k'),
      m('google/gemini-2.5-pro-preview-05-06', 'text+image', '1024k'),
      m('google/gemini-3-flash-preview', 'text+image', '1024k'),
      m('google/gemini-3-pro-preview', 'text+image', '1024k'),
      m('google/gemini-3.1-flash-lite-preview', 'text+image', '1024k'),
      m('google/gemini-3.1-pro-preview', 'text+image', '1024k'),
      m('google/gemini-3.1-pro-preview-customtools', 'text+image', '1024k'),
      m('google/gemma-3-27b-it', 'text+image', '125k'),
      m('google/gemma-3-27b-it:free', 'text+image', '128k'),
    ],
  },
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('google/gemini-2.0-flash', 'text+image', '1024k'),
      m('google/gemini-2.0-flash-lite', 'text+image', '1024k'),
      m('google/gemini-2.5-flash', 'text+image', '977k'),
      m('google/gemini-2.5-flash-lite', 'text+image', '1024k'),
      m('google/gemini-2.5-flash-lite-preview-09-2025', 'text+image', '1024k'),
      m('google/gemini-2.5-flash-preview-09-2025', 'text+image', '977k'),
      m('google/gemini-2.5-pro', 'text+image', '1024k'),
      m('google/gemini-3-flash', 'text+image', '977k'),
      m('google/gemini-3-pro-preview', 'text+image', '977k'),
      m('google/gemini-3.1-flash-lite-preview', 'text+image', '977k'),
      m('google/gemini-3.1-pro-preview', 'text+image', '977k'),
    ],
  },
];

const GROQ_PROVIDERS: Tier2Provider[] = [
  {
    id: 'groq',
    label: getProviderLabel('groq'),
    models: [
      m('deepseek-r1-distill-llama-70b', 'text', '128k'),
      m('gemma2-9b-it', 'text', '8k'),
      m('llama-3.1-8b-instant', 'text', '128k'),
      m('llama-3.3-70b-versatile', 'text', '128k'),
      m('llama3-70b-8192', 'text', '8k'),
      m('llama3-8b-8192', 'text', '8k'),
      m('meta-llama/llama-4-maverick-17b-128e-instruct', 'text+image', '128k'),
      m('meta-llama/llama-4-scout-17b-16e-instruct', 'text+image', '128k'),
      m('mistral-saba-24b', 'text', '32k'),
      m('moonshotai/kimi-k2-instruct', 'text', '128k'),
      m('moonshotai/kimi-k2-instruct-0905', 'text', '256k'),
      m('openai/gpt-oss-120b', 'text', '128k'),
      m('openai/gpt-oss-20b', 'text', '128k'),
      m('qwen-qwq-32b', 'text', '128k'),
      m('qwen/qwen3-32b', 'text', '128k'),
    ],
  },
];

const PERPLEXITY_PROVIDERS: Tier2Provider[] = [
  {
    id: 'vercel-ai-gateway',
    label: getProviderLabel('vercel-ai-gateway'),
    models: [
      m('perplexity/sonar', 'text+image', '124k'),
      m('perplexity/sonar-pro', 'text+image', '195k'),
    ],
  },
];

const CUSTOM_PROVIDERS: Partial<Record<ModelMode, Tier2Provider[]>> = {
  deepseek: DEEPSEEK_PROVIDERS,
  alibaba_cloud: ALIBABA_PROVIDERS,
  moonshot: MOONSHOT_PROVIDERS,
  zhipu: ZHIPU_PROVIDERS,
  minimax: MINIMAX_PROVIDERS,
  baidu: BAIDU_PROVIDERS,
  openai: OPENAI_PROVIDERS,
  anthropic: ANTHROPIC_PROVIDERS,
  google: GOOGLE_PROVIDERS,
  groq: GROQ_PROVIDERS,
  perplexity: PERPLEXITY_PROVIDERS,
};

export const MODEL_CATALOG: Record<ModelMode, Tier1Entry> = TOP_LEVEL_ORDER.reduce((acc, id) => {
  const providers = CUSTOM_PROVIDERS[id] ?? buildDefaultProviders(id);
  acc[id] = {
    id,
    label: getLabelForMode(id),
    providers,
  };
  return acc;
}, {} as Record<ModelMode, Tier1Entry>);

export function getTier1Options(): Tier1Entry[] {
  return TOP_LEVEL_ORDER.map((id) => MODEL_CATALOG[id]);
}

export function resolveProviderBaseUrl(provider: Tier2Provider | undefined, mode: ModelMode, locale: Locale) {
  if (provider?.baseUrl) {
    return provider.baseUrl[locale] ?? provider.baseUrl.default ?? null;
  }
  return getProviderBaseUrl(mode, locale);
}
