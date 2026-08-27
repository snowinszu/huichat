import type Database from 'better-sqlite3';
import { getChatCard, updateChatCard } from '../db/chatCardRepository.js';
import { getCurrentModelCard } from '../db/modelCardRepository.js';
import { getAppPreference } from '../db/appPreferenceRepository.js';
import { listMessagesByChatCard } from '../db/messageRepository.js';
import { callLlm } from './client.js';
import { formatMessage, resolveHistoryRetentionWindow } from './promptContext.js';
import { estimateTokenCount } from './estimateTokens.js';
import type { DebugExportContext } from '../debugExport.js';

/** A summarization pass only runs once the not-yet-summarized backlog (older than the retention window) reaches roughly this many estimated tokens — small backlogs just accumulate until then. */
export const SUMMARY_TRIGGER_TOKEN_THRESHOLD = 3000;

/** Debug-mode override for `SUMMARY_TRIGGER_TOKEN_THRESHOLD`: a plain message count instead of an estimated token count, so summarization can be observed with a handful of short test messages instead of needing thousands of real tokens. */
export const SUMMARY_TRIGGER_MESSAGE_COUNT_DEBUG = 10;

/** Hard cap on the summary text itself, enforced in code (not just asked for in the prompt) — otherwise the rolling summary could itself grow unbounded over a very long chat. */
export const SUMMARY_MAX_LENGTH = 500;

export function buildSummaryPrompt(existingSummary: string, newOlderContent: string): string {
  return `你在帮用户维护一份关于当前聊天记录的历史摘要，方便后续对话不需要看到很久以前的完整原文，也能记得聊过的重点内容。

【已有摘要】
${existingSummary || '（暂无摘要）'}

【需要合并进摘要的更早消息】（按时间先后顺序）
${newOlderContent}

【任务】
请把"已有摘要"和"需要合并进摘要的更早消息"合并、压缩成一份新的摘要，要求：
1. 保留对后续对话仍然重要的信息（比如聊过的话题、说过的关键事实、做出的承诺或计划、双方关系的进展等）；
2. 用简洁的陈述句概括，不要逐句复述原文；
3. 全文不超过 ${SUMMARY_MAX_LENGTH} 字；
4. 只输出摘要正文本身，不要输出任何解释、前后缀或标题。`;
}

/**
 * Fire-and-forget, same contract as `maybeExtractInfo`: the caller
 * (message:insert's IPC handler) never awaits this, and any failure (no
 * current model card, network error) must be swallowed by the caller's
 * `.catch` rather than propagating — a slow or broken summarization run must
 * never block the paste/reply flow the user is actually looking at.
 *
 * Only the messages older than the retention window and not yet folded into
 * `historySummary` (tracked via `summarizedThroughMessageId`) are candidates.
 * Normally their estimated token count has to clear
 * `SUMMARY_TRIGGER_TOKEN_THRESHOLD` before an LLM call actually happens —
 * below that, the backlog just keeps accumulating for next time, so this is
 * cheap to call after every single insert. With "导出提示词调试日志" on, both
 * the retention window and the trigger shrink to a small fixed message count
 * (`SUMMARY_TRIGGER_MESSAGE_COUNT_DEBUG`) so the whole truncate+summarize
 * cycle can be watched play out with a handful of short test messages
 * instead of needing a real conversation's worth of tokens.
 */
export async function maybeSummarizeHistory(db: Database.Database, chatCardId: number, callModel: typeof callLlm = callLlm): Promise<void> {
  const preference = getAppPreference(db);
  const debugMode = preference.debugPromptExport;
  const retentionWindow = resolveHistoryRetentionWindow(debugMode);

  const allMessages = listMessagesByChatCard(db, chatCardId);
  if (allMessages.length <= retentionWindow) return;

  const card = getChatCard(db, chatCardId);
  if (!card) return;

  const olderMessages = allMessages.slice(0, allMessages.length - retentionWindow);
  const newOlderMessages =
    card.summarizedThroughMessageId === null
      ? olderMessages
      : olderMessages.filter((message) => message.id > card.summarizedThroughMessageId!);
  if (newOlderMessages.length === 0) return;

  const newOlderContent = newOlderMessages.map(formatMessage).join('\n');
  const shouldSummarize = debugMode
    ? newOlderMessages.length >= SUMMARY_TRIGGER_MESSAGE_COUNT_DEBUG
    : estimateTokenCount(newOlderContent) >= SUMMARY_TRIGGER_TOKEN_THRESHOLD;
  if (!shouldSummarize) return;

  const modelCard = getCurrentModelCard(db);
  if (!modelCard) return;

  const llmConfig = {
    provider: modelCard.provider,
    apiKey: modelCard.apiKey,
    model: modelCard.model,
    baseUrl: modelCard.baseUrl ?? undefined,
  };
  const debugExport: DebugExportContext = { source: '历史摘要', enabled: preference.debugPromptExport, dir: preference.debugExportDir };

  const prompt = buildSummaryPrompt(card.historySummary, newOlderContent);
  const responseText = (await callModel(llmConfig, prompt, debugExport)).trim();
  if (!responseText) return;

  // Non-null: guarded by the `newOlderMessages.length === 0` early return above.
  const lastSummarizedMessage = newOlderMessages[newOlderMessages.length - 1]!;
  updateChatCard(db, card.id, {
    historySummary: responseText.slice(0, SUMMARY_MAX_LENGTH),
    summarizedThroughMessageId: lastSummarizedMessage.id,
  });
}
