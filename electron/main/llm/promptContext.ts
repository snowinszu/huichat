import type { ChatCardRecord, MessageRecord, PersonaRecord } from '../../shared/ipc-types.js';

export interface PromptContextInput {
  card: ChatCardRecord;
  persona: PersonaRecord | undefined;
  messages: MessageRecord[];
  /** Mirrors the "导出提示词调试日志" preference — while on, the retention window shrinks so truncation/summarization can be observed with a handful of test messages instead of hundreds. */
  debugMode?: boolean;
}

/**
 * Messages within this many of the most recent are always sent in full.
 * Defined here (not in summarizeHistory.ts) so summarizeHistory.ts can
 * import it from this module instead of the reverse — that module already
 * needs `formatMessage` from here, and a two-way import would be circular.
 */
export const HISTORY_RETENTION_WINDOW = 100;

/** Debug-mode override for `HISTORY_RETENTION_WINDOW` — see `resolveHistoryRetentionWindow`. */
export const HISTORY_RETENTION_WINDOW_DEBUG = 10;

export function resolveHistoryRetentionWindow(debugMode: boolean | undefined): number {
  return debugMode ? HISTORY_RETENTION_WINDOW_DEBUG : HISTORY_RETENTION_WINDOW;
}

/** Exported so summarizeHistory.ts can format the same messages the same way when compressing them into a summary. */
export function formatMessage(message: MessageRecord): string {
  if (message.role === 'annotation') {
    return `对方发来一个${message.annotationType ?? '内容'}：${message.annotationText ?? ''}`;
  }
  const speaker = message.role === 'self' ? '我' : '对方';
  const translationSuffix = message.translation ? `（中文翻译：${message.translation}）` : '';
  return `${speaker}：${message.content}${translationSuffix}`;
}

// Beyond HISTORY_RETENTION_WINDOW messages, sending the entire thread on
// every generate/polish/evaluate call makes the prompt (and its cost) grow
// without bound and can eventually exceed the model's context window.
// maybeSummarizeHistory (summarizeHistory.ts) keeps `card.historySummary`
// caught up in the background; this just decides what to show given
// whatever summary currently exists — never blocks on generating a fresh one.
function buildHistorySection(card: ChatCardRecord, messages: MessageRecord[], debugMode: boolean | undefined): string {
  const retentionWindow = resolveHistoryRetentionWindow(debugMode);
  const recentMessages = messages.length > retentionWindow ? messages.slice(-retentionWindow) : messages;
  const recentText = recentMessages.length > 0 ? recentMessages.map(formatMessage).join('\n') : '（暂无历史消息）';

  // Still within the window, or over it but no summary has been generated
  // yet (e.g. the background summarization hasn't caught up) — both cases
  // read identically to the pre-truncation behavior: just the messages,
  // no summary placeholder.
  if (messages.length <= retentionWindow || !card.historySummary) {
    return `【聊天记录】（按时间先后顺序）\n${recentText}`;
  }

  return `【更早的对话摘要】\n${card.historySummary}\n\n【最近的聊天记录】（按时间先后顺序）\n${recentText}`;
}

// A separate section (rather than folding into 【我的角色设定】) so it reads
// as a concrete, literal instruction about wording/punctuation/emoji habits
// rather than personality/background — and so it can be omitted entirely
// when unset instead of leaving an empty sub-heading under the role setup.
function buildStyleSection(persona: PersonaRecord | undefined): string {
  return persona?.style ? `\n\n【说话习惯】\n${persona.style}` : '';
}

/** The card/persona/goal/history block shared by every LLM prompt in this app (candidate replies, draft polish, …). */
export function buildContextSection({ card, persona, messages, debugMode }: PromptContextInput): string {
  return `【对方信息】
${card.otherInfo || '未填写'}

【我的角色设定】
${persona?.bio || '未设置角色'}${buildStyleSection(persona)}

【聊天最终目标】
${card.longTermGoal || '未设定'}

【本次短期目标】
${card.shortTermGoal || '未设定'}

${buildHistorySection(card, messages, debugMode)}`;
}

// Shared by every prompt that produces text to send to the other party
// (candidate replies, draft polish): the language to write in isn't just
// "whatever the last message was written in" — a background note like
// "他是日本人" is just as strong a signal, and can be the only one available
// when the thread is empty or was typed in Chinese by habit. Both signals
// already sit in buildContextSection's output (【对方信息】 and 【聊天记录】),
// so this hands the actual judgment call to the model instead of us
// pre-computing a single Chinese/non-Chinese flag in code. Also asks for
// locally idiomatic phrasing rather than a stiff word-for-word translation
// register — a textbook-correct but unnatural sentence still reads as
// obviously foreign to a native speaker.
export const LANGUAGE_INSTRUCTION =
  '请结合上面的【对方信息】和【聊天记录】判断双方实际使用、或最适合使用的语言——比如对方信息里提到对方的国籍、母语，或聊天记录里对方本来就是用某种语言在聊——并用这个语言书写以上内容；没有任何明确线索时默认用中文。用该语言书写时，要用当地母语者聊天时真正会用的地道表达方式（口语习惯、俚语、语气词等），不要写成生硬的逐字翻译腔。如果你判断出的语言不是中文，请为每一条结果额外提供准确的中文翻译（translation 字段）；如果是中文，translation 字段留 null。';
