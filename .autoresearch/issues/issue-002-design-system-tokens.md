# 设计系统与组件基座（tokens + 复用组件）

## Description
本项目 UI 有既有设计稿（`UI design/` 目录，含 `DESIGN-HANDOFF.md` 与 `DESIGN-MANIFEST.json`），要求编码前先提取设计 tokens 并按 screen-file-first 原则实现，避免各页面各自实现导致视觉不一致。本 Issue 从 `components.html` / `index.html` 提取颜色、字号、间距、圆角、阴影、动效等 tokens，并搭建按钮、卡片、输入框、消息气泡、Toast、Modal、语气选择 chip 等可复用组件，作为其余前端 Issue 的公共基座。

## Acceptance Criteria
- [x] 从设计稿提取并冻结 design tokens：background/surface/foreground/muted text/border/accent/radius/shadow/spacing/type scale/motion，落地为项目内可复用的样式变量（如 CSS variables / theme 文件）— `src/styles/tokens.css`，从 `components.html`/`index.html`/`home.html`/`roles.html`/`settings.html` 的 `:root` 交叉核对后冻结（含 danger/warning/success 语义色、r-sm~r-xl 圆角、shadow-sm~lg、type scale、4px 间距节奏、motion duration）
- [x] 实现 `components.html` 中出现的核心复用组件（按钮各状态、卡片、输入框、消息气泡、Toast、Modal/弹窗、语气选择 chip 等），覆盖 default/hover/focus/active/disabled/loading/error 等状态 — `src/components/ui/` 下共 12 个组件目录：Button/IconButton（primary/ghost/danger/subtle × loading/disabled）、Input（含 Textarea，focus/error/disabled）、ToneChip（active/disabled）、MessageBubble（+TranslationNote/AnnotationNote）、ContactCard/AddContactCard（hover 显现的编辑/删除操作、disabled）、ReplyCard（copied 态）、AvatarUpload（empty/filled）、Overlay/Modal/ConfirmDialog（danger/warning 两种色调）、Toast/ToastProvider（success/error/info，2.8s 自动关闭）。真实交互态（hover/focus）用原生 CSS 伪类实现而非 demo class，与 `home.html` 等真实页面一致
- [x] 响应式范围收窄为桌面窗口尺寸的基本自适应（最小宽度、卡片网格换行），不强制铺满设计稿完整的移动端断点矩阵 — `ContactCardGrid` 用 `repeat(auto-fill, minmax(240px, 1fr))` 自动换行，未引入移动端断点
- [x] 保留设计稿中的真实文案/标签（如"新建聊天对象""重新生成"等），不替换为占位文案 — App.tsx 展示页沿用设计稿原文案（"生成回复""重新生成""确认删除""新建聊天对象""对方基本信息"等）
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — Electron 主进程在本沙箱仍无法起 GUI 窗口（与 Issue #1 记录的 `ELECTRON_RUN_AS_NODE=1` 限制相同），改用纯 Vite（剔除 electron 插件的临时配置，验证后已删除）+ headless Chromium（Playwright）跑通渲染层：截图确认 token 配色/间距/圆角与设计稿一致，并驱动了按钮 hover、语气 chip 切换、Toast 弹出、Modal 打开/关闭、删除确认弹窗等交互，控制台无报错。请在本地终端用 `npm run dev` 做最终 Electron 窗口内的肉眼确认

## Post-merge fix (found via real usage in Issue #4's settings screen)
User-reported bug: the toast visibly appeared centered, then drifted to the right during its entrance animation. Root cause was the classic `position: fixed; left: 50%; transform: translateX(-50%) translateY(...)` centering trick — combining a static horizontal-centering transform with an animated vertical-slide transform on the same property in a `@keyframes` block, which doesn't reliably hold the horizontal centering steady during the animation.

Fixed in `Toast.module.css`/`Toast.tsx`: replaced transform-based horizontal centering with structural centering — a `position: fixed` full-width strip (`inset: auto 0 32px 0`) using `display: flex; justify-content: center` to center the actual toast bubble, which is a child `pointer-events: auto` element (the strip itself is `pointer-events: none` so it doesn't block clicks elsewhere). The keyframe animation now only touches `opacity`/`translateY`, never horizontal position. Verified by sampling the toast's bounding box every 40ms across a 360ms window during and after the entrance animation (headless Chromium) — horizontal center held at exactly the viewport center (0px drift) across all 10 samples, vs. the previous transform-combination approach.

## Dependencies
Issue #1

## Type
frontend

## Priority
high

## Design Reference
`UI design/components.html`, `UI design/index.html`（导览页，不对应功能，仅供参考）
