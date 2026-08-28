// Shared between main (repository return types), preload (IPC bridge), and
// renderer (window.api typing) so the three worlds never drift apart.

export type MessageRole = 'other' | 'self' | 'annotation';

export interface MessageRecord {
  id: number;
  chatCardId: number;
  role: MessageRole;
  content: string;
  translation: string | null;
  annotationType: string | null;
  annotationText: string | null;
  createdAt: number;
}

export interface InsertMessageInput {
  chatCardId: number;
  role: MessageRole;
  content?: string;
  translation?: string | null;
  annotationType?: string | null;
  annotationText?: string | null;
}

export interface ChatCardRecord {
  id: number;
  name: string;
  otherInfo: string;
  avatarPath: string | null;
  longTermGoal: string;
  shortTermGoal: string;
  // Nullable: deleting a persona sets this to null on every card that
  // referenced it (ON DELETE SET NULL) rather than blocking the delete.
  personaId: number | null;
  // Nullable: deleting a group sets this to null on every card that
  // referenced it (ON DELETE SET NULL) rather than blocking the delete.
  groupId: number | null;
  createdAt: number;
  updatedAt: number;
  // Rolling summary of messages older than the retention window, and the id
  // of the newest message already folded into it — see maybeSummarizeHistory.
  // Never set at creation time; system-managed, starts empty/null.
  historySummary: string;
  summarizedThroughMessageId: number | null;
}

export interface CreateChatCardInput {
  name: string;
  otherInfo?: string;
  avatarPath?: string | null;
  longTermGoal?: string;
  shortTermGoal?: string;
  personaId?: number | null;
  groupId?: number | null;
}

export interface UpdateChatCardInput {
  name?: string;
  otherInfo?: string;
  avatarPath?: string | null;
  longTermGoal?: string;
  shortTermGoal?: string;
  personaId?: number | null;
  groupId?: number | null;
  historySummary?: string;
  summarizedThroughMessageId?: number | null;
}

/** Aggregated stats for one chat card's self/other message history — see chatStatsRepository.ts for how each field is computed. `null` fields mean "not enough data" (e.g. fewer than 2 messages), not zero. */
export interface ChatStatsRecord {
  selfMessageCount: number;
  otherMessageCount: number;
  activeDays: number;
  firstMessageAt: number | null;
  lastMessageAt: number | null;
  longestStreakDays: number;
  longestSilenceMs: number | null;
  avgMessagesPerActiveDay: number;
  /** Index 0 = 0 时 … index 23 = 23 时, local time. */
  hourDistribution: number[];
  /** Index 0 = 周一 … index 6 = 周日, local time. */
  weekdayDistribution: number[];
  selfInitiatedDays: number;
  otherInitiatedDays: number;
}

export type GoalAchievementVerdict = '未达成' | '部分达成' | '已达成';

export interface GoalEvaluationResult {
  verdict: GoalAchievementVerdict;
  reason: string;
}

export interface GenerateRepliesInput {
  chatCardId: number;
  tone: string;
}

export interface PolishDraftInput {
  chatCardId: number;
  tone: string;
  draft: string;
}

/** A single generated/polished reply — `translation` is set only when the other party's last message wasn't Chinese and the reply was written to match that language. */
export interface ReplyCandidate {
  text: string;
  translation: string | null;
}

export interface PersonaRecord {
  id: number;
  name: string;
  bio: string;
  // Concrete writing/speech habits (e.g. "不加标点符号"), kept separate from
  // `bio` so it can be injected into prompts as its own 【说话习惯】 section —
  // see promptContext.ts's buildContextSection.
  style: string;
  createdAt: number;
  updatedAt: number;
}

/** A persona plus how many chat cards currently reference it — drives the plain-vs-warning delete confirmation. */
export interface PersonaWithUsage extends PersonaRecord {
  usageCount: number;
}

export interface CreatePersonaInput {
  name: string;
  bio?: string;
  style?: string;
}

export interface UpdatePersonaInput {
  name?: string;
  bio?: string;
  style?: string;
}

