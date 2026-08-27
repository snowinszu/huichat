# 设为当前模型 + 卡片测试连接

## Description
支持把任意一张非当前卡片切换为当前模型，以及对任意卡片（不论是否为当前模型）发起测试连接，验证其配置是否可用。

## Acceptance Criteria
- [x] 每张非当前卡片提供"设为当前模型"操作 — `SettingsScreen.tsx` 列表项 `!card.isCurrent` 时渲染"设为当前模型" `Button`
- [x] 点击后该卡片变为当前模型，原当前卡片的标记被取消，列表实时更新（通过 #14 的 `setCurrent` 方法，在单个数据库事务内完成新旧标记切换）— `handleSetCurrent` 调用新增的 `window.api.modelCard.setCurrent(id)`，`register.ts` 直接透传给 #14 已实现并测试过的 `setCurrentModelCard`（事务内清空旧标记+设置新标记），成功后 `refresh()` 拉取最新列表
- [x] 切换后无需重启应用，下一次 AI 调用即使用新的当前模型配置 — 无本地缓存/无需重启：`getCurrentModelCard` 每次都直接查库，切换后立即对下一次读取生效
- [x] 每张卡片提供"测试连接"操作，使用该卡片自身的 provider/API key/model 发起一次真实的一次性 LLM 调用（复用现有 `llm:test-connection` 的实现模式）— 每张卡片（含当前卡片）都渲染"测试连接" `Button`，`handleTestConnection` 直接复用已有的 `window.api.llm.testConnection()`（#4 就已实现的通用 `SaveSettingsInput`-shaped 调用，本身与"是否当前模型"无关，无需改动）
- [x] 测试连接成功/失败均以 toast 形式反馈，不要求该卡片是当前模型 — 成功/失败均 toast，文案带卡片名称区分是哪张卡片；测试对当前卡片同样可用（验证过）
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 见 Implementation Notes

## Implementation Notes
- Wired the last reserved channel from #14/#15/#16 — `modelCardSetCurrent` — as a one-line pass-through (`register.ts`) to the repository's `setCurrentModelCard`, which already had its transactional single-current invariant verified in #14's backend tests. No new backend logic needed here beyond the handler + preload bridge method, so this issue's own verification effort went entirely into the UI/integration layer instead of re-testing something #14 already covered.
- "测试连接" reuses the exact same `window.api.llm.testConnection()` bridge method and `llmTestConnection` IPC channel that's existed since #4 (the original single-config settings form) — it already took a bare `{provider, apiKey, model, baseUrl}` shape with no notion of "cards," so per-card testing needed zero backend changes, only a UI call site passing that specific card's fields instead of form state.
- Both new actions (`测试连接`, `设为当前模型`) use independent per-card loading state (`testingId`/`switchingId`) rather than a single shared "busy" flag, so testing one card's connection doesn't disable another card's buttons. Each button also disables *other* cards' buttons for the same action kind while one is in flight (`disabled={switchingId !== null && switchingId !== card.id}`) to avoid two concurrent switch/test requests racing.
- Actions row ordering settled on: 测试连接 → 设为当前模型 (if non-current) → 编辑 → 删除 (if non-current), left-to-right from least-destructive/most-frequently-used to most-destructive, consistent with the edit/delete ordering already established in #16.
- **Verified in a browser**: same `ELECTRON_STARTUP_PREVENT=1 npm run dev` + Playwright/headless-Chromium approach as #15/#16. `window.api.modelCard` was mocked with a stateful `setCurrent` (actually flips `isCurrent` across the in-memory array, mirroring the real transactional swap) and `window.api.llm.testConnection` was mocked to succeed for every card except the Anthropic one (simulating a bad key), so both the success and failure toast paths were exercised for real, not just the happy path. 9/9 checks passed: initially exactly one "设为当前模型" button exists (on the non-current card) and both cards show "测试连接"; clicking "设为当前模型" on the Anthropic card flips the badge to it, shows a toast naming the card, and the button set re-renders (OpenAI now shows "设为当前模型", Anthropic no longer does); testing the now-non-current OpenAI card's connection succeeds with a card-named toast; testing the now-current Anthropic card's connection still works (proving test-connection isn't gated on current-model status) and surfaces its simulated failure message verbatim in the error toast. Screenshots confirm the before/after action-button layout and the visible failure toast. Zero console errors throughout. Driver script deleted after running, never entered the diff.

## Dependencies
Issue #14, Issue #15

## Type
fullstack

## Priority
medium

## Design Reference
无专属设计稿，"测试连接"交互参考 `UI design/settings.html` 现有的测试连接按钮与 toast 反馈样式

## PRD Reference
`tasks/prd-multi-llm-model-cards.md` — US-006, US-007
