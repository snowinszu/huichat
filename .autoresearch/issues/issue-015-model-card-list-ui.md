# 设置页展示模型卡片列表

## Description
把设置页原有的单一 LLM 配置表单，改造为模型卡片列表展示：每张卡片显示名称、provider、API Key 掩码预览、model，当前模型有明显徽章标记，无卡片时显示空状态引导。

## Acceptance Criteria
- [x] 设置页原有的单一配置表单替换为卡片列表，通过 #14 的 `modelCard:list` IPC 读取数据 — `SettingsScreen.tsx` 改为在挂载时调用 `window.api.modelCard.list()`（新增的 preload 桥接方法），原有 provider/API Key/model 表单与 `settings.get/save`/`llm.testConnection` 调用全部移除
- [x] 每张卡片显示：卡片名称、provider 名称、API Key 掩码预览（如 `sk-...abcd`）、model 名称 — 复用 `RolesScreen` 的列表项样式（头像圆点 + 主体 + meta 行）；新增 `providerMeta.ts` 的 `maskApiKey()` 辅助函数生成 `sk-1···cdef` 形式的预览
- [x] 当前模型的卡片有明显的"当前"徽章标记 — `card.isCurrent` 为真时在名称旁渲染 `.currentBadge`（复用 `RolesScreen` 的 usageBadge 徽章视觉）
- [x] 没有任何模型卡片时显示空状态提示，并引导点击"新建模型卡片"（按钮本身可先占位，实际创建逻辑由 #16 实现）— 空状态图标/标题/说明 + 按钮，点击触发 toast「创建模型卡片功能即将上线」而非静默无反应或崩溃
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 见 Implementation Notes

## Implementation Notes
- Scope kept to display-only per this issue's AC: the list renders `id`/`name`/`provider`/`model`/masked `apiKey`/`isCurrent` for every card, but has **no** edit/delete/set-current/test-connection actions yet — those belong to #16 and #17. The "新建模型卡片" button (both in the header and the empty state) is a deliberate placeholder that shows an honest toast ("创建模型卡片功能即将上线") rather than silently doing nothing or wiring a fake navigation target — same pattern this repo used for `HomePlaceholder` back in #4/#6.
- Added exactly one preload bridge method — `window.api.modelCard.list()` — in `electron/preload/index.ts`. Did not add `getCurrent` even though #14 already wired its IPC handler: this screen doesn't need it (the `list` result already carries `isCurrent` per card), and the "only expose what's actually consumed" rule from #14's notes still applies. Whichever future issue needs a standalone `getCurrent` bridge can add it then.
- `providerMeta.ts` gained a `maskApiKey()` helper (`sk-1···cdef` — first 4 + last 4 chars, `••••` for anything ≤8 chars) since the existing `PasswordInput` component only masks live input, not a read-only preview string.
- Reused `avatarGradient(card.id)` (same deterministic per-id gradient already used for personas/chat cards) for the circular initial avatar, and copied `RolesScreen`'s list-item/empty-state CSS structure into `SettingsScreen.module.css` so the two "manage a collection of cards" screens (roles, model cards) look like the same design system rather than two different ones.
- **Verified in a browser**: Electron still can't launch a real GUI window in this sandbox (documented since #1) — `ELECTRON_STARTUP_PREVENT=1 npm run dev` (a `vite-plugin-electron` env var that skips the auto-launched Electron subprocess, discovered while investigating why plain `npm run dev` was crashing the whole dev-server process here) leaves just the pure Vite renderer serving on :5173, driven with Playwright + headless Chromium (Node 22.20.0 via nvm, matching `.nvmrc` — Vite 8 requires Node ≥20.19/22.12, this sandbox's default `node` is 20.18). A throwaway driver script mocked `window.api.modelCard.list()`, navigated home → settings (`aria-label="设置"`), and screenshotted both states: **empty state** (icon + "还没有模型卡片" + working placeholder button whose click was confirmed via `waitForSelector` to raise the expected toast) and **populated state** (3 fake cards across openai/anthropic/custom providers — each showed its name, `provider · model` line, and masked key `sk-1···cdef`-style preview; exactly one `.currentBadge` element rendered, on the card with `isCurrent: true`; raw API keys never appeared in the DOM text). Zero console errors in either scenario. Script deleted after running, never entered the diff.

## Dependencies
Issue #14

## Type
frontend

## Priority
high

## Design Reference
无专属设计稿，参考 `UI design/settings.html` 的整体页面结构与 `UI design/roles.html` 中角色列表的卡片式布局

## PRD Reference
`tasks/prd-multi-llm-model-cards.md` — US-002
