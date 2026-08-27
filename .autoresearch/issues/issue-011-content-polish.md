# 己方内容润色

## Description
用户输入自己想表达的草稿，AI 结合上下文润色，保留原意的同时改善措辞。

## Acceptance Criteria
- [x] 界面提供与"生成回复"区分开的输入框（如"我想表达…"），接受自由文本 — `src/screens/chat/ChatScreen.tsx` 底部保留独立的 `.polishRow`（`UI design/chat.html` 的 `.polish-row`），单行文本 `<input>`，标签文案按用户要求从"我想表达…"改为"帮我润色"；提交动作后来合并进了"生成回复"按钮（见下方 Implementation Notes 的第三次修订），但输入框本身在位置和视觉上仍与语气选择/候选卡片区分开、互不影响
- [x] "润色"操作将草稿 + 上下文（语气、卡片信息）发给 LLM，返回润色后的版本 — 新增 IPC `reply:polish`（`ipc-types.ts` + `preload/index.ts` + `register.ts`）。为避免和 #10 的 `buildReplyPrompt` 重复拼"对方信息/角色设定/目标/聊天记录"这一整块上下文，抽出共用的 `electron/main/llm/promptContext.ts::buildContextSection`，`generateReplies.ts` 和新增的 `electron/main/llm/polishDraft.ts::buildPolishPrompt` 都基于它构建 prompt；语气沿用聊天页里已有的 `selectedTone`（#10 加的语气选择器），且现在和"生成回复"一样是硬性前置条件；主进程复用已有的 `callLlm`
- [x] 润色结果可复制，也可作为"己方"消息加入对话线程 — 润色的产出复用 #10 已有的候选回复展示区（同一个 `genState`/`replies`/`replyArea`，用户反馈"润色结果应该出现在候选回复那里"后从最初的独立 `.polishedResult` 卡片重构为共享同一 UI），现在和"生成回复"一样返回 3 条候选（`.replyCards` 的 grid 列数按 `replies.length` 动态算）；`ReplyCard` 组件因此新增 `onAdd`/`adding` 属性，在"复制"按钮旁加了"加入对话"，两个入口共用同一份 `message.insert`（`role: 'self'`）写入逻辑，无论卡片来自"生成回复"还是"润色"都能直接发给对方
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — 沙箱限制同 #6/#7/#8/#9/#10，复用同一套"不含 `vite-plugin-electron` 的临时渲染层配置 + headless Chromium（Playwright，含剪贴板权限）+ 内存 mock `window.api`"验证路径：标签文案已改为"帮我润色"、独立的"润色"按钮和"重新生成"链接均已不存在、选定语气后"帮我润色"框留空时点击"生成回复"走生成候选流程、框内填了草稿后点击同一个"生成回复"按钮改走润色流程（mock 记录了 `tone`/`draft` 都正确）且成功后输入框清空、润色结果以 3 张候选卡形式出现在候选回复区、再次点击"生成回复"（此时框已空）等效于重新生成一批新的候选、复制写入系统剪贴板并显示"已复制"、点击"加入对话"后该文本以己方消息形式出现在对话线程里、失败时错误条+重试按钮出现（重试直接复用"生成回复"同一套逻辑）且草稿保留未丢失，全程截图确认且控制台无报错

## Implementation Notes
- Extracted `buildContextSection` (`electron/main/llm/promptContext.ts`) out of what was `generateReplies.ts`'s private `formatMessage`/context-block logic — #10 and this issue build near-identical context blocks (card info + persona + goals + history) with only the trailing task instruction differing, so sharing it avoids two copies drifting apart as the schema/context needs evolve.
- `register.ts` also gained a small `loadChatContext(db, chatCardId)` helper wrapping the "fetch card → persona → history → settings, throw if card missing / settings unconfigured" sequence that both `reply:generate` and `reply:polish` need verbatim.
- Deliberately diverged from `chat.html`'s demo `polish()` JS (which clears the input immediately on click, before any AI response) — clearing only on success means a failed polish doesn't silently discard what the user typed.
- **Revised five times after initial implementation.** First revision: originally shipped with a standalone `.polishedResult` card below the polish input and tone context optional for polish. User feedback asked for the polish output to land in the same "候选回复" area as generated candidates (also tone-gated) and for an "加入对话" button next to copy — so `genState`/`genError`/`replies` became shared state for both flows (`replySource: 'generate' | 'polish'` tracks which one produced the current cards), `selectedTone` became a hard requirement for polish too, and `ReplyCard` gained `onAdd`/`adding` used by every card. The old `.polishedResult`/`.copyBtn` CSS was removed as dead code.
- Second revision: user then asked for polish to also return 3 candidates (not 1) with "重新生成" support. `buildPolishPrompt` was rewritten from a single free-text instruction to the same JSON-array contract `buildReplyPrompt` uses, and `reply:polish`'s return type changed from `string` to `string[]` (parsed with the existing `parseReplies`, `PolishDraftInput.tone` tightened from `string | null` to `string` since it's unconditionally required now). Added a `lastPolishDraft` state so regenerate could reuse the original draft after the input cleared.
- Third revision: user asked to drop the separate "润色" button and its trigger entirely — relabel the input to "帮我润色" and let the existing "生成回复" button do double duty: if the box has text, treat it as a polish request; if empty, generate candidates from scratch as before. Added `handleGenerateOrPolish()` (checks `polishDraft.trim()`, calls `handlePolish()` or `handleGenerate()`) and wired both the main button's `onClick` and the polish input's Enter key to it. The `Button`/`onClick`/loading state on the input row were removed along with the now-unused `.polishBtn` CSS class.
- Fourth revision: user pointed out the "重新生成" link duplicated what "生成回复" already does — clicking it again re-reads the current tone/draft and produces a fresh batch either way. Removed the regen link (`.regenBtn` CSS, the `IconRefresh` import) and the `lastPolishDraft` state it depended on (no longer needed once nothing has to "remember" a cleared draft — a failed attempt still leaves the draft in the box for `handleGenerateOrPolish` to reuse on retry). The error card's "重试" button now calls `handleGenerateOrPolish` directly instead of a separate `handleRetry`/`handleRegeneratePolish` pair.
- Fifth revision: pure layout change — moved the "生成回复" `Button` from its own row (paired with `.replyArea` in `.genRow`) into `.toneRow`, as the last flex child after the tone chips, with `margin-left: auto` on `.genBtn` pinning it to the row's right edge. `.genRow` now wraps only `.replyArea`.

## Dependencies
Issue #1, Issue #2, Issue #4, Issue #8

## Type
fullstack

## Priority
medium

## Design Reference
`UI design/chat.html`
