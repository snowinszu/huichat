import type { ChatCardRecord, MessageRecord, PersonaRecord, ReplyCandidate } from '../../shared/ipc-types.js';
import { SMART_TONE_ID } from '../../shared/tone.js';
import { buildContextSection, LANGUAGE_INSTRUCTION } from './promptContext.js';

interface BuildReplyPromptInput {
  card: ChatCardRecord;
  persona: PersonaRecord | undefined;
  messages: MessageRecord[];
  tone: string;
  debugMode?: boolean;
}

const REPLY_JSON_SCHEMA =
  '{"replies": [{"text": "候选回复1", "translation": "中文翻译或 null"}, {"text": "候选回复2", "translation": "..."}, {"text": "候选回复3", "translation": "..."}]}';

// When the history's last message is already 'self' (我 spoke last, 对方
// hasn't replied yet), the model has no signal that it shouldn't be
// "responding" to anything — left unstated, it tends to generate a candidate
// that reads like 对方's reaction to what 我 just said (e.g. 我 says "我打算
// 去日本", and a candidate comes back as "那真期待呢，什么时候去？", which
// voices 对方's side, not 我's). Naming this situation explicitly steers the
// model toward what 我 would actually say next — a follow-up, a new topic, a
// clarification — instead of impersonating the other party's expected reply.
function buildAwaitingReplyNote(messages: MessageRecord[]): string {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'self') return '';
  return '\n\n【注意】对方还没有针对"我"最后一条消息做出回复。你现在生成的候选回复是"我"主动追加的话（比如换个话题、追问一句、补充说明，或礼貌地等待对方回应等），而不是在扮演"对方"回应"我"刚才说的内容——三条候选回复都不能读起来像"对方"会说的话。';
}

// Smart mode (#027) sends the SMART_TONE_ID sentinel instead of a real tone
// name — it must never be interpolated into the prompt literally. Ask the
// model to infer the tone from context instead, while still holding all 3
// candidates to that one (unstated) tone for consistency.
export function buildReplyPrompt({ card, persona, messages, tone, debugMode }: BuildReplyPromptInput): string {
  const isSmartTone = tone === SMART_TONE_ID;
  const toneInstruction = isSmartTone
    ? '请结合对方信息、己方角色、最终目标、短期目标和历史消息，自动判断最合适的一种语气'
    : `请以"${tone}"的语气`;
  const toneConsistency = isSmartTone
    ? '3 条回复内容互不相同，但语气需保持统一（即你自动判断出的同一种语气）'
    : `3 条回复内容互不相同，但语气统一保持"${tone}"`;

  return `你是一个聊天助手，帮助用户（下文中的"我"）为正在进行的聊天生成回复候选。

${buildContextSection({ card, persona, messages, debugMode })}${buildAwaitingReplyNote(messages)}

【任务】
${toneInstruction}，为"我"生成 3 条可以直接发送给对方的候选回复。${LANGUAGE_INSTRUCTION}要求：
1. ${toneConsistency}；
2. 每条都要贴合上面的聊天记录、对方信息和目标，读起来像是"我"会说的话；
3. 只输出候选回复本身，不要输出多余的解释、前后缀或编号；
4. 严格按下面的 JSON 格式输出，不要输出任何 JSON 之外的文字：
${REPLY_JSON_SCHEMA}`;
}

function toReplyCandidate(item: unknown): ReplyCandidate | null {
  if (typeof item === 'string') {
    const text = item.trim();
    return text ? { text, translation: null } : null;
  }
  if (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string') {
    const text = (item as { text: string }).text.trim();
    if (!text) return null;
    const rawTranslation = (item as { translation?: unknown }).translation;
    const translation = typeof rawTranslation === 'string' && rawTranslation.trim() ? rawTranslation.trim() : null;
    return { text, translation };
  }
  return null;
}

/**
 * The model is asked for strict JSON but still sometimes wraps it in prose
 * or a code fence — pull out the first {...} block and parse that. If even
 * that fails, fall back to treating non-empty lines (with any leading
 * numbering stripped) as the three replies with no translation, so a
 * slightly-off response still produces something usable instead of a hard
 * error.
 */
export function parseReplies(responseText: string): ReplyCandidate[] {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { replies?: unknown };
      if (Array.isArray(parsed.replies)) {
        const replies = parsed.replies.map(toReplyCandidate).filter((item): item is ReplyCandidate => item !== null);
        if (replies.length > 0) return replies.slice(0, 3);
      }
    } catch {
      // Fall through to line-based parsing below.
    }
  }

  const lines = responseText
    .split('\n')
    .map((line) => line.replace(/^\s*[\d一二三]+[.、)]\s*/, '').trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) throw new Error('AI 未返回有效的候选回复');
  return lines.slice(0, 3).map((text) => ({ text, translation: null }));
}
