# 后端支持"回退到此消息"

## Description
新增仓储方法，删除某条消息之后（保留该消息本身）的所有消息，并配套 IPC/preload 桥接。参见 [tasks/prd-message-revert.md](../../tasks/prd-message-revert.md) US-001、FR-1、FR-2。

## Acceptance Criteria
- [x] 新增 `revertToMessage(db, messageId): number`（[messageRepository.ts](../../electron/main/db/messageRepository.ts)），删除同一 `chat_card_id` 下 `(created_at, id)` 严格大于目标消息 `(created_at, id)` 的所有消息，返回实际删除条数
- [x] 目标消息本身不会被删除
- [x] 目标消息 id 不存在时返回 `0`，不抛错（与 `deleteMessage` 的幂等约定一致）
- [x] 新增 IPC channel `message:revert`，在 [register.ts](../../electron/main/ipc/register.ts) 注册 handler
- [x] [preload/index.ts](../../electron/preload/index.ts) 暴露 `window.api.message.revert(id): Promise<number>`
- [x] Typecheck/lint 通过

## Dependencies
None

## Type
backend

## Priority
high
