# 锁定状态管理 + 全屏遮罩

## Description
实现应用的锁定状态机制及配套的全屏遮罩 UI。锁定状态需要维护在不随渲染进程刷新而重置的位置（如主进程或持久化的顶层状态），确保窗口最小化/恢复不会丢失锁定状态。锁定后渲染一个全屏遮罩，完全覆盖原有界面内容，只展示应用图标/名称和密码输入框占位（具体密码校验交互见 Issue #56，本 Issue 只负责遮罩展示与状态维护）。

## Acceptance Criteria
- [x] 应用维护一个全局锁定状态，不因渲染进程刷新或窗口最小化/恢复而丢失
- [x] 锁定后一个全屏遮罩层完全覆盖应用原有界面（聊天内容、导航、标题栏图标等均不可见），只显示应用图标/名称 + 密码输入框（占位）
- [x] 遮罩层下应用原有的 React 状态（当前打开的聊天、草稿输入等）在锁定期间保留在内存中，不会被卸载或重置
- [x] 锁定状态下无法通过键盘快捷键、右键菜单等方式绕过遮罩访问底层内容
- [x] 应用最小化后再恢复，若之前处于锁定状态，恢复后依然显示遮罩
- [x] 提供一个内部方法/IPC 用于将应用切换为锁定状态，供 Issue #55 的锁定图标调用
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
Issue #52

## Type
fullstack

## Priority
high

## Source
tasks/prd-app-lock-screen.md — US-004

## Verification Notes

**锁定状态的真源在主进程**（`electron/main/appLockState.ts`，一个模块级 `locked` 布尔量，故意不落库——PRD 明确非目标是"不支持应用启动时强制要求密码"，进程重启即重置），渲染进程的 `AppLockProvider`（`src/components/ui/AppLock/`）只在挂载时通过新增的 `app-lock:is-locked` IPC 问一次，之后本地维护一份镜像用于渲染。真正把这份主进程状态改成 `true` 的入口是新增的 `app-lock:engage` IPC（`register.ts`，会先检查 `getAppLockStatus(db).enabled`，未设密码时直接抛错，避免锁进一个进不去的状态）——这是留给 Issue #55 标题栏图标调用的"内部方法"。

**"无法通过键盘快捷键绕过"分两层做**：
1. `electron/main/index.ts` 里 `mainWindow.webContents.on('before-input-event', ...)`，锁定时拦截 Cmd/Ctrl+R、F5（刷新）和 Cmd/Ctrl+Shift+I、Cmd/Ctrl+Alt+I、F12（开发者工具）——这些是唯一能让渲染进程整个重新加载、从而绕过遮罩组件树的快捷键。
2. `AppLockProvider` 把原有内容包在 `<div inert={locked}>` 里（React 19 原生支持 `inert` 属性）——不是简单的视觉覆盖，`inert` 让整棵子树无法被键盘聚焦、点击或右键，同时仍然挂载在 DOM 里，满足"状态保留在内存中"。

右键菜单本身没有额外处理：仓库里没有任何 `Menu`/`context-menu` 自定义（grep 确认），Electron 默认对非可编辑元素不弹右键菜单，所以这条 AC 是现状自然满足，不需要新代码。

`LockOverlay.tsx` 目前只是外壳（图标+"会聊"+一个 `PasswordInput` 占位），没有提交/校验逻辑——按 Issue 拆分约定，那部分留给 Issue #56。

Typecheck/lint 通过。用 `npm run build`（Node 22.20，同 Issue #53 的环境限制）+ `_electron.launch` 手动验证：
1. 通过设置页开启锁屏后，直接调用 `window.api.appLock.engage()`（模拟 Issue #55 图标点击的主进程半边）→ 主进程 `isLocked()` 变 `true`
2. 按 `Meta+R`：应用**没有**刷新（设置页的开关状态、"锁屏已开启" toast 全部原样保留），证明快捷键拦截生效
3. 用 `page.reload()`（绕开快捷键层，直接测渲染进程挂载时的恢复逻辑）强制刷新后，遮罩正确重新出现（`[aria-label="应用已锁定"]` 存在），且刷新后的页面里能查到 `[inert]` 元素，点击任意 `button`/`switch`/`a` 均超时失败（`inert` 生效）
4. 截图确认遮罩视觉：居中锁形图标 + "会聊" + 密码输入框，背景完全不透明，看不到任何底层内容

（测试方法上踩了一个坑并记录：第一次直接调用 `window.api.appLock.engage()` 后检查遮罩显示为 false，一度怀疑有 bug——后来定位到是测试脚本绕过了 React 层的 `engageLock()`（只调了 IPC 半边，没触发本地 `setLocked(true)`），不是产品代码问题；改用"绕过快捷键层、直接触发一次真实的页面 reload"来验证挂载时的恢复路径后，行为符合预期。）
