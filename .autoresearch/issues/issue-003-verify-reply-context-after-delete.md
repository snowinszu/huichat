# 验证删除消息后 AI 生成回复上下文正确排除已删除消息

## Description
确认删除某条历史消息后，再次调用 `window.api.reply.generate` / `window.api.reply.polish` 时，AI 生成上下文来源于删除后最新的 `message` 表数据，不会再参考已删除的记录；并确认删空"对方消息"后不会导致生成报错。

来源：`tasks/prd-message-delete.md` — US-004

## Acceptance Criteria
- [x] 删除消息后，`reply.generate` / `reply.polish` 的对话上下文来源于删除后最新的 `message` 表数据，不包含已删除的记录
- [x] 删除最新一条"对方消息"后，再次生成回复时不会报错，而是基于剩余最新的消息继续工作；若删空后没有任何"对方消息"，沿用现有的空历史处理逻辑，不新增特殊报错
- [x] Typecheck/lint 通过

## Verification Notes
`register.ts` 的 `loadChatContext` 在每次 `reply.generate` / `reply.polish` 调用时都会重新执行 `listMessagesByChatCard(db, chatCardId)`，直接查询数据库最新状态，不存在任何消息历史缓存层——因此删除消息后自然生效，无需改动生成逻辑本身。`promptContext.ts` 的 `buildContextSection` 已对空历史做了兜底（`messages.length > 0 ? ... : '（暂无历史消息）'`），删空后不会抛错。

通过一个真实端到端场景验证（Electron + IPC + SQLite + mock LLM server，检查实际发给 LLM 的 prompt 文本）：
1. 添加两条"对方消息"（保留消息 + 待删消息）
2. 删除待删消息，点击"生成回复"，断言实际 prompt 包含保留消息、不包含已删除消息
3. 再删除剩余消息（历史清空），再次点击"生成回复"，断言不报错且 prompt 中出现"（暂无历史消息）"占位文本
全部断言通过。

## Dependencies
Issue #1（消息删除后端能力）、Issue #2（消息删除 UI）

## Type
fullstack

## Priority
medium
