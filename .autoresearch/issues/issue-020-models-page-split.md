# 模型卡片管理迁移到独立页面

## Description
把模型卡片管理（列表/创建/编辑/删除/设为当前模型/测试连接）从"设置页"整体搬到一个独立页面，首页新增单独入口进入，"设置"这个词回归它本来的含义，为后续通用设置开关腾出这个入口。

## Acceptance Criteria
- [x] 首页顶栏新增一个独立入口图标（与"我的角色""设置"并列），点击进入模型卡片页面 — `HomeScreen.tsx` 新增"模型"`IconButton`（复用原模型空状态的芯片图标），位于"我的角色"与"设置"之间
- [x] 模型卡片页面承载现有全部能力：列表展示、创建、编辑、删除（含删除当前模型保护）、设为当前模型、测试连接——功能与现状完全一致，仅是从"设置"路由搬到独立路由 — 原 `SettingsScreen.tsx`/`.module.css`/`providerMeta.ts` 原样搬到 `src/screens/models/ModelsScreen.tsx`/`.module.css`/`providerMeta.ts`（组件更名 `ModelsScreen`，逻辑零改动）
- [x] 原"设置"入口不再显示任何模型卡片相关内容（可暂时留空/占位，真正的通用设置内容由后续 issue 填充）— `SettingsScreen.tsx` 改为诚实的"开发中"占位（同 #4/#6 的 `HomePlaceholder` 先例），不展示任何模型卡片 UI 或读取
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 见 Implementation Notes

## Implementation Notes
- **Fixed a regression this move itself would have caused**: #18's "no current model card" guidance in `ChatScreen.tsx` sent the user to `onNavigateToSettings` (the settings page) — which, after this move, no longer has any model content. Renamed the prop to `onNavigateToModels`, changed the button label from "去设置页" to "去模型页", and updated the shared `NO_CURRENT_MODEL_CARD_MESSAGE` constant (`electron/shared/errors.ts`) from "请先在设置页创建并选择模型" to "请先在模型页创建并选择模型" so main and renderer stay in sync on the new wording. Not doing this would have shipped a "go here" button that leads to a dead end.
- **Fixed both existing E2E specs that navigated via the "设置" icon to reach model management**: `full-flow.spec.ts` (#13) and `model-cards.spec.ts` (#19) both used `getByLabel('设置').click()` as their way into model-card creation/management — both now click `getByLabel('模型')` instead, and `model-cards.spec.ts`'s assertions on the old error message/button text were updated to match. Same reasoning as the #16→full-flow.spec.ts fix from #19: shipping this move without fixing the specs that depend on the old navigation would have broken working tests.
- Moved `providerMeta.ts` alongside `ModelsScreen.tsx` into the new `src/screens/models/` folder rather than leaving it under `src/screens/settings/` — it's provider/model catalog logic that conceptually belongs with model management, not with general settings, and nothing else imported it (confirmed via grep before moving).
- The new "模型" icon reuses the exact chip/circuit SVG that was already the models-empty-state icon (`rect` + inner `path` + tick marks) rather than introducing a new icon design — same visual language, no new icon needed.
- The vacated `SettingsScreen.tsx` is an honest placeholder ("设置项开发中" + a note that model config moved to the 模型 page), not a half-built toggle list — same pattern this repo used for `HomePlaceholder` in #4/#6 while waiting on a later issue to fill in the real content (#21 here).
- **Verified in a browser**: same `ELECTRON_STARTUP_PREVENT=1 npm run dev` + Playwright/headless-Chromium approach as #15–#18 (Electron still can't launch a real GUI window in this sandbox — confirmed unchanged by re-running `npx playwright test`, which hit the identical "Process failed to launch!" wall for both E2E specs before and after this issue's changes, proving no new regression). 9/9 browser checks passed: all three home titlebar icons present; clicking "模型" reaches the (unchanged) model-card empty state; clicking "设置" shows the placeholder with zero model-card content; the chat screen's no-model error now reads "请先在模型页创建并选择模型" with a "去模型页" button (not "去设置页"), and clicking it actually lands on the models page. Screenshots confirm all three states visually. Zero console errors. Driver script deleted after running, never entered the diff.
- Also reran `npm run build` (clean) as an extra check given the scope of files moved/renamed in this issue.

## Dependencies
None

## Type
frontend

## Priority
high

## Design Reference
无专属设计稿，沿用现有 `SettingsScreen`（issue #14-#17 已实现的模型卡片 UI）原样迁移

## PRD Reference
`tasks/prd-general-settings-and-model-page.md` — US-001
