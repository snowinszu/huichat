import type { ChatCardRecord, MessageRecord, PersonaRecord } from '../../shared/ipc-types.js';
import { SMART_TONE_ID } from '../../shared/tone.js';
import { buildContextSection, LANGUAGE_INSTRUCTION } from './promptContext.js';

interface BuildPolishPromptInput {
  card: ChatCardRecord;
  persona: PersonaRecord | undefined;
  messages: MessageRecord[];
  tone: string;
  draft: string;
  debugMode?: boolean;
}

const POLISH_JSON_SCHEMA =
  '{"replies": [{"text": "润色结果1", "translation": "中文翻译或 null"}, {"text": "润色结果2", "translation": "..."}, {"text": "润色结果3", "translation": "..."}]}';

// Smart mode (#027) sends the SMART_TONE_ID sentinel instead of a real tone
// name — it must never be interpolated into the prompt literally. Ask the
// model to infer the tone from the draft and chat context instead.
export function buildPolishPrompt({ card, persona, messages, tone, draft, debugMode }: BuildPolishPromptInput): string {
  const toneInstruction =
    tone === SMART_TONE_ID ? '请结合草稿内容与对话上下文，自动判断最合适的语气进行润色' : `语气统一保持"${tone}"`;

  return `你是一个聊天助手，帮助用户（下文中的"我"）把想对聊天对象说的话打磨得更得体自然。

${buildContextSection({ card, persona, messages, debugMode })}

【我想表达的原始草稿】
${draft}

【任务】
请在保留原始草稿意思不变的前提下，把它润色成 3 条可以直接发送给对方的表达，${toneInstruction}。${LANGUAGE_INSTRUCTION}要求：
1. 3 条内容互不相同（措辞、句式、侧重点可以有变化），但都不能偏离原始草稿的意思；
2. 只输出润色后的结果本身，不要输出多余的解释、前后缀或编号；
3. 严格按下面的 JSON 格式输出，不要输出任何 JSON 之外的文字：
${POLISH_JSON_SCHEMA}`;
}
