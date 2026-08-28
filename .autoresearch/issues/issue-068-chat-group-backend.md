# 分组数据层与仓储

## Description
新增 `chat_group` 表和 `chat_card.group_id` 外键，配套仓储函数与 IPC/preload 桥接，为聊天对象分组功能打底。参见 [tasks/prd-chat-card-grouping.md](../../tasks/prd-chat-card-grouping.md) US-001、FR-1、FR-2。

## Acceptance Criteria
- [x] 新增 `chat_group` 表：`id INTEGER PRIMARY KEY AUTOINCREMENT`、`name TEXT NOT NULL`、`created_at INTEGER NOT NULL`、`updated_at INTEGER NOT NULL`（命名 `chat_group` 而非 `group`，避免 SQL 关键字冲突）
- [x] `chat_card` 表新增 `group_id INTEGER REFERENCES chat_group(id) ON DELETE SET NULL` 列，迁移写法参照 [migrations.ts](../../electron/main/db/migrations.ts) 现有的"加列+建索引"模式，并为 `group_id` 建索引（参照现有 `idx_chat_card_persona_id`）
- [x] 新增 `electron/main/db/groupRepository.ts`：`createGroup`、`listGroupsWithUsage`（含每个分组下聊天对象数量）、`renameGroup`（部分字段更新，写法对齐 `updatePersona`）、`deleteGroup`（允许删除有引用的分组，写法对齐 `deletePersona`）
- [x] `chatCardRepository.ts` 的 `CreateChatCardInput`/`UpdateChatCardInput`（[ipc-types.ts](../../electron/shared/ipc-types.ts)）新增 `groupId` 字段并在写入时生效
- [x] 新增 IPC channels：`chat-group:create`、`chat-group:list-with-usage`、`chat-group:rename`、`chat-group:delete`，在 [register.ts](../../electron/main/ipc/register.ts) 注册 handler
- [x] [preload/index.ts](../../electron/preload/index.ts) 暴露对应的 `window.api.chatGroup.*` 方法
- [x] Typecheck/lint 通过

## Dependencies
None

## Type
backend

## Priority
high
