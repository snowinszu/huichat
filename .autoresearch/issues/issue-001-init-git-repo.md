# 初始化本地 Git 仓库并关联 GitHub 远程

## Description
本地目录还不是 git 仓库，也未关联 `https://github.com/snowinszu/huichat`，是后续所有 GitHub Actions workflow 能运行的前提条件。

## Acceptance Criteria
- [ ] `git init`，`git remote -v` 显示 `origin` 指向 `https://github.com/snowinszu/huichat`
- [ ] `.gitignore` 已覆盖 `node_modules`、`dist`、`dist-electron`、`release` 等构建产物目录（复用现有配置，无需新增）
- [ ] 首次提交推送到远程 `main` 分支成功，GitHub 仓库页面能看到完整源码
- [ ] Typecheck/lint 通过

## Dependencies
None

## Type
infra

## Priority
high

## Source
tasks/prd-github-actions-release-ci.md — US-001
