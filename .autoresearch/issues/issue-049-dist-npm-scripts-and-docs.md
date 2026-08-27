# 新增一键生成安装包的 npm 命令 + gitignore/文档

## Description
新增 `dist`/`dist:mac`/`dist:win` 三个 npm 脚本，一键完成"构建代码 → 打包成安装包"的流程。同时确认打包产物目录被 `.gitignore` 忽略，并补充"如何生成安装包"的文档说明。

## Acceptance Criteria
- [x] `package.json` 新增 `"dist": "npm run build && electron-builder"`（当前平台自动匹配）
- [x] 新增 `"dist:mac": "npm run build && electron-builder --mac --universal"` 与 `"dist:win": "npm run build && electron-builder --win --x64"`
- [x] 命令执行成功后，`release/` 目录下生成对应平台的安装包文件，文件名包含应用名与版本号
- [x] 命令失败时（如原生模块编译失败）以非 0 退出码终止，终端输出可定位问题的错误信息
- [x] 确认/补充 `.gitignore` 中打包输出目录（`release/`）的忽略规则
- [x] README 或项目文档中新增"如何生成安装包"说明，包含 `dist:mac`/`dist:win` 用途及 Windows 安装包需在 Windows 主机构建的限制
- [x] Typecheck/lint 通过

## Dependencies
Issue #47, Issue #48

## Type
infra

## Priority
high

## Source
tasks/prd-electron-builder-packaging.md — US-003, US-005

## Verification Notes

`package.json` 新增 `dist`、`dist:mac`、`dist:win` 三个脚本。`.gitignore` 中 `release` 条目在 Issue #47 时就已存在，本次确认无需改动。新增 [README.md](../../README.md)，包含"生成安装包"章节：三条命令的用途表格 + 为什么不能跨平台交叉编译（原生模块 `better-sqlite3`）+ 代码签名现状说明。

**额外发现并修复了一处配置缺口**：`electron-builder` 对 Electron 框架的 mac 默认打包目标是 `["zip", "dmg"]`，如果不显式指定，`npm run dist:mac` 会顺带多生成一个 PRD 里没要求的 `.zip`。在 `electron-builder.yml` 的 `mac` 段加了 `target: dmg` 固定只产出 dmg（Windows 侧 `nsis` 本来就是 electron-builder 默认值，不需要显式配置，加了一行注释说明原因）。

**真实跑通了三条验收路径（不是照抄 AC 描述打勾）：**
1. **失败路径**：临时把 `package.json` 的 `main` 字段改成一个不存在的文件，跑 `electron-builder --dir --mac`，确认退出码为 `1`，且报错信息明确可定位（`Application entry file "..." was not found in this archive`）。验证完立刻恢复了 `package.json`。
2. **成功路径（真实完整打包，不是 `--dir` 简化版）**：直接执行 `npm run dist:mac`，走完整链路（`tsc --noEmit` → `vite build` → x64/arm64 分别 rebuild `better-sqlite3` → universal 合并 → dmg 打包），退出码 `0`，产物为 `release/会聊-0.1.0-universal.dmg`（235MB，文件名含应用名"会聊"与版本号"0.1.0"，符合 AC），未额外生成 zip。
3. Typecheck/lint 均通过。

验证用的 `release/` 产物（235MB dmg）已删除，未遗留在工作区或仓库中。

**遗留观察（非本 Issue 范围，供参考）**：`npm run dist:win` 本身无法在当前 Mac 环境验证——这是 PRD 里明确的已知限制（Windows 安装包必须在 Windows 主机上打包），README 中已写明。
