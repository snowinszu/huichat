# 聊天目标达成情况（AI 自动评估）

## Description
在统计页面新增一个区块，展示该聊天对象的长期/短期目标原文，并借助当前已配置的 LLM 自动评估目标达成情况，无需用户手动判断或标注。

## Acceptance Criteria
- [x] 统计页面展示该 chat_card 的 `long_term_goal`、`short_term_goal` 原文；两者均为空时，该区块显示"未设置目标"，不发起 AI 调用
- [x] 至少设置了一个目标时，页面打开后自动调用一次当前已配置的 LLM（复用 `electron/main/llm/generateReplies.ts` 中已有的当前模型/API Key 配置获取方式），结合目标文本与聊天记录，生成一个达成情况判断：分类结果（未达成 / 部分达成 / 已达成）+ 一句话理由
- [x] 新增对应 IPC 通道（如 `window.api.chatStats.evaluateGoal(chatCardId)`），在 `electron/main/ipc/register.ts` 注册并同步更新类型定义
- [x] 该结果不做数据库持久化，每次打开统计页都重新调用生成
- [x] AI 调用中显示 loading 状态；调用失败（如未配置 LLM、网络错误）显示明确的错误提示，不影响页面其余统计指标的展示
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g. via the `run` skill)

## Implementation Notes
- 新增 `electron/main/llm/evaluateGoal.ts`（`buildGoalEvaluationPrompt` + `parseGoalEvaluation`），复用 `promptContext.ts` 的 `buildContextSection`（同一个"对方信息/角色/目标/聊天记录"拼装块，`generateReplies.ts`/`polishDraft.ts` 也在用），解析逻辑与 `parseReplies` 一样走"提取第一个 `{...}` JSON 块"的容错策略
- `register.ts` 里的 handler 直接复用 `loadChatContext` 辅助函数（card/persona/messages/modelCard 一次性取齐），与 `replyGenerate`/`replyPolish` handler 是同一套装配方式
- "不发起 AI 调用"这一条在渲染端（`StatsScreen.tsx`）判断：目标文本 `card.longTermGoal`/`card.shortTermGoal` 都为空时直接跳过 `evaluateGoal` 调用；backend handler 本身不做这个判断（它假设调用方已经决定要评估）
- Loading 状态的触发被特意放进核心数据 fetch 的 `.then()` 回调里，而不是单独一个以 `card` 为依赖的 effect——后者会在 effect body 里同步调用 `setState`，触发 `react-hooks/set-state-in-effect` lint 报错；合并成一次 effect 后，AI 调用仍然独立于图表渲染（不阻塞已有数据的展示），只是触发时机挪到了同一个异步回调内
- 未做结果缓存/持久化：每次挂载 `StatsScreen`都会重新调用，符合"下一次打开统计页都重新生成"的要求
- 用 Mock LLM 响应（`{"verdict": "部分达成", "reason": "..."}`）在浏览器验证会话中确认了 loading → 结果展示的完整链路；未单独验证"未配置 LLM"报错路径的 UI 文案（`NO_CURRENT_MODEL_CARD_MESSAGE`），该错误信息透传逻辑与 #10（生成回复）共用同一个错误常量，行为已在那条链路验证过

## Dependencies
Issue #32

## Type
fullstack

## Priority
medium

## PRD Reference
tasks/prd-chat-stats.md — US-006, FR-15 ~ FR-17, FR-19
