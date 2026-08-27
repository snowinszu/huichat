# 端到端验证完整的 tag → 构建 → 发布 流程

## Description
验证从推送一个真实版本 tag，到 GitHub Actions 完成跨平台构建，再到自动发布 Release 的完整链路是否可靠，包括失败路径（质量检查不通过时应阻止发布）。

## Acceptance Criteria
- [ ] 推送一个真实的测试 tag（如 `v0.1.0-rc1`）到远程仓库，触发 `release.yml`
- [ ] 在 GitHub Actions 页面确认 `verify`、`build (macos-latest)`、`build (windows-latest)` 三个 job 均以成功状态结束
- [ ] 在 GitHub Releases 页面确认生成了对应 tag 的 Release，且标记为 pre-release（因 tag 含 `-rc1`），并附带 `.dmg` 与 `.exe` 两个文件，文件大小均非 0
- [ ] 覆盖一个关键失败路径：故意在测试分支中引入一个 lint 错误后推送同格式的测试 tag，确认 `verify` job 失败、`build` job 被跳过（未执行）、且没有产生新的 Release
- [ ] 测试完成后清理产物：删除测试 tag（本地与远程）及对应的测试 Release，不在正式 Release 列表中留下垃圾数据
- [ ] Workflow 运行记录（成功与失败两种）均可在 Actions 页面复现查看，作为该 CI/CD 流程本身可回归验证的凭证

## Dependencies
Issue #1, Issue #2, Issue #3, Issue #4

## Type
infra

## Priority
medium

## Source
tasks/prd-github-actions-release-ci.md — US-005
