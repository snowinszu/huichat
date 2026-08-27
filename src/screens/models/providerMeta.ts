import type { LlmProviderId } from '../../../electron/shared/ipc-types';

export const PROVIDER_ORDER: LlmProviderId[] = [
  'openai',
  'anthropic',
  'google',
  'xai',
  'deepseek',
  'zai',
  'zhipu',
  'minimax',
  'moonshot',
  'qwen',
  'custom',
];

export const PROVIDER_META: Record<LlmProviderId, { label: string; models: string[]; keyPlaceholder: string }> = {
  openai: { label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], keyPlaceholder: 'sk-...' },
  anthropic: {
    label: 'Anthropic',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    keyPlaceholder: 'sk-ant-api03-...',
  },
  google: {
    label: 'Google Gemini',
    models: ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-pro'],
    keyPlaceholder: 'AIza...',
  },
  xai: { label: 'xAI (Grok)', models: ['grok-4.3', 'grok-build-0.1'], keyPlaceholder: 'xai-...' },
  deepseek: { label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'], keyPlaceholder: 'sk-...' },
  zai: {
    label: 'Z.AI（智谱 Coding Plan）',
    models: ['glm-4.7', 'glm-5.2', 'glm-5.2-highspeed'],
    keyPlaceholder: 'your-api-key',
  },
  zhipu: {
    label: '智谱 GLM（开放平台 bigmodel.cn）',
    models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
    keyPlaceholder: 'your-api-key',
  },
  minimax: {
    label: 'MiniMax',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M3'],
    keyPlaceholder: 'your-api-key',
  },
  moonshot: {
    label: 'Kimi (Moonshot)',
    models: ['kimi-k2-turbo-preview', 'kimi-k2.5', 'kimi-k3'],
    keyPlaceholder: 'sk-...',
  },
  qwen: { label: '通义千问 (Qwen)', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], keyPlaceholder: 'sk-...' },
  custom: { label: '自定义 OpenAI 兼容端点', models: [], keyPlaceholder: 'your-api-key' },
};

export function validateApiKey(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return '请填写 API Key';
  if (/\s/.test(trimmed)) return 'API Key 不应包含空格';
  if (trimmed.length < 8) return 'API Key 格式不正确，长度过短';
  return undefined;
}

export function validateModel(value: string): string | undefined {
  return value.trim() ? undefined : '请填写模型名称';
}

export function validateBaseUrl(provider: LlmProviderId, value: string): string | undefined {
  if (provider !== 'custom') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return '请填写 API Endpoint';
  if (!/^https?:\/\//i.test(trimmed)) return 'Endpoint 需以 http:// 或 https:// 开头';
  return undefined;
}

/** Preview-only masking for list/card display — keeps enough of both ends to tell keys apart without exposing the full secret. */
export function maskApiKey(value: string): string {
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}···${value.slice(-4)}`;
}
