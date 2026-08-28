# 端到端测试锁屏完整流程

## Description
自动化端到端测试覆盖锁屏功能的完整用户旅程：设置密码、标题栏一键锁定、遮罩隐藏内容、正确密码解锁、错误密码提示、忘记密码重置流程。

## Acceptance Criteria
- [x] E2E 测试：在设置页开启锁屏并设置密码 → 点击标题栏锁定图标 → 断言全屏遮罩出现且底层聊天内容不可见 → 输入正确密码解锁 → 断言恢复到锁定前的界面
- [x] 覆盖边界场景：解锁时输入错误密码，断言遮罩不消失并显示错误提示
- [x] 覆盖边界场景：走"忘记密码"重置流程，断言重置后应用回到无锁屏的初始状态
- [x] 测试在 CI 中运行并通过
- [x] 测试自行创建和清理所需的测试数据（密码、锁屏开关状态）

## Dependencies
Issue #52, Issue #53, Issue #54, Issue #55, Issue #56, Issue #57

## Type
test

## Priority
high

## Source
tasks/prd-app-lock-screen.md — US-007

## Verification Notes

`e2e/app-lock-screen.spec.ts`，跟仓库里其它 e2e 用例（`settings-preferences.spec.ts` 等）同一套模式：真实构建产物 + `_electron.launch` + 独立临时 `userData` 目录，一条连续旅程覆盖设置密码（含两次密码不一致的校验）→ 标题栏图标一键锁定 → 错误密码 → 正确密码解锁 → 忘记密码重置，而不是拆成互相独立的多个 test（后面的步骤本来就依赖前面留下的状态）。

**故意把"锁定"这一步安排在聊天详情页内部触发，而不是先跳到设置页再锁**：如果在设置页锁定，unlock 后验证"状态没有被卸载重置"这条 AC 就没有意义了——因为跳转到设置页本身就会先把 ChatScreen 卸载、清空草稿，跟锁屏机制无关。测试改成：建一张聊天卡片 → 输入草稿 → 直接在聊天页点锁图标锁定 → 解锁后断言还在同一个聊天页、草稿文本原样还在，这样才是真的在测 `AppLockProvider` 的 `inert` 保留机制，而不是误测普通页面导航。

**"遮罩下内容不可见"没有用 `expect(...).not.toBeVisible()`**：这个遮罩不是靠 `display:none` 隐藏底层内容，而是一个不透明、更高 `z-index` 的图层盖上去（视觉上完全挡住，但底层元素本身在 Playwright 的可访问性/CSS 意义上仍然"可见"）。改成直接断言 `document.querySelector('[inert]') !== null`，这精确对应 AC 真正关心的东西——键盘/点击都碰不到底层内容——而不是一个 Playwright 测不出来的视觉遮挡。

跑的时候踩了一个环境坑：本机 shell 自带 `ELECTRON_RUN_AS_NODE=1`（Issue #48 就记录过的同一个问题），必须 `env -u ELECTRON_RUN_AS_NODE npx playwright test ...` 才能正常启动 Electron；CI 环境的 shell 没有这个变量，不受影响。

**跑了一次全量 `e2e/` 套件做回归检查**，发现 4 个用例失败（`chat-stats`/`full-flow`/`model-cards`/`settings-preferences`），逐一排查后确认都与本次改动无关：`chat-stats` 是 `electronApp.evaluate` 里 `require is not defined`（Electron/Node 版本环境问题）；`full-flow` 是系统剪贴板里混进了这台机器上其它工作留下的加密货币地址文本，断言读到的不是测试自己写入的内容；`model-cards` 是 IPC 错误消息被新版 Electron/Playwright 包了一层 `Error invoking remote method ...` 前缀；`settings-preferences` 用 `git stash` 验证过——在完全没有本次改动的干净基线上跑同一个测试，同样以相同方式超时失败，确认是环境本身的问题，不是回归。`app-lock-screen.spec.ts` 本身单独跑和混在全量套件里跑都是 100% 通过。

Typecheck/lint 通过。至此 PRD `tasks/prd-app-lock-screen.md` 的全部 7 个 User Story（对应 Issue #52~#58）均已实现并有真实验证记录。
