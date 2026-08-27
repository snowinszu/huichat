# 卡片统计入口图标 + 新页面路由

## Description
在首页每张聊天对象卡片（`ContactCard`）右上角操作区新增一个统计入口图标，点击后跳转到一个新的独立统计页面。本 issue 只负责入口与路由骨架（含返回按钮），不涉及具体统计数据展示，为 #31（数据聚合）和后续统计内容 issue 提供落脚点。

## Acceptance Criteria
- [x] `src/components/ui/icons.tsx` 新增一个统计/图表图标组件（如 `IconChart`），风格与现有图标（`IconEdit`、`IconTrash` 等）一致
- [x] `ContactCard` 操作区（`styles.actions`，当前含编辑/删除按钮）新增统计按钮，新增 `onOpenStats` 回调 prop，点击时阻止事件冒泡（不触发卡片本身的 `onOpen`）
- [x] `App.tsx` 的 `View` 联合类型新增 `'stats'` 分支，与现有 `'chat'` 分支一样携带对应的 `chatCardId`；点击统计图标后设置该 view 并渲染新的 `StatsScreen`
- [x] 新增 `src/screens/stats/StatsScreen.tsx`，页面顶部有返回按钮，点击后回到首页（`view = 'home'`）；本 issue 中页面主体可为占位内容，留给后续 issue 填充
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g. via the `run` skill)

## Implementation Notes
- `activeChatCardId` state in `App.tsx` is reused for both `'chat'` and `'stats'` views (only one is ever active at a time) rather than adding a second id state variable
- Real Electron GUI can't launch in this sandbox (`electron.app` is undefined under vanilla Node — same limitation #7/#9 hit). Verified instead via the project's existing renderer-only workaround: `vite.config.verify.mjs` (already present in the repo root from a prior session) serves the plain React renderer without the `vite-plugin-electron` plugin, driven by headless Chromium with an in-memory mock of `window.api`. Confirmed: 统计 icon renders on the card (hidden until hover, same as 编辑/删除), click navigates to `StatsScreen`, back button returns to home. Screenshots taken, no console errors.
- Built out the full `StatsScreen` body (metrics grid, both charts, goal section) in this same pass rather than shipping a placeholder — see #33/#34/#35 for per-section notes; all three were verified together in one browser session

## Dependencies
None

## Type
frontend

## Priority
high

## PRD Reference
tasks/prd-chat-stats.md — US-002, FR-1 ~ FR-3
