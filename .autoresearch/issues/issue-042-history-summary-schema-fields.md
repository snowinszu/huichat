# chat_card 新增摘要相关字段（含迁移）

## Description
在 `chat_card` 表中新增两个字段：滚动摘要文本（`history_summary`）和"已摘要至哪条消息"的水位线（`summarized_through_message_id`），并为已有数据库提供迁移，避免出现"表已存在、缺列"报错。

来源：`tasks/prd-chat-history-summary.md` — US-001

## Acceptance Criteria
- [x] `chat_card` 表新增 `history_summary`（TEXT，默认空字符串）和 `summarized_through_message_id`（INTEGER，可为 NULL，默认 NULL）两列
- [x] 为已存在的数据库提供迁移（`ALTER TABLE ... ADD COLUMN`），确保历史安装的 app.db 升级后不会因为"表已存在、缺列"而报错（参考此前 `debug_prompt_export` 字段的同类迁移，逻辑放在 `electron/main/db/migrations.ts`）
- [x] `ChatCardRecord` 类型新增 `historySummary: string` 和 `summarizedThroughMessageId: number | null`
- [x] `chatCardRepository.ts` 的读写方法正确处理这两个新字段，其余现有字段行为不受影响
- [x] Typecheck/lint 通过

## Verification Notes
`schema.ts` 的 `chat_card` CREATE TABLE 新增两列；`migrations.ts` 新增 `migrateChatCardHistorySummaryColumns`，与此前 `migrateAppPreferenceDebugExportColumns` 同款模式（`PRAGMA table_info` 检查列是否存在，缺失则 `ALTER TABLE ADD COLUMN`），并在 `db/index.ts` 的 `initDatabase` 里于 baseline schema 执行前调用。`historySummary`/`summarizedThroughMessageId` 只加进了 `ChatCardRecord`（读）和 `UpdateChatCardInput`（写），没有加进 `CreateChatCardInput`——这两个字段是系统内部维护的滚动状态，新建卡片时永远是默认空值，不需要由调用方在创建时指定。`chatCardRepository.ts` 的 `updateChatCard` 本身是通用的按字段透传写入（不像 `app_preference` 那样需要布尔值转换），所以新增这两列不需要额外的类型转换逻辑。

验证分两层：①直接用内存 SQLite 跑 schema SQL 和迁移逻辑，确认全新安装能正确拿到默认值（`history_summary=''`, `summarized_through_message_id=NULL`），且模拟一个"缺列的老 chat_card 表、且已有真实数据"的场景，迁移后原有数据完整保留、新列可正常读写；②启动真实构建后的 Electron 应用，通过 `window.api.chatCard.create/update/get/list` 全链路验证：新建卡片默认值正确、`update` 能正确写入摘要文本和水位线、`get`/`list` 读回的值与写入一致。

## Dependencies
None

## Type
backend

## Priority
high
