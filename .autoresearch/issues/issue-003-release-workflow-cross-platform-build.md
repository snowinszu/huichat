# 新增 tag 触发的跨平台构建 workflow

## Description
推送版本 tag 时，在 macOS 和 Windows 云端 runner 上并行构建安装包，解决团队没有 Windows 主机、无法本地打出 Windows 安装包的问题。打包前必须先通过质量检查。

## Acceptance Criteria
- [ ] 新增 `.github/workflows/release.yml`，触发条件为推送匹配 `v*.*.*` 格式的 tag（如 `v1.0.0`、`v1.0.0-rc1`）
- [ ] Workflow 第一个 job 为 `verify`：在 `ubuntu-latest` 上执行与 Issue #2 相同的 typecheck + lint 检查
- [ ] 第二个 job 为 `build`，声明 `needs: verify`，`verify` 失败时 `build` 不会启动
- [ ] `build` job 使用矩阵（matrix）策略同时在 `macos-latest` 与 `windows-latest` 上运行，两者并行执行、互不阻塞
- [ ] macOS runner 上执行 `npm ci`（完整安装，含 `postinstall` 原生模块编译）后运行 `npm run dist:mac`，产出 `release/*.dmg`
- [ ] Windows runner 上执行 `npm ci` 后运行 `npm run dist:win`，产出 `release/*.exe`
- [ ] 任一平台构建失败时，该 workflow run 整体标记为失败，且失败日志可在 Actions 页面直接查看（不静默失败）

## Dependencies
Issue #1

## Type
infra

## Priority
high

## Source
tasks/prd-github-actions-release-ci.md — US-003