export interface GroupRecord {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** A group plus how many chat cards currently reference it — drives the "N 个聊天对象将变为未分组" delete warning. */
export interface GroupWithUsage extends GroupRecord {
  usageCount: number;
}

export interface CreateGroupInput {
  name: string;
}

export type LlmProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'deepseek'
  | 'zai'
  | 'minimax'
  | 'moonshot'
  | 'zhipu'
  | 'qwen'
  | 'custom';

export interface SettingsRecord {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  baseUrl: string | null;
  updatedAt: number;
}

export interface SaveSettingsInput {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
}

/** One saved LLM configuration. At most one row across the whole table has `isCurrent: true` at any time — that's the config every AI-calling feature uses. */
export interface ModelCardRecord {
  id: number;
  name: string;
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  baseUrl: string | null;
  isCurrent: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateModelCardInput {
  name: string;
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
}

export interface UpdateModelCardInput {
  name?: string;
  provider?: LlmProviderId;
  apiKey?: string;
  model?: string;
  baseUrl?: string | null;
}

/** App-wide behavior toggles, one row for the whole app (like `settings` was). Always readable — schema.ts seeds row id=1 with defaults, so this is never `undefined`. */
export interface AppPreferenceRecord {
  translateNonChinese: boolean;
  autoAddToHistory: boolean;
  autoExtractInfo: boolean;
  darkMode: boolean;
  debugPromptExport: boolean;
  debugExportDir: string | null;
  webSearchEnabled: boolean;
  webSearchApiKey: string | null;
  updatedAt: number;
}

export interface UpdateAppPreferenceInput {
  translateNonChinese?: boolean;
  autoAddToHistory?: boolean;
  autoExtractInfo?: boolean;
  darkMode?: boolean;
  debugPromptExport?: boolean;
  debugExportDir?: string | null;
  webSearchEnabled?: boolean;
  webSearchApiKey?: string | null;
}

/** Whether an app-lock password is currently set — drives the settings toggle and whether the title-bar lock icon shows at all. */
export interface AppLockStatus {
  enabled: boolean;
}

export const IPC_CHANNELS = {
  messageInsert: 'message:insert',
  messageListByChatCard: 'message:list-by-chat-card',
  messageTranslate: 'message:translate',
  messageDelete: 'message:delete',
  messageRevert: 'message:revert',
  chatCardCreate: 'chat-card:create',
  chatCardGet: 'chat-card:get',
  chatCardList: 'chat-card:list',
  chatCardUpdate: 'chat-card:update',
  chatCardDelete: 'chat-card:delete',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  llmTestConnection: 'llm:test-connection',
  personaCreate: 'persona:create',
  personaGet: 'persona:get',
  personaListWithUsage: 'persona:list-with-usage',
  personaUpdate: 'persona:update',
  personaDelete: 'persona:delete',
  personaDuplicate: 'persona:duplicate',
  chatGroupCreate: 'chat-group:create',
  chatGroupListWithUsage: 'chat-group:list-with-usage',
  chatGroupRename: 'chat-group:rename',
  chatGroupDelete: 'chat-group:delete',
  avatarSave: 'avatar:save',
  replyGenerate: 'reply:generate',
  replyPolish: 'reply:polish',
  // list/getCurrent are wired up in Issue #14; create/update/delete/setCurrent
  // are reserved here and wired up by Issues #16/#17 alongside their UI.
  modelCardList: 'model-card:list',
  modelCardGet: 'model-card:get',
  modelCardGetCurrent: 'model-card:get-current',
  modelCardCreate: 'model-card:create',
  modelCardUpdate: 'model-card:update',
  modelCardDelete: 'model-card:delete',
  modelCardSetCurrent: 'model-card:set-current',
  appPreferenceGet: 'app-preference:get',
  appPreferenceUpdate: 'app-preference:update',
  appLockGetStatus: 'app-lock:get-status',
  appLockSetPassword: 'app-lock:set-password',
  appLockVerifyPassword: 'app-lock:verify-password',
  appLockClearPassword: 'app-lock:clear-password',
  appLockIsLocked: 'app-lock:is-locked',
  appLockEngage: 'app-lock:engage',
  appLockUnlock: 'app-lock:unlock',
  appLockResetData: 'app-lock:reset-data',
  debugExportChooseDirectory: 'debug-export:choose-directory',
  chatStatsGet: 'chat-stats:get',
  chatStatsEvaluateGoal: 'chat-stats:evaluate-goal',
} as const;
