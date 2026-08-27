# 目录选择器 IPC

## Description
新增一个 IPC 通道，主进程调用 Electron 原生的 `dialog.showOpenDialog` 弹出系统目录选择对话框，preload 层暴露给渲染进程调用，供设置页选择调试导出目录使用。

来源：`tasks/prd-llm-debug-export.md` — US-002

## Acceptance Criteria
- [x] 新增 IPC 通道（如 `debug-export:choose-directory`），主进程用 `dialog.showOpenDialog({ properties: ['openDirectory'] })` 弹出系统目录选择器
- [x] 用户选中目录后，通道返回所选的绝对路径字符串
- [x] 用户在系统对话框中点击取消时，通道返回 `null`，且不修改已保存的 `debugExportDir`
- [x] preload 暴露对应方法（如 `window.api.debugExport.chooseDirectory(): Promise<string | null>`）
- [x] Typecheck/lint 通过

## Verification Notes
新增 `IPC_CHANNELS.debugExportChooseDirectory`（放在 `appPreference*` 附近，因为概念上属于同一组偏好相关操作），`register.ts` 里用 `dialog.showOpenDialog({ properties: ['openDirectory'] })` 实现，取消或空 `filePaths` 时返回 `null`；`preload/index.ts` 暴露 `window.api.debugExport.chooseDirectory()`。这个 handler 本身不触碰 `app_preference` 表，只负责"问用户选哪个目录"，真正写入 `debugExportDir` 由后续 Issue #39 的设置页在拿到非 null 路径后自行调用 `appPreference.update`——所以"取消不修改已保存值"这条天然成立。

由于是真实系统级原生对话框，Playwright 无法直接点击，采用了 Electron 测试的标准手法：通过 `electronApp.evaluate` 在真实运行的主进程里 stub 掉 `dialog.showOpenDialog`，分别模拟"选中 `/tmp/my-chosen-debug-dir`"和"用户取消"两种系统回调，验证整条 IPC 链路（渲染进程调用 → preload → 主进程 handler → 返回值）在两种情况下都符合预期（分别返回该路径和 `null`）。

## Dependencies
Issue #37（偏好数据新增调试导出字段）

## Type
backend

## Priority
high
