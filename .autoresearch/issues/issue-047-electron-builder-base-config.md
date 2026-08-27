# 安装并配置 electron-builder 基础依赖

## Description
引入 electron-builder 作为开发依赖，新增独立的 `electron-builder.yml` 配置文件，为后续原生模块处理、打包脚本、图标接入提供基础配置骨架。

## Acceptance Criteria
- [x] `electron-builder` 作为 devDependency 安装，版本与现有 Electron 43 / Node >=22.12 兼容
- [x] 新增 `electron-builder.yml`，指定 `appId`（如 `com.huichat.app`）、`productName`（"会聊"）、`directories.output: release`
- [x] `files` 字段只打包 `dist/`、`dist-electron/`、`package.json` 等运行所需文件，排除源码、`e2e/`、`tasks/`、`.autoresearch/` 等开发目录
- [x] Typecheck/lint 通过

## Dependencies
None

## Type
infra

## Priority
high

## Source
tasks/prd-electron-builder-packaging.md — US-001

## Verification Notes
安装 `electron-builder@26.15.3` 作为 devDependency，新增 `electron-builder.yml`（`appId: com.huichat.app`、`productName: 会聊`、`directories.output: release`、`files` 只含 `dist/**/*`、`dist-electron/**/*`、`package.json`）。`typecheck`/`lint` 均通过。

额外用 `npx electron-builder build --config electron-builder.yml --dir --publish never --mac` 做了一次本地 dry-run 打包（`--dir` 只产出未压缩的 `.app`，不生成正式安装包，跑完即删除了 `release/` 产物），确认配置文件能被正确加载、`better-sqlite3` 原生模块 rebuild 成功、打包流程本身走通，退出码为 0。

**注意事项（留给依赖此 Issue 的后续 Issue #48/#49/#51）：**
- 本机 shell 默认 Node 版本是 v20.18.0，低于项目 `.nvmrc`/`engines` 要求的 v22.12+，会导致 electron-builder 依赖链（`@noble/hashes` 等）因 Node 不支持 `require(esm)` 而报 `ERR_REQUIRE_ESM`。需 `nvm use` 切到 v22.20.0 后 electron-builder 才能正常运行——后续 Issue 的打包脚本执行环境需确保 Node 版本正确。
- electron-builder 打印了警告：`@electron/rebuild already used by electron-builder, please consider to remove excess dependency from devDependencies`，并建议用 `electron-builder install-app-deps` 替代现有 `postinstall` 里的 `electron-rebuild -f -w better-sqlite3`。这个改动涉及原生模块 rebuild 策略，留给 Issue #48 处理，本 Issue 未改动 `postinstall`。
- dry-run 时 electron-builder 在本机 keychain 里自动发现了一个 Apple Development 签名身份并对 `.app` 做了签名（尽管 PRD 明确本期不做代码签名）。这是 electron-builder 的默认自动检测行为，Issue #48/#49 正式实现 `dist:mac` 时需要显式配置 `mac.identity: null`（或等效方式）关闭自动签名，避免产出一个"意外签名但未公证"的不一致安装包。
- 警告 `author is missed in the package.json`：不影响打包，未处理，非本 Issue 验收范围。
