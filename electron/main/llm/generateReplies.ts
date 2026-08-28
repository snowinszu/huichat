import type { ChatCardRecord, MessageRecord, PersonaRecord, ReplyCandidate } from '../../shared/ipc-types.js';
import { SMART_TONE_ID } from '../../shared/tone.js';
import { buildContextSection, LANGUAGE_INSTRUCTION } from './promptContext.js';

interface BuildReplyPromptInput {
  card: ChatCardRecord;
  persona: PersonaRecord | undefined;
  messages: MessageRecord[];
  tone: string;
  debugMode?: boolean;
  /** First phase of the web-search flow (#062): ask the model to decide, in this same call, whether it needs to search for real-time info before it can answer well. Mutually exclusive with `searchResults`. */
  webSearchEnabled?: boolean;
  /** Second phase of the web-search flow: search results to ground the final reply in, once `webSearchEnabled` came back with `needsSearch: true`. Mutually exclusive with `webSearchEnabled`. */
  searchResults?: string;
}

const REPLY_JSON_SCHEMA =
  '{"replies": [{"text": "候选回复1", "translation": "中文翻译或 null"}, {"text": "候选回复2", "translation": "..."}, {"text": "候选回复3", "translation": "..."}]}';

const REPLY_JSON_SCHEMA_WITH_SEARCH_DECISION =
  '{"needsSearch": true 或 false, "searchQuery": "搜索关键词或 null", "replies": [{"text": "候选回复1", "translation": "中文翻译或 null"}, {"text": "候选回复2", "translation": "..."}, {"text": "候选回复3", "translation": "..."}]}';

function buildCurrentDateNote(): string {
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  return `\n\n【当前日期】今天是${today}。`;
}

function buildSearchResultsSection(searchResults: string): string {
  return `\n\n【实时搜索结果】（以下是为回答时效性问题联网查到的参考信息，如果与对方的问题无关可以忽略）\n${searchResults}`;
}

// Only shown in the first phase (webSearchEnabled, no searchResults yet) — asks
// the model to decide, alongside its normal 3-reply generation, whether this
// turn actually needs real-time info. needsSearch must stay false for
// ordinary chit-chat so the common case never pays for a search + second
// generation pass; the 3 replies are still required even when true, so
// there's a usable fallback if the search step fails downstream.
const SEARCH_DECISION_GUIDANCE =
  '\n\n【联网判断】如果对方最后一条消息涉及你不确定、需要实时信息才能准确回答的时效性问题（比如天气、具体日期、新闻、演出或赛事时间等），把 needsSearch 设为 true，并在 searchQuery 中给出一个精炼的搜索关键词；普通聊天、情感交流等不需要查证的内容一律把 needsSearch 设为 false，searchQuery 设为 null。即使 needsSearch 为 true，也必须照常给出 3 条 replies 作为兜底候选。';

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
export function buildReplyPrompt({
  card,
  persona,
  messages,
  tone,
  debugMode,
  webSearchEnabled,
  searchResults,
}: BuildReplyPromptInput): string {
  const isSmartTone = tone === SMART_TONE_ID;
  const toneInstruction = isSmartTone
    ? '请结合对方信息、己方角色、最终目标、短期目标和历史消息，自动判断最合适的一种语气'
    : `请以"${tone}"的语气`;
  const toneConsistency = isSmartTone
    ? '3 条回复内容互不相同，但语气需保持统一（即你自动判断出的同一种语气）'
    : `3 条回复内容互不相同，但语气统一保持"${tone}"`;

  const dateNote = webSearchEnabled ? buildCurrentDateNote() : '';
  const searchSection = searchResults ? buildSearchResultsSection(searchResults) : '';
  const schema = webSearchEnabled ? REPLY_JSON_SCHEMA_WITH_SEARCH_DECISION : REPLY_JSON_SCHEMA;
  const searchGuidance = webSearchEnabled ? SEARCH_DECISION_GUIDANCE : '';

  return `你是一个聊天助手，帮助用户（下文中的"我"）为正在进行的聊天生成回复候选。

${buildContextSection({ card, persona, messages, debugMode })}${buildAwaitingReplyNote(messages)}${dateNote}${searchSection}

【任务】
${toneInstruction}，为"我"生成 3 条可以直接发送给对方的候选回复。${LANGUAGE_INSTRUCTION}要求：
1. ${toneConsistency}；
2. 每条都要贴合上面的聊天记录、对方信息和目标，读起来像是"我"会说的话；
3. 只输出候选回复本身，不要输出多余的解释、前后缀或编号；
4. 严格按下面的 JSON 格式输出，不要输出任何 JSON 之外的文字：
${schema}${searchGuidance}`;
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

export interface GenerateRepliesDecision {
  replies: ReplyCandidate[];
  needsSearch: boolean;
  searchQuery: string | null;
}

/**
 * First-phase response parser for the web-search flow (see
 * REPLY_JSON_SCHEMA_WITH_SEARCH_DECISION) — same strict-JSON attempt as
 * `parseReplies`, plus the `needsSearch`/`searchQuery` decision fields.
 * Falls back to `parseReplies`'s own line-based tolerance (with search
 * disabled) rather than duplicating it, so a response that doesn't parse as
 * the extended schema still produces usable replies.
 */
export function parseGenerateRepliesResponse(responseText: string): GenerateRepliesDecision {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { replies?: unknown; needsSearch?: unknown; searchQuery?: unknown };
      if (Array.isArray(parsed.replies)) {
        const replies = parsed.replies.map(toReplyCandidate).filter((item): item is ReplyCandidate => item !== null);
        if (replies.length > 0) {
          const rawSearchQuery = typeof parsed.searchQuery === 'string' ? parsed.searchQuery.trim() : '';
          const needsSearch = parsed.needsSearch === true && rawSearchQuery.length > 0;
          return { replies: replies.slice(0, 3), needsSearch, searchQuery: needsSearch ? rawSearchQuery : null };
        }
      }
    } catch {
      // Fall through to parseReplies' own fallback below.
    }
  }

  return { replies: parseReplies(responseText), needsSearch: false, searchQuery: null };
}
