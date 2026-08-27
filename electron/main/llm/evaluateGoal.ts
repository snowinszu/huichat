import type { ChatCardRecord, GoalEvaluationResult, MessageRecord, PersonaRecord } from '../../shared/ipc-types.js';
import { buildContextSection } from './promptContext.js';

interface BuildGoalEvaluationPromptInput {
  card: ChatCardRecord;
  persona: PersonaRecord | undefined;
  messages: MessageRecord[];
  debugMode?: boolean;
}

export function buildGoalEvaluationPrompt({ card, persona, messages, debugMode }: BuildGoalEvaluationPromptInput): string {
  return `你是一个关系顾问，需要根据下面的聊天记录，评估用户（下文中的"我"）与聊天对象之间设定的目标是否已经达成。

${buildContextSection({ card, persona, messages, debugMode })}

【任务】
请评估"聊天最终目标"和"本次短期目标"的达成情况，结合聊天记录里的实际进展给出判断。严格按下面的 JSON 格式输出，不要输出任何 JSON 之外的文字：
{"verdict": "未达成 | 部分达成 | 已达成", "reason": "一句话理由"}`;
}

const VALID_VERDICTS: GoalEvaluationResult['verdict'][] = ['未达成', '部分达成', '已达成'];

/**
 * Same tolerant-parse shape as parseReplies: pull the first {...} block out
 * of the response (models sometimes wrap strict JSON in prose or a code
 * fence) rather than requiring the whole response to be valid JSON.
 */
export function parseGoalEvaluation(responseText: string): GoalEvaluationResult {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { verdict?: unknown; reason?: unknown };
      const verdict = typeof parsed.verdict === 'string' ? parsed.verdict.trim() : '';
      const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';
      if (VALID_VERDICTS.includes(verdict as GoalEvaluationResult['verdict']) && reason) {
        return { verdict: verdict as GoalEvaluationResult['verdict'], reason };
      }
    } catch {
      // Fall through to the error below.
    }
  }
  throw new Error('AI 未返回有效的目标评估结果');
}
