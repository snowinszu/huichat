# "生成时自动添加到历史" 开关接入

## Description
把 #21 新建的"生成时自动添加到历史"开关接入候选回复的"复制"操作：开启后点击"复制"即同时完成复制与加入对话历史。

## Acceptance Criteria
- [x] 开关默认关闭（保持当前行为：复制与加入对话历史是两个独立按钮/动作）— 沿用 #21 schema.ts 播种的默认值 `auto_add_to_history = 0`
- [x] 开启后，候选回复卡片上的"复制"按钮点击后：复制到剪贴板 **且** 自动把该条回复加入对话历史（等价于同时触发现有的复制与加入对话两个动作）— `handleCopyReply` 在 `preference.autoAddToHistory` 为真时直接委托给已有的 `handleAddReplyToThread`（该函数本就是"插入消息 + 复制剪贴板"的完整实现，无需重写逻辑）
- [x] 开启状态下，原本独立的"加入对话"按钮可以保留（点击效果与复制按钮触发的加入历史行为一致，不产生重复消息）— 两个按钮开启后走的是同一个函数 `handleAddReplyToThread`，同一次点击只会触发一次 `message.insert`
- [x] 关闭后行为与当前一致：复制只复制，加入历史需单独点击 — `handleCopyReply` 在偏好关闭时保留原本的纯复制逻辑不变
- [x] 切换开关无需重启应用，下一次生成回复即生效 — 复用 #22 已建立的"`ChatScreen` 每次挂载都重新拉取偏好"机制，同一份 `preference` 状态两个 issue 共用
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 见 Implementation Notes

## Implementation Notes
- No new write path was needed — `handleAddReplyToThread` (the "加入对话" button's handler) already did exactly "insert into the thread, then copy to clipboard, then toast" before this issue existed. `handleCopyReply` now just early-returns into that same function when the preference is on, instead of duplicating its insert-then-copy logic. This means the "one write path" invariant AC3 asks for ("不产生重复消息") holds by construction, not by careful bookkeeping — there's only one function that ever calls `message.insert` for a reply candidate, so there's nothing to keep in sync.
- `handleCopyReply`'s signature changed from `(index, text)` to `(index, candidate)` since delegating to `handleAddReplyToThread` needs the full `ReplyCandidate` (including `translation`), not just the display text; updated the one JSX call site accordingly.
- The existing `copiedIndex`/`addingIndex` state and their UI (the "已复制"/"加入对话中…" button states) needed no changes — `handleAddReplyToThread` already sets `copiedIndex` on its own success path (it always copies too), so the "复制" button correctly shows its "已复制" state regardless of which button actually triggered the underlying call.
- **Verified in a browser**: same `ELECTRON_STARTUP_PREVENT=1 npm run dev` + Playwright/headless-Chromium approach as prior issues, this time with `context.newPage({ permissions: ['clipboard-read', 'clipboard-write'] })` granted so the real `navigator.clipboard.writeText` calls succeed cleanly instead of hitting the failure-toast branch. Two scenarios against a stateful mocked `window.api` (including a real `reply.generate` mock returning two candidates): with the preference off, clicking "复制" left the thread empty (`message.insert` never called) while "加入对话" on the same card still worked independently and did insert; with it on, clicking "复制" alone triggered exactly one `message.insert` call and showed the "已加入对话并复制" toast. 5/5 checks passed, zero console errors. Screenshots confirm the visual states: off → empty thread + "已复制" badge only; on → the candidate appears as a real message bubble in the thread with the "已加入对话并复制" toast visible. `npm run build` also verified clean. Driver script deleted after running, never entered the diff.

## Dependencies
Issue #21

## Type
fullstack

## Priority
medium

## Design Reference
`UI design/settings.html` 中该开关说明文案"点击复制后自动把该条记录追加到对话历史"

## PRD Reference
`tasks/prd-general-settings-and-model-page.md` — US-004
