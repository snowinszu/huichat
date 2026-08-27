import type { Api, Context, Model } from '@earendil-works/pi-ai';
import type { LlmProviderId } from '../../shared/ipc-types.js';
import { exportDebugInteraction, type DebugExportContext } from '../debugExport.js';

export type { LlmProviderId, DebugExportContext };

/** Providers with a static, built-in model catalog in pi-ai. */
type BuiltinProviderId = Extract<
  LlmProviderId,
  'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'zai' | 'minimax' | 'moonshot'
>;

/** Providers reached through the generic OpenAI-compatible wire protocol. */
type OpenAiCompatibleProviderId = Extract<LlmProviderId, 'zhipu' | 'qwen' | 'custom'>;

export interface LlmConfig {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  /** Required when provider is 'custom'; ignored otherwise. */
  baseUrl?: string;
}

// Maps our provider id to the catalog id pi-ai registers it under.
const BUILTIN_CATALOG_ID: Record<BuiltinProviderId, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  xai: 'xai',
  deepseek: 'deepseek',
  zai: 'zai',
  minimax: 'minimax',
  moonshot: 'moonshotai',
};

// 通义千问 doesn't have a pi-ai built-in provider that accepts a plain API key
// (its built-in catalog is subscription-plan-specific), so it's reached as an
// OpenAI-compatible endpoint, same as a user's custom endpoint. `zhipu` here
// is the general 开放平台 (bigmodel.cn) endpoint — distinct from `zai`, which
// is pi-ai's builtin Z.AI *coding-plan* provider (api.z.ai/api/coding/paas/v4,
// a different product/key from a plain bigmodel.cn key).
const OPENAI_COMPATIBLE_BASE_URL: Record<Exclude<OpenAiCompatibleProviderId, 'custom'>, string> = {
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
};

function isBuiltinProvider(id: LlmProviderId): id is BuiltinProviderId {
  return id in BUILTIN_CATALOG_ID;
}

/**
 * pi-ai ships ESM-only exports (`"exports"` has no `"require"` condition),
 * but this main-process bundle is compiled to CommonJS — a static `import`
 * of pi-ai would compile down to a `require()` call that Node refuses to
 * resolve (ERR_PACKAGE_PATH_NOT_EXPORTED). Dynamic `import()` instead goes
 * through Node's real ESM loader, which pi-ai's exports map does support, so
 * every pi-ai touchpoint is loaded lazily (and cached) through here.
 */
let piAiModulesPromise: Promise<{
  createModels: typeof import('@earendil-works/pi-ai').createModels;
  createProvider: typeof import('@earendil-works/pi-ai').createProvider;
  openAICompletionsApi: typeof import('@earendil-works/pi-ai/api/openai-completions.lazy').openAICompletionsApi;
  anthropicProvider: typeof import('@earendil-works/pi-ai/providers/anthropic').anthropicProvider;
  openaiProvider: typeof import('@earendil-works/pi-ai/providers/openai').openaiProvider;
  googleProvider: typeof import('@earendil-works/pi-ai/providers/google').googleProvider;
  xaiProvider: typeof import('@earendil-works/pi-ai/providers/xai').xaiProvider;
  deepseekProvider: typeof import('@earendil-works/pi-ai/providers/deepseek').deepseekProvider;
  zaiProvider: typeof import('@earendil-works/pi-ai/providers/zai').zaiProvider;
  minimaxProvider: typeof import('@earendil-works/pi-ai/providers/minimax').minimaxProvider;
  moonshotaiProvider: typeof import('@earendil-works/pi-ai/providers/moonshotai').moonshotaiProvider;
}> | null = null;

function loadPiAi() {
  if (!piAiModulesPromise) {
    piAiModulesPromise = Promise.all([
      import('@earendil-works/pi-ai'),
      import('@earendil-works/pi-ai/api/openai-completions.lazy'),
      import('@earendil-works/pi-ai/providers/anthropic'),
      import('@earendil-works/pi-ai/providers/openai'),
      import('@earendil-works/pi-ai/providers/google'),
      import('@earendil-works/pi-ai/providers/xai'),
      import('@earendil-works/pi-ai/providers/deepseek'),
      import('@earendil-works/pi-ai/providers/zai'),
      import('@earendil-works/pi-ai/providers/minimax'),
      import('@earendil-works/pi-ai/providers/moonshotai'),
    ]).then(([core, openAICompletionsLazy, anthropic, openai, google, xai, deepseek, zai, minimax, moonshotai]) => ({
      createModels: core.createModels,
      createProvider: core.createProvider,
      openAICompletionsApi: openAICompletionsLazy.openAICompletionsApi,
      anthropicProvider: anthropic.anthropicProvider,
      openaiProvider: openai.openaiProvider,
      googleProvider: google.googleProvider,
      xaiProvider: xai.xaiProvider,
      deepseekProvider: deepseek.deepseekProvider,
      zaiProvider: zai.zaiProvider,
      minimaxProvider: minimax.minimaxProvider,
      moonshotaiProvider: moonshotai.moonshotaiProvider,
    }));
  }
  return piAiModulesPromise;
}

