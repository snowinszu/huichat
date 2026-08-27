# 聊天界面 — 粘贴对方消息并自动翻译

## Description
聊天界面支持粘贴对方消息加入对话线程，非中文消息自动生成中文翻译。

## Acceptance Criteria
- [x] 聊天界面有输入/粘贴框，提交后该消息以"对方"消息气泡形式加入对话线程 — `src/screens/chat/ChatScreen.tsx` 底部新增 `bottom-panel`（`UI design/chat.html` 的 `.paste-input` + `.add-msg-btn`，原生 `<textarea>` 而非复用表单版 `Textarea` 组件，理由同 #7 的短期目标输入：需要贴合设计稿的紧凑单行聊天框样式而非带 label 的表单字段外观），点击"添加消息"或 ⌘/Ctrl+Enter 提交，新消息以 `role: 'other'` 插入并追加到 `messages` state，用已有的 `MessageBubble`（`from="them"`）渲染
- [x] 系统自动检测消息语言；非中文时自动生成中文翻译并在气泡旁/下方展示 — 新增 `src/lib/isNonChineseText.ts`（与设计稿 `chat.html` 里的 `isNonChinese` 同一启发式：中文字符占比 < 20% 判定为非中文），命中时调用新增的 `window.api.message.translate(text)` IPC，返回结果用已有的 `TranslationNote` 组件渲染在气泡下方
- [x] 中文消息不显示翻译区块 — 中文消息 `isNonChineseText` 为 false，跳过翻译调用，`insertMessage` 的 `translation` 传 `null`，渲染时 `message.translation` 为空则不渲染 `TranslationNote`
- [x] 消息原文与翻译（如有）关联该聊天卡片持久化到数据库 — 复用 #3 已有的 `message.insert` IPC → `insertMessage`（`electron/main/db/messageRepository.ts`，未改动），`content`/`translation`/`chat_card_id` 一并写入 SQLite `message` 表；聊天页加载时用已有的 `message.listByChatCard` 拉取历史，保证跨会话/重新打开卡片后消息与翻译都还在
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — 沙箱内 Electron 主进程仍无法起 GUI（同 #6/#7），复用同一套"不含 `vite-plugin-electron` 的临时渲染层配置 + headless Chromium（Playwright）+ 内存 mock `window.api`"验证路径：中文消息提交后气泡无翻译区块、非中文消息提交后气泡下方出现翻译区块且 mock 的 `translate` 被调用一次、两条消息都正确落入 mock store（`translation` 字段一个为 `null` 一个为翻译文本）、返回首页再重新打开同一张卡片后两条历史消息仍能读到，全程截图确认且控制台无报错

## Implementation Notes
- New IPC surface: `IPC_CHANNELS.messageTranslate` (`message:translate`) — `electron/main/ipc/register.ts` handler reads the single-row `settings` table (from #4) and calls the existing `callLlm(config, prompt)` helper (`electron/main/llm/client.ts`, unchanged) with a translate-only prompt, returning trimmed plain text. No new schema/table needed — `message.translation` already existed from #3's baseline schema.
- Translate failures degrade gracefully: if `window.api.message.translate` rejects (no settings configured, network/API error), `ChatScreen.handleAddMessage` catches it, shows a toast, and still inserts the original message with `translation: null` rather than blocking the paste entirely — losing the translation is preferable to losing the pasted message.
- Scope boundary vs. #10/#9: this issue only ever creates `role: 'other'` messages (the "粘贴对方消息" flow). Rendering already handles `role: 'self'` (right-aligned, no avatar, via the same `MessageBubble`) defensively for when #10 starts writing candidate-reply-derived `self` messages, but no UI in this issue creates them. `annotationType`/`annotationText` (image/sticker annotations, #9) are read from `MessageRecord` but not specially rendered yet — out of scope here, `message.content` still displays for any such row without crashing.
- Verification note: same sandbox limitation as #6/#7 — `npm run dev`'s real Electron main process can't get a GUI here, so a scoped temporary Vite config (react plugin only) served just the renderer for the Playwright check; deleted immediately after and not part of the shipped diff.

## Dependencies
Issue #1, Issue #2, Issue #3, Issue #4, Issue #6

## Type
fullstack

## Priority
high

## Design Reference
`UI design/chat.html`
