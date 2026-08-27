# 应用图标接入

## Description
新增 electron-builder 约定的 `build/` 图标资源目录，配置 `mac.icon`/`win.icon` 引用，使得后续用户提供正式图标文件后直接替换即可生效，无需改动配置代码。图标缺失时不应阻断打包流程。

## Acceptance Criteria
- [x] 新增 `build/` 目录，预留 `icon.icns`（Mac）、`icon.ico`（Windows）路径位
- [x] `electron-builder.yml` 中正确引用图标路径（`mac.icon` / `win.icon`）
- [x] 图标文件缺失时，打包命令仍能成功执行（回退到 electron-builder 默认图标），不因图标缺失报错中断
- [x] 待用户提供正式图标文件后，替换 `build/` 目录下对应文件即可生效，无需改动配置代码
- [x] Typecheck/lint 通过

## Dependencies
Issue #47

## Type
infra

## Priority
low

## Source
tasks/prd-electron-builder-packaging.md — US-004

## Verification Notes

新增 `build/` 目录（含 `README.md` 说明放什么文件、尺寸建议），`electron-builder.yml` 里加了 `mac.icon: icon.icns` 与 `win.icon: icon.ico`（都是相对 `directories.buildResources` 默认值 `build/` 的路径，即分别指向 `build/icon.icns`、`build/icon.ico`）。

**读了 electron-builder 的图标解析源码（`app-builder-lib/out/util/iconConverter.js` 的 `resolveSourceFile`）确认了行为**：文件查找用 `stat()` 包在 try/catch 里，找不到就返回 `null` 而不是抛错，最终会一路 fallback 到 `framework.getDefaultIcon()`（只打一条 warning log），不会导致构建失败——所以先在配置里引用一个当前还不存在的路径是安全的。

**没有只信代码阅读，两个方向都做了真实验证：**
1. **缺失时不阻断**：`mac.icon`/`win.icon` 配置好但 `build/` 下没有实际文件时，跑 `electron-builder --dir --mac`，退出码 `0`，日志里能看到 `default Electron icon is used  reason=application icon is not set` 的警告，构建正常完成。
2. **补上文件后自动生效**：临时在 `build/icon.icns` 放了一个占位文件（验证发现 electron-builder 对 `.icns` 走的是直接透传，不校验内部格式，所以任意存在的文件即可验证路径解析逻辑），重新打包后退出码依然 `0`，日志里"default icon"警告消失，且打包产物 `Contents/Resources/icon.icns` 确实是我放的那个文件——证明只要用户把真实图标丢进 `build/` 目录，下次打包就会自动生效，不需要碰 `electron-builder.yml`。验证用的占位文件已删除，`build/` 目录现在只保留 `README.md`。

Typecheck/lint 通过。所有验证产生的 `release/` 产物与占位图标文件均已清理。
