# 角色数据层支持文字风格字段

## Description
为 persona 新增 `style` 字段，配套迁移与仓储/类型支持，让文字风格可以像 `name`/`bio` 一样被创建、编辑、读回。参见 [tasks/prd-persona-writing-style.md](../../tasks/prd-persona-writing-style.md) US-001、FR-1。

## Acceptance Criteria
- [x] `persona` 表新增 `style TEXT NOT NULL DEFAULT ''` 列；沿用 [migrations.ts](../../electron/main/db/migrations.ts) 中"新增列"的既有迁移写法（参照 `migrateChatCardHistorySummaryColumns`），并在 [db/index.ts](../../electron/main/db/index.ts) 的 `initDatabase` 中调用，确保老用户升级后已有角色档案不会因缺列报错
- [x] `PersonaRecord`/`CreatePersonaInput`/`UpdatePersonaInput`（[ipc-types.ts](../../electron/shared/ipc-types.ts)）新增可选的 `style` 字段
- [x] `personaRepository.ts` 的 `createPersona`/`updatePersona`/`toRecord` 支持读写 `style`
- [x] Typecheck/lint 通过

## Dependencies
None

## Type
backend

## Priority
high
