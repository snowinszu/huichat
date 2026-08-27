import type Database from 'better-sqlite3';
import { getChatCard, updateChatCard } from '../db/chatCardRepository.js';
import { getPersona, updatePersona } from '../db/personaRepository.js';
import { getCurrentModelCard } from '../db/modelCardRepository.js';
import { getAppPreference } from '../db/appPreferenceRepository.js';
import { listMessagesByChatCard } from '../db/messageRepository.js';
import { callLlm } from './client.js';
import type { DebugExportContext } from '../debugExport.js';
import type { MessageRecord } from '../../shared/ipc-types.js';

/** Extraction runs once per this many messages (all roles counted), not on every insert — batching cuts LLM calls by the same factor and gives the model more context per call than a single line would. */
export const AUTO_EXTRACT_BATCH_SIZE = 20;

export function appendFact(existing: string, addition: string): string {
  const trimmedExisting = existing.trim();
  return trimmedExisting ? `${trimmedExisting}；${addition}` : addition;
}

export function buildExtractPrompt(existingInfo: string, subject: '对方' | '我', messageContent: string): string {
  return `你在帮用户维护一份关于"${subject}"的简短事实档案。

【已记录的信息】
${existingInfo || '（暂无记录）'}

【新消息】（可能包含多条，按时间先后顺序）
${messageContent}

【任务】
如果这些新消息里包含关于"${subject}"的新事实（比如姓名、生日、职业、爱好、习惯、常去的地方等），且这些事实不在"已记录的信息"里，请用简洁的中文短语列出这些新事实，用"、"分隔。
如果没有新的事实信息，只输出：NONE
不要输出任何其他内容，不要重复"已记录的信息"里已有的内容。`;
}

export function parseExtractedFacts(responseText: string): string | null {
  const trimmed = responseText.trim();
  if (!trimmed || trimmed.toUpperCase() === 'NONE') return null;
  return trimmed;
}

function joinContentByRole(messages: MessageRecord[], role: 'other' | 'self'): string {
  return messages
    .filter((message) => message.role === role && message.content.trim())
    .map((message) => message.content.trim())
    .join('\n');
}

/**
 * Fire-and-forget: the caller (message:insert's IPC handler) never awaits
 * this — a slow or failing LLM call must not delay the paste/reply flow the
 * user is actually looking at. Any failure (no current model card, network
 * error, malformed response) is swallowed by the caller's `.catch`, per the
 * AC's "静默记录错误日志，不阻塞聊天流程".
 *
 * Only runs once the chat card's total message count (all roles, including
 * annotations) is an exact multiple of `AUTO_EXTRACT_BATCH_SIZE` — everything
 * in between is a no-op, so this is safe and cheap to call after every
 * insert. When it does run, it looks at the most recent batch (not just the
 * message that was just inserted) and extracts 对方/我 facts from whichever
 * of those are actually 'other'/'self' messages with content.
 *
 * `callModel` defaults to the real `callLlm` and is only ever overridden in
 * tests — production call sites never pass it.
 */
export async function maybeExtractInfo(db: Database.Database, chatCardId: number, callModel: typeof callLlm = callLlm): Promise<void> {
  const allMessages = listMessagesByChatCard(db, chatCardId);
  if (allMessages.length === 0 || allMessages.length % AUTO_EXTRACT_BATCH_SIZE !== 0) return;

  const recentMessages = allMessages.slice(-AUTO_EXTRACT_BATCH_SIZE);

  const card = getChatCard(db, chatCardId);
  if (!card) return;

  const modelCard = getCurrentModelCard(db);
  if (!modelCard) return;

  const llmConfig = {
    provider: modelCard.provider,
    apiKey: modelCard.apiKey,
    model: modelCard.model,
    baseUrl: modelCard.baseUrl ?? undefined,
  };
  const preference = getAppPreference(db);
  const debugExport: DebugExportContext = { source: '自动信息提取', enabled: preference.debugPromptExport, dir: preference.debugExportDir };

  const otherContent = joinContentByRole(recentMessages, 'other');
  if (otherContent) {
    const prompt = buildExtractPrompt(card.otherInfo, '对方', otherContent);
    const facts = parseExtractedFacts(await callModel(llmConfig, prompt, debugExport));
    if (facts) updateChatCard(db, card.id, { otherInfo: appendFact(card.otherInfo, facts) });
  }

  // Facts about "我" are recorded on the linked persona, not the chat card.
  // No persona linked means nowhere to record them.
  if (!card.personaId) return;
  const persona = getPersona(db, card.personaId);
  if (!persona) return;

  const selfContent = joinContentByRole(recentMessages, 'self');
  if (!selfContent) return;

  const prompt = buildExtractPrompt(persona.bio, '我', selfContent);
  const facts = parseExtractedFacts(await callModel(llmConfig, prompt, debugExport));
  if (facts) updatePersona(db, persona.id, { bio: appendFact(persona.bio, facts) });
}
