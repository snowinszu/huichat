# 智能模式自动判断语气润色草稿

## Description
修改润色草稿的链路（[polishDraft.ts](../../electron/main/llm/polishDraft.ts)），使其在收到 Issue #027 定义的智能模式标识时，结合草稿内容与聊天卡片上下文自动判断最合适的语气再润色，而不是把标识值当作语气名称拼进 prompt。前端在智能模式选中时把该标识传给 `window.api.reply.polish`。

## Acceptance Criteria
- [x] 智能模式下点击"润色"，请求携带智能模式标识（而非具体语气文本）
- [x] 后端针对该标识，将润色 prompt 中的语气指令替换为"请结合草稿内容与对话上下文，自动判断最合适的语气"进行润色，不将标识字面值拼入 prompt
- [x] 润色结果的展示方式与手动选择语气时一致，不显示 AI 判断出的具体语气名称
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
Issue #027

## Type
fullstack

## Priority
medium

## Design Reference
无

## PRD Reference
`tasks/prd-smart-tone-mode.md` — US-004
