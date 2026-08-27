# 自动创建 GitHub Release 并附加安装包

## Description
构建成功后自动创建对应版本 tag 的 GitHub Release，把 macOS 和 Windows 安装包挂上去，任何人凭链接即可下载，无需开发者手动构建、手动上传。

## Acceptance Criteria
- [ ] `build` job 成功后，自动创建（或更新，若同名 Release 已存在）一个 GitHub Release，`tag_name` 与 `release name` 等于推送的 tag（如 `v1.0.0`）
- [ ] Release 中附加两个资产文件：macOS 的 `.dmg` 与 Windows 的安装向导 `.exe`
- [ ] tag 名称包含 `-`（如 `v1.0.0-rc1`）时，Release 自动标记为 "pre-release"；不含 `-` 的正式版本号（如 `v1.0.0`）标记为正式 Release
- [ ] Release 说明使用 GitHub 默认的基于提交记录自动生成的 Release Notes
- [ ] release workflow 的 `GITHUB_TOKEN` 显式声明 `permissions: contents: write`，确保有权限创建 Release 与上传资产
- [ ] 在 GitHub 仓库的 Releases 页面能看到新发布的 Release，两个安装包均可点击直接下载

## Dependencies
Issue #3

## Type
infra

## Priority
high

## Source
tasks/prd-github-actions-release-ci.md — US-004
