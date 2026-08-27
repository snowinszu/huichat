# 设置本次聊天的短期目标

## Description
在聊天界面内直接编辑当前卡片的短期目标，与长期目标区分，即时生效。

## Acceptance Criteria
- [x] 聊天界面内可直接编辑该卡片的"短期目标"字段（不必回到卡片编辑表单）— 新建 `src/screens/chat/ChatScreen.tsx`（`UI design/chat.html` 顶部条的第一块，本 issue 依赖里没有 #8，只落地 topbar + 目标标签，消息区留占位交给 #8/#10 续建），顶部条右侧「今天」标签是原生 `<input>`，预填 `card.shortTermGoal`，直接在聊天页内编辑，不跳回 `HomeScreen` 的卡片编辑 `Modal`。首页 `ContactCard` 新增 `onOpen`（此前 #6 特意留空），`App.tsx` 加一个 `'chat'` view 分支完成路由
- [x] 短期目标随卡片持久化，并在后续生成回复时作为上下文传给 AI — 复用 #6/#3 已有的 `chatCard.update` IPC（`electron/main/db/chatCardRepository.ts` 早已支持 `shortTermGoal` 列，本 issue 未改动主进程/schema），写入即落 SQLite；"作为上下文传给 AI" 的消费端在 #10（生成回复）实现，本 issue 保证的是数据落库这一半
- [x] 修改短期目标后无需重启应用，下一次生成即生效 — 保存走 `window.api.chatCard.update`，成功后用返回值刷新本地 `card`/`shortTermGoal` state，同一次应用运行内立即可读到新值，无需重启；未额外做写后缓存，下一次读（如 #10 生成前查询）天然拿到最新行
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — Electron 沙箱限制与 #6 相同（`electron.app` 在纯 Node 下是 undefined），改用不含 `vite-plugin-electron` 插件的临时渲染层配置 + headless Chromium（Playwright）+ 内存 mock 的 `window.api.chatCard` 驱动：首页点击卡片进入聊天页、长期目标标签只读展示、短期目标输入框预填旧值、编辑后回车持久化到 mock store、返回首页再重新打开同一张卡片确认新值仍在，全程截图确认且控制台无报错

## Implementation Notes
- Scope boundary vs. #8/#10: `ChatScreen` currently renders only the topbar (back button, avatar, name, long-term-goal tag, short-term-goal input) plus a single-line placeholder where the message history will go. This isn't a stand-in for a missing feature — it's the deliberate seam #6's notes called out ("assembled piecemeal by #7/#8/#10"). #7 doesn't depend on #3 (message layer) in the issue graph, so it intentionally never touches `window.api.message`; #8 (which does depend on #3) is expected to replace the placeholder `<main>` body with real history/paste/translate UI in the same file.
- Long-term goal is deliberately **not** editable from this screen — the design mockup's tooltip ("点击编辑长期目标") suggests click-to-edit, but the AC only asks for short-term goal to skip the card-edit form; long-term goal editing already works via the existing `HomeScreen` edit modal from #6, so adding a second edit path here would be scope creep without a corresponding AC.
- Short-term goal saves on blur/Enter (not per-keystroke) — matches the "宽松" input feel of the design's `goal-tag-input`, and avoids firing an IPC round-trip on every character while still meeting "无需重启，下一次生成即生效" (persisted well before any generate action would read it).
- Verification note: this session's Electron main process still cannot launch a GUI in this sandbox (`electron.app` is undefined under vanilla Node — same root cause #6 hit), so `npm run dev` itself was not usable for interactive verification. Used a scoped temporary Vite config (react plugin only, no `vite-plugin-electron`) purely to serve the renderer for the Playwright check; the file was deleted immediately after and is not part of the shipped diff.

## Dependencies
Issue #6

## Type
frontend

## Priority
medium

## Design Reference
`UI design/chat.html`