async function buildBuiltinModels() {
  const pi = await loadPiAi();
  const models = pi.createModels();
  models.setProvider(pi.openaiProvider());
  models.setProvider(pi.anthropicProvider());
  models.setProvider(pi.googleProvider());
  models.setProvider(pi.xaiProvider());
  models.setProvider(pi.deepseekProvider());
  models.setProvider(pi.zaiProvider());
  models.setProvider(pi.minimaxProvider());
  models.setProvider(pi.moonshotaiProvider());
  return models;
}

function resolveOpenAiCompatibleBaseUrl(config: LlmConfig): string {
  if (config.provider === 'custom') {
    if (!config.baseUrl) {
      throw new Error('自定义 OpenAI 兼容端点需要提供 baseUrl');
    }
    return config.baseUrl;
  }
  return OPENAI_COMPATIBLE_BASE_URL[config.provider as Exclude<OpenAiCompatibleProviderId, 'custom'>];
}

async function resolveModel(config: LlmConfig): Promise<{ models: Awaited<ReturnType<typeof buildBuiltinModels>>; model: Model<Api> }> {
  if (isBuiltinProvider(config.provider)) {
    const models = await buildBuiltinModels();
    const catalogId = BUILTIN_CATALOG_ID[config.provider];
    const model = models.getModel(catalogId, config.model);
    if (!model) {
      throw new Error(`未在 ${config.provider} 模型目录中找到 "${config.model}"`);
    }
    return { models, model };
  }

  const pi = await loadPiAi();
  const baseUrl = resolveOpenAiCompatibleBaseUrl(config);
  const model: Model<'openai-completions'> = {
    id: config.model,
    name: config.model,
    api: 'openai-completions',
    provider: config.provider,
    baseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  };

  const provider = pi.createProvider({
    id: config.provider,
    baseUrl,
    auth: {
      apiKey: {
        name: config.provider,
        resolve: async () => ({ auth: { apiKey: config.apiKey } }),
      },
    },
    models: [model],
    api: pi.openAICompletionsApi(),
  });

  const models = pi.createModels();
  models.setProvider(provider);
  return { models, model };
}

/**
 * Sends a single user-turn completion through the given provider + API key
 * and returns the assistant's text reply. Explicit `apiKey` always overrides
 * whatever the provider would otherwise resolve (env var, stored credential),
 * matching how the app stores keys itself rather than in the environment.
 *
 * `debugExport` is this function's single hook for the "导出提示词调试日志"
 * setting — every call site threads its own `source` label and the current
 * preference through here rather than each one writing files itself, so the
 * export behavior (including on failure, see the catch below) only needs to
 * be implemented once.
 */
export async function callLlm(config: LlmConfig, userMessage: string, debugExport?: DebugExportContext): Promise<string> {
  const startedAt = new Date();
  try {
    const { models, model } = await resolveModel(config);

    const context: Context = {
      messages: [{ role: 'user', content: userMessage, timestamp: Date.now() }],
    };

    const response = await models.completeSimple(model, context, { apiKey: config.apiKey });

    if (response.stopReason === 'error' || response.stopReason === 'aborted') {
      throw new Error(response.errorMessage ?? 'LLM 调用失败');
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('LLM 响应不包含文本内容');
    }

    exportDebugInteraction(debugExport, {
      provider: config.provider,
      model: config.model,
      prompt: userMessage,
      response: textBlock.text,
      timestamp: startedAt,
    });
    return textBlock.text;
  } catch (error) {
    exportDebugInteraction(debugExport, {
      provider: config.provider,
      model: config.model,
      prompt: userMessage,
      error: error instanceof Error ? error.message : String(error),
      timestamp: startedAt,
    });
    throw error;
  }
}
