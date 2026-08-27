# 通用设置偏好数据层 + 设置页开关骨架

## Description
新增独立的偏好设置数据表与读写接口，并在（#20 腾出的）设置页展示开关列表骨架，为后续每个开关的具体行为接入提供统一的持久化基础。

## Acceptance Criteria
- [x] 新增单行偏好设置表（结构类似现有 `settings` 单行表，但与已废弃不用的旧 LLM 配置表完全独立，不复用其列），字段覆盖：翻译非中文消息、生成时自动添加到历史、自动信息提取、深色模式（均为布尔值）— `schema.ts` 新增 `app_preference` 表（`translate_non_chinese`/`auto_add_to_history`/`auto_extract_info`/`dark_mode`），并用 `INSERT OR IGNORE` 在 schema 应用时就播种默认值行（id=1），保证 repository 读取时永远有数据，不需要处理"尚未创建"的情况
- [x] 设置页展示开关列表（复用 `UI design/settings.html` 的 `.toggle-row` 视觉样式：标题 14px + 说明 12px 灰色 + 42×24 胶囊开关），四个开关的标题/说明文案齐全 — 新增可复用的 `Toggle` UI 组件（`src/components/ui/Toggle/`，1:1 复刻设计稿的胶囊开关像素值），`SettingsScreen.tsx` 用它渲染四行开关，标题+说明文案齐全
- [x] 切换任一开关立即持久化到数据库，无需额外"保存"按钮 — 点击开关立即调用 `window.api.appPreference.update({ [key]: checked })`，无保存按钮；乐观更新 UI，失败时回滚并 toast 报错
- [x] 应用重启后开关状态保持切换前的值 — 验证过：更新→关闭连接→用同一 SQLite 文件重新打开→读到的值与关闭前一致
- [x] 本 issue 只负责骨架与持久化，开关尚未真正影响对应功能行为属正常（由 #22-#25 分别接入）— 确认无误，本 issue 未改动 `messageTranslate`/`extractAndSaveInfo`/reply 相关任何业务逻辑
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 见 Implementation Notes

## Implementation Notes
- Chose "seed a default row via `INSERT OR IGNORE` in `schema.ts`" over the `settings`-table pattern of "no row until the user explicitly saves." Reasoning: preference toggles need a sensible default state the very first time a user opens Settings (they didn't "set up" preferences the way they set up an LLM config), so `getAppPreference()` returns `AppPreferenceRecord` directly (never `AppPreferenceRecord | undefined`) — every consumer (this issue's UI, and #22–#25's business logic) gets to skip the "what if preferences don't exist yet" branch entirely.
- New reusable `Toggle` component (`src/components/ui/Toggle/`) added to the shared UI library rather than inlined in `SettingsScreen.tsx` — matches this repo's established one-folder-per-primitive convention (`Button/`, `IconButton/`, `Select/`, …), and a toggle switch is generic enough to plausibly get a second consumer later. Built with real `role="switch"`/`aria-checked` semantics and an explicit `aria-label` (since the visible label text is a sibling `<div>`, not inside the `<button>` or wired via `aria-labelledby`, so the button would otherwise have no accessible name).
- `SettingsScreen.tsx` updates optimistically (flips the toggle immediately, before the IPC round-trip resolves) and rolls back + toasts on failure — same pattern already used for other instant-persist UI in this app (e.g. `ChatScreen`'s short-term-goal field), rather than waiting on the round-trip before showing the new state.
- Verified the repository layer with a throwaway `tsx` script against a real SQLite file (same pattern as every prior issue in this feature): defaults seeded correctly on a fresh database, a partial update touches only the specified field and leaves the rest alone, a multi-field update in one call works, re-running `SCHEMA_SQL` (which happens on every real app launch) never resets already-changed values (the whole point of `INSERT OR IGNORE`), and — closing the connection and reopening the same file to simulate a real restart — all four fields and their toggled values survive intact. 18/18 checks passed.
- **Verified in a browser**: same `ELECTRON_STARTUP_PREVENT=1 npm run dev` + Playwright/headless-Chromium approach as prior issues. `window.api.appPreference` was mocked backed by `localStorage` rather than a plain JS closure variable — closure state resets on every `page.reload()` because Playwright's `addInitScript` re-runs on each navigation, which would have made a "survives reload" check pass or fail for the wrong reason (test-harness artifact, not real persistence) with a naive mock; `localStorage` genuinely persists across reloads within the page origin, so this dry run is a meaningful proxy for what real SQLite persistence proves. 9/9 checks passed: all four toggles render at their correct documented defaults; clicking one flips only that one (others provably untouched); and — after a full page reload re-fetching from the mocked bridge — the toggled states were still there. Screenshots confirm the `.toggle-row` styling matches the design mockup pixel values (42×24 pill, sliding knob) in both the all-default and post-toggle states. Zero console errors. Driver script deleted after running, never entered the diff.
- Also reran `npm run build` (clean) given the number of new files touching the schema/IPC/preload chain.

## Dependencies
Issue #20

## Type
fullstack

## Priority
high

## Design Reference
`UI design/settings.html` 的"通用"区块（`.toggle-row`/`.toggle` 样式），仅取用其中"翻译非中文消息""生成时自动添加到历史"两项文案，另两项（自动信息提取、深色模式）为新增，需按同样视觉风格补充文案

## PRD Reference
`tasks/prd-general-settings-and-model-page.md` — US-002
