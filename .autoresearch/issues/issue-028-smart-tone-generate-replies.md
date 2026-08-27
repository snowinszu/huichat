# 智能模式自动判断语气生成候选回复

## Description
修改生成候选回复的链路（[generateReplies.ts](../../electron/main/llm/generateReplies.ts)），使其在收到 Issue #027 定义的智能模式标识时，不把标识值当作语气名称拼进 prompt，而是替换为"结合对话上下文自动判断最合适语气"的指令。前端在智能模式选中时把该标识传给 `window.api.reply.generate`。同时验证"重新生成"在智能模式下每次都独立重新判断语气（现有实现本就无状态、不缓存，此处主要是补充验证性用例）。

## Acceptance Criteria
- [x] 智能模式下点击"生成回复"，请求携带智能模式标识（而非具体语气文本）
- [x] 后端针对该标识，将生成 prompt 中的语气指令替换为"请结合对方信息/己方角色/最终目标/短期目标/历史消息，自动判断最合适的一种语气"，不将标识字面值拼入 prompt
- [x] 返回的 3 条候选回复内容不同，但语气保持统一（与现有手动选择语气时"同语气 3 条内容"的逻辑一致）
- [x] 候选回复的展示方式与手动选择语气时完全一致，**不显示** AI 判断出的具体语气名称
- [x] 智能模式下点击"重新生成"，使用相同上下文重新发起一次生成请求，验证后端不缓存/复用上一次判断出的语气（每次独立判断）
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
Issue #027

## Type
fullstack

## Priority
high

## Design Reference
无

## PRD Reference
`tasks/prd-smart-tone-mode.md` — US-002, US-003
