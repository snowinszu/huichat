# 消息数据层（message 表 + 持久化/查询 API）

## Description
定义 message 表结构并提供读写 API，为聊天界面、图片标注、信息提取等功能提供统一的消息持久化能力；同时保证卡片信息编辑的即时持久化。

## Acceptance Criteria
- [x] 每条消息（对方/己方，不含未发送的候选回复）写入 SQLite，关联对应卡片 ID 与时间戳 — `electron/main/db/messageRepository.ts` 的 `insertMessage()`；`role` 列的 CHECK 约束只接受 `other`/`self`/`annotation`，候选回复在类型层面就无法写入
- [x] 提供按卡片 ID 查询历史消息（按时间排序）的 API — `listMessagesByChatCard()`，`ORDER BY created_at ASC, id ASC`（id 作为同毫秒时间戳的稳定排序 tiebreaker）
- [x] 卡片信息（资料/目标/角色关联）的编辑会立即持久化 — `electron/main/db/chatCardRepository.ts` 的 `updateChatCard()`：只写入 patch 中出现的字段，同步落盘且立即 bump `updated_at`，无草稿/防抖状态；`listChatCards()` 同样以 `updated_at DESC, id DESC` 排序保证同毫秒更新时的确定性顺序
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）

## Implementation Notes
- Also added a `chatCard` repository (create/get/list/update/delete) alongside `message`, since "编辑立即持久化" needs a read/update path and `message.chat_card_id` has a foreign key — a minimal card layer was unavoidable scope. Full card CRUD *UI* (avatar upload, forms) stays Issue #6's job; this only provides the data functions it (and #7 short-term-goal, #8 paste-translate, #12 auto-info-extraction) can call into.
- Added `ON DELETE CASCADE` to `message.chat_card_id` (schema.ts) so deleting a card removes its messages, matching the design copy "所有历史记录将一并删除"; verified via the cascade-delete check below.
- IPC surface: `electron/shared/ipc-types.ts` (channel names + payload/result types) → `electron/main/ipc/register.ts` (`ipcMain.handle`, registered after `initDatabase()`) → `electron/preload/index.ts` exposes `window.api.message.{insert,listByChatCard}` and `window.api.chatCard.{create,get,list,update,delete}` via `contextBridge`. `src/types/electron-api.d.ts` types `window.api` for renderer code. Future frontend issues should call `window.api.*` rather than adding new IPC channels for the same data.
- Verified with a standalone script (`tsx`) against a throwaway SQLite file — repository functions take `Database.Database` as an explicit parameter rather than reaching for a global singleton, so they're testable without booting Electron (this sandbox still can't open an Electron GUI window, per Issue #1/#2). 16 assertions covered: card create/read/update field-level persistence, immediate-visibility of updates, list ordering (incl. same-millisecond tiebreak — caught and fixed a real ordering bug this way), message insert for all three roles incl. translation/annotation fields, per-card scoping, oldest-first ordering, and cascade delete. Script deleted after the run; not part of the shipped app.

## Dependencies
Issue #1

## Type
backend

## Priority
high
