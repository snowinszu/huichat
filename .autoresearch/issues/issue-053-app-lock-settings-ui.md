# 设置页锁屏开关 + 设置/关闭密码对话框

## Description
在设置页新增"锁屏密码"开关，接入 Issue #52 提供的 IPC 能力。开启开关时弹出设置密码对话框（密码 + 确认密码，掩码显示）；关闭开关时弹出验证当前密码对话框。密码输入框复用现有 `Input` 组件的掩码模式，交互风格与 `SettingsScreen.tsx` 中其他开关（如 darkMode）保持一致的乐观更新/失败回滚模式。

## Acceptance Criteria
- [x] 设置页新增"锁屏密码"开关，默认关闭
- [x] 打开开关时弹出"设置密码"对话框，要求输入密码和确认密码两次，输入框使用密码掩码（●●●）
- [x] 两次输入不一致时显示红色提示"两次输入的密码不一致"，不允许提交
- [x] 提交成功后开关变为开启状态，并 toast 提示"锁屏已开启"
- [x] 用户在设置密码对话框中点击取消，开关保持关闭、不保存任何密码
- [x] 已开启锁屏时关闭开关会弹出"输入当前密码以关闭锁屏"对话框
- [x] 密码正确时开关变为关闭，toast 提示"锁屏已关闭"；密码错误时显示红色提示"密码错误"，开关保持开启状态
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
Issue #52

## Type
frontend

## Priority
high

## Source
tasks/prd-app-lock-screen.md — US-001, US-002（前端部分）

## Verification Notes

`SettingsScreen.tsx` 新增"隐私与安全"卡片，放在"通用"和"调试"之间，一个 `Toggle` 绑定 `lockStatus.enabled`（挂载时 `window.api.appLock.getStatus()` 拉取）。这个开关不做其它开关那种乐观更新——`checked` 只在密码对话框真正成功后才变化，取消对话框不需要任何回滚逻辑。

复用现有 `Modal` + `PasswordInput`（自带掩码/显隐切换）组件，两个对话框：
- "设置锁屏密码"（开）：密码 + 确认密码两个 `PasswordInput`，前端先做一次长度/一致性校验再调 `appLock.setPassword`，成功后关闭弹窗、toast、`setLockStatus({enabled:true})`。
- "关闭锁屏"（关）：单个 `PasswordInput` 输入当前密码，调 `appLock.clearPassword`，主进程内部会先验证密码再清除，错误信息（`密码错误`）直接从 IPC 异常里取出显示在输入框下方。

Typecheck/lint 通过。用真实构建（`npm run build`，Node 22.20 通过 nvm 切换，因为默认 Node 20.18 低于 Vite 8 的最低要求）+ `_electron.launch` 驱动完整应用跑了一遍手动验证（未写成正式 e2e，正式端到端测试是 Issue #58）：
1. 初始状态 `aria-checked="false"`
2. 打开开关 → 两次密码不一致 → 红色提示"两次输入的密码不一致"可见，弹窗不关闭
3. 改成一致的密码 → 提交 → "锁屏已开启" toast 可见，开关变为 `aria-checked="true"`
4. 关闭开关 → 输入错误密码 → "密码错误"提示可见，开关仍为 `aria-checked="true"`
5. 输入正确密码 → "锁屏已关闭" toast 可见，开关变回 `aria-checked="false"`

验证时踩到 Issue #48 记录过的同一个坑（本地工具链 shell 自带 `ELECTRON_RUN_AS_NODE=1`，导致 Electron 二进制被当纯 Node 进程启动，无法识别 `--remote-debugging-port` 等 CLI flag），用 `env -u ELECTRON_RUN_AS_NODE` 清掉后正常，不是项目代码问题。截图确认"隐私与安全"卡片视觉与其它卡片一致。
