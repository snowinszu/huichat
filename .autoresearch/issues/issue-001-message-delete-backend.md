# 消息删除后端能力（IPC + 数据库）

## Description
新增 `message:delete` IPC 通道，在 `electron/main/db/messageRepository.ts` 中实现物理删除方法，并在主进程注册 handler、preload 层暴露给渲染进程，为消息删除功能提供底层能力。

来源：`tasks/prd-message-delete.md` — US-001

## Acceptance Criteria
- [x] `electron/shared/ipc-types.ts` 的 `IPC_CHANNELS` 新增 `messageDelete: 'message:delete'`
- [x] `electron/main/db/messageRepository.ts` 新增 `deleteMessage(db, messageId: number): void`，执行 `DELETE FROM message WHERE id = ?`
- [x] `electron/main/ipc/register.ts` 注册 `ipcMain.handle(IPC_CHANNELS.messageDelete, ...)`，接收 `messageId: number`，调用仓储方法
- [x] preload 层暴露 `window.api.message.delete(messageId: number): Promise<void>`，与现有 `message.insert` / `message.listByChatCard` 风格一致
- [x] 删除一个不存在的 `messageId` 时不抛出异常，静默视为已删除（幂等）
- [x] Typecheck/lint 通过

## Dependencies
None

## Type
backend

## Priority
high
