# 图片/表情内容标注

## Description
支持用户为对方发送的图片/表情添加内容类型 + 文字含义标注，纳入生成上下文。

## Acceptance Criteria
- [x] 在对方消息输入区，用户可选择添加"图片/表情"条目（可替代或附加于文本消息）— `src/screens/chat/ChatScreen.tsx` 底部面板新增「图片 / 表情说明」切换按钮（`IconImage`，新增到 `icons.tsx`，复用设计稿 `chat.html` 的 rect+十字图标），点击展开一个独立的标注表单区，与文本粘贴框并列、互不影响——可以只加标注、只加文本消息，或两者都加
- [x] 该条目需填写：内容类型（下拉：表情/图片/其他）+ 文字含义描述（自由文本）— 展开区是原生 `<select>`（`ANNOTATION_TYPES = ['表情', '图片', '其他']`，AC 明确给的三项，未沿用设计稿演示里的"表情包/图片/贴纸/语音"四项）+ 原生 `<input>` 文本框，"添加"按钮在含义描述非空前禁用
- [x] 该条目会被纳入后续生成回复的上下文 — 复用 #3/#8 已有的 `message.insert` IPC，`role: 'annotation'` + `annotationType` + `annotationText` 落库（`message` 表这三列基线 schema 就有，未改动主进程/schema）；聊天页加载时 `message.listByChatCard` 拉取的历史本就包含这些行，"纳入生成上下文"消费端在 #10（生成回复）实现，本 issue 保证数据落库这一半，与 #7 对短期目标的处理方式一致
- [x] 该条目在对话线程中以独立气泡样式展示（图标 + 描述文字）— 复用已有的 `AnnotationNote` 组件（`src/components/ui/MessageBubble/MessageBubble.tsx`，早前 issue 就建好了，本 issue 是第一个使用它的地方）。初版照搬设计稿 `chat.html` 的 `.annotation-row`（`align-self:center` 居中展示），上线自测后发现这样看不出该条目是谁发的——于是改为和其他"对方"消息一样走 `msgRow`/`them` 布局、带头像，只是气泡内容换成 `AnnotationNote`（虚线边框 + 类型徽章）而不是 `MessageBubble`。这个调整是有依据的，不是随意去设计稿：AC 第一条本身就写明标注只能从"对方消息输入区"添加，也就是标注永远来自对方，居中展示反而丢失了本该有的头像归属信息
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — 沙箱限制与 #6/#7/#8 相同，复用同一套"不含 `vite-plugin-electron` 的临时渲染层配置 + headless Chromium（Playwright）+ 内存 mock `window.api`"验证路径：展开区默认隐藏、点击按钮后出现、选择"图片"类型并填写含义后点击"添加"、居中的虚线标注气泡带类型徽章正确出现、含义输入框提交后清空但展开区保持打开（可连续添加）、mock store 里的记录字段（`role`/`annotationType`/`annotationText`）都正确、返回首页重新打开同一张卡片后标注气泡仍在，全程截图确认且控制台无报错

## Implementation Notes
- No new IPC/schema: `message.insert`/`message.listByChatCard` (from #3, wired into the renderer in #8) already accept and persist `annotationType`/`annotationText` — this issue is pure renderer-side UI on top of an existing write path.
- Deliberately deviated from `chat.html`'s demo dropdown options (表情包/图片/贴纸/语音) in favor of the AC's explicit three (表情/图片/其他) — the AC is the spec; the HTML mock is illustrative, not literal.
- After a successful add, only `annotationText` clears — the expand panel stays open and the selected type is preserved, so annotating several stickers/images in a row doesn't require re-opening the panel or re-picking the type each time.
- Scope boundary: this only lets a user *describe* what an image/sticker meant — no actual image upload/paste-from-clipboard capture. That matches the AC ("文字含义描述"), and no design reference or AC in this issue asks for real image handling.

## Dependencies
Issue #8

## Type
frontend

## Priority
medium

## Design Reference
`UI design/chat.html`
