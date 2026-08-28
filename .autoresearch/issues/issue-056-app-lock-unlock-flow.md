# 遮罩密码输入解锁

## Description
在 Issue #54 的全屏遮罩上实现密码输入与校验交互：用户输入密码后调用 Issue #52 提供的验证 IPC，正确则解除锁定并恢复到锁定前的界面状态，错误则提示并保持锁定。

## Acceptance Criteria
- [x] 密码输入框支持回车提交，也提供"解锁"按钮
- [x] 密码正确时遮罩立即消失，恢复到锁定前的界面和滚动位置/输入状态
- [x] 密码错误时输入框震动/红色边框提示"密码错误"，输入框清空，焦点保留在输入框，遮罩不消失
- [x] 密码错误不做失败次数限制或延迟（每次错误仅提示，不锁定或冷却）
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
Issue #52, Issue #54

## Type
frontend

## Priority
high

## Source
tasks/prd-app-lock-screen.md — US-005

## Verification Notes

新增第 5 个 app-lock IPC channel `app-lock:unlock`：跟 Issue #52 的 `clearPassword`（密码错才抛错）不同，这里密码错误是家常便饭而不是异常——`register.ts` 里的 handler 直接返回布尔值（`verifyAppLockPassword` 的结果，正确才顺带 `setAppLocked(false)`），不抛错，调用方不需要 try/catch 就能拿到"对不对"。`AppLockContext` 对应加了 `disengageLock(password): Promise<boolean>`，成功时才把渲染进程本地的 `locked` 状态设回 `false`。

`LockOverlay.tsx` 从 Issue #54 的纯外壳升级成真正可交互：`PasswordInput` 的 `onKeyDown` 拦截 Enter 直接提交，旁边一个走 `Button loading` 态的"解锁"按钮做同样的事。错误处理拼的是三件东西一起触发：`PasswordInput` 自带的 `error` prop（红色边框 + 错误文案，组件原生支持，没另外写样式）、新加的 `shake` CSS class（`translateX` 抖动关键帧，`onAnimationEnd` 里翻回 `false`，保证连续两次错误也能重新触发动画）、清空输入框。

**焦点保留是唯一有技术含量的点**：`PasswordInput`/`Input` 这两个共享组件在这个代码库里从没被其它调用方 ref 过（AvatarUpload 之类都是原生 `<input ref=...>`），本身也没做 ref 转发。为了不为这一个调用点去改一个到处在用的共享组件，改成给外层 `<div>` 挂一个 wrapper ref，错误发生时 `formRef.current?.querySelector('input')?.focus()` 直接从 DOM 里把焦点找回来，不依赖组件支持 ref forwarding。

Typecheck/lint 通过。`npm run build`（Node 22.20）+ `_electron.launch` 走了真实解锁流程验证：
1. 开密码 → 点标题栏锁图标锁定 → 遮罩出现
2. 遮罩里填错误密码，点"解锁"按钮 → 仍然锁定，"密码错误"文案可见，输入框已清空（`inputValue()` 为空字符串），且 `document.activeElement` 确认焦点仍在输入框上
3. 填正确密码，按 Enter（走键盘提交路径，不点按钮）→ 遮罩消失
4. 解锁后检查底层设置页——"锁屏密码"开关仍是 `aria-checked="true"`，证明锁定期间那块内容始终是同一份 React 状态（Issue #54 的 `inert` 保留机制），不是重新挂载出来的
5. 截图确认视觉：红色描边输入框 + 错误提示 + 全宽"解锁"按钮，样式与设置页其它表单一致
