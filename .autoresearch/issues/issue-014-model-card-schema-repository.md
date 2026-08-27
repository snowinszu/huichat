# 模型卡片数据表 + Repository + IPC 基础

## Description
新增 `llm_model_card` 数据表与对应的 Repository/IPC 读取接口，作为多模型卡片功能的数据基础，替代旧的单行 `settings` 表成为 LLM 配置的存储来源。

## Acceptance Criteria
- [x] `schema.ts` 新增 `llm_model_card` 表：`id`、`name`（卡片名称）、`provider`、`api_key`、`model`、`base_url`（可空）、`is_current`（0/1）、`created_at`、`updated_at` — `electron/main/db/schema.ts`
- [x] 数据库层保证任意时刻至多一行 `is_current = 1`（写入"设为当前"时在同一事务内先清除旧的当前标记再设置新标记，避免出现 0 张或 2 张当前卡片的中间态）— `modelCardRepository.ts` 的 `setCurrentModelCard` 用 `db.transaction()` 包裹"清空旧标记 + 设置新标记"两条 UPDATE
- [x] 新增 `modelCardRepository.ts`（`electron/main/db/`），参照现有 `personaRepository`/`chatCardRepository` 的写法，提供 `list`、`create`、`update`、`delete`、`setCurrent`、`getCurrent` 方法 — 对应 `listModelCards`/`createModelCard`/`updateModelCard`/`deleteModelCard`/`setCurrentModelCard`/`getCurrentModelCard`（另加 `getModelCard` 单条查询，供后续 issue 复用）
- [x] 新增 IPC channel（`modelCard:list`、`modelCard:getCurrent`，其余 create/update/delete/setCurrent 由后续 issue 补充调用方，但本 issue 需在 `ipc-types.ts`/`register.ts` 中预留完整的 channel 常量与类型定义）— `ipc-types.ts` 新增全部 7 个 channel 常量与 `ModelCardRecord`/`CreateModelCardInput`/`UpdateModelCardInput` 类型；`register.ts` 仅实际 wire 了 `modelCardList`/`modelCardGetCurrent` 两个 handler
- [x] 旧 `settings` 表按 PRD 已确认的决定不做数据迁移，保留表结构但新代码不再读写它 — `schema.ts` 中 `settings` 表定义未改动，`settingsRepository.ts` 未改动，新表与其完全独立共存
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning

## Implementation Notes
- Scope kept strictly to the backend/db layer per the issue's own AC: `createModelCard` deliberately does **not** auto-set `isCurrent` on the first card — that business rule belongs to Issue #16 (US-003), which owns the create UI/flow. Likewise `deleteModelCard` is a plain unprotected delete; the "block deleting the current card" rule is Issue #16's job too. Keeping these out avoids the exact kind of scope creep the repo has been careful about elsewhere.
- `IPC_CHANNELS` now has all 7 `modelCard*` entries (list/get/getCurrent/create/update/delete/setCurrent) and `ipc-types.ts` has the full `ModelCardRecord`/`CreateModelCardInput`/`UpdateModelCardInput` shapes, but `register.ts` only calls `ipcMain.handle` for `list` and `getCurrent`. This was a deliberate reading of "预留完整的 channel 常量与类型定义, 其余...由后续 issue 补充调用方" — the *types and constants* are reserved now so #16/#17 never have to touch `ipc-types.ts` again, but the actual `ipcMain.handle(...)` registration (the "调用方") for create/update/delete/setCurrent is left for the issues that build the UI needing them, since wiring a handler with no caller is dead code.
- No preload (`electron/preload/index.ts`) or renderer changes in this issue — nothing in the UI calls these channels yet. Issue #15 (list UI) will add the `window.api.modelCard.list()`/`.getCurrent()` bridge methods it actually needs when it builds the settings screen.
- `setCurrentModelCard` throws if given a nonexistent id (checked via `result.changes === 0` inside the transaction) rather than silently clearing every card's current flag and leaving none set — verified this doesn't leave the table in a 0-current state on failure.
- Verified with a throwaway `tsx` script (same pattern as issues #4/#6/#13) against a real temporary SQLite file, run under Node 22.20.0 (this repo's `.nvmrc`) since better-sqlite3's native binding needs a real Node/Electron ABI match — 21/21 checks passed: empty-state reads, create-does-not-auto-current, list ordering, single-current invariant held across two consecutive switches, setCurrent-on-missing-id throws without disturbing the existing current flag, partial update leaves `is_current` untouched, delete removes the row without disturbing an unrelated current card, and the legacy `settings` table remains independently readable/writable. Script deleted after running, never entered the diff.
- Electron itself still can't launch a GUI in this sandbox (same limitation noted since #1), but that's irrelevant here — this issue has no UI surface to verify in a browser.

## Dependencies
None

## Type
backend

## Priority
high

## Design Reference
无专属设计稿（本 issue 为纯数据层），后续 UI 相关 issue 可参考 `UI design/settings.html`、`UI design/roles.html` 中卡片列表的视觉风格

## PRD Reference
`tasks/prd-multi-llm-model-cards.md` — US-001
