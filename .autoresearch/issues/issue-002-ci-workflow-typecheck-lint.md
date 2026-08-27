# 新增 push/PR 质量检查 workflow

## Description
每次 push 到 `main` 分支或提交 PR 到 `main` 分支时，自动运行 typecheck 和 lint，快速发现代码问题，作为后续打包发布前的质量门禁基础。

## Acceptance Criteria
- [ ] 新增 `.github/workflows/ci.yml`，触发条件为 `push` 到 `main` 分支与 `pull_request` 目标为 `main` 分支
- [ ] Workflow 使用 `.nvmrc` 中指定的 Node 版本（22.20.0）
- [ ] 依赖安装使用 `npm ci --ignore-scripts`（跳过 `postinstall` 的原生模块编译，typecheck/lint 不需要可运行的 `better-sqlite3` 二进制，且 Linux runner 未配置原生编译工具链）
- [ ] 依次执行 `npm run typecheck` 与 `npm run lint`，任一失败则整个 workflow 标记为失败
- [ ] 在 GitHub 仓库的 Actions 页面能看到该 workflow 的运行记录与结果状态

## Dependencies
Issue #1

## Type
infra

## Priority
high

## Source
tasks/prd-github-actions-release-ci.md — US-002
