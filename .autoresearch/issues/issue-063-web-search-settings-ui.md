# 设置页联网搜索开关与 Key 管理 UI

## Description
在设置页新增"联网搜索"卡片，让用户自己开启/关闭联网搜索并管理 Tavily API Key。交互模式复用两个已有成熟模式的组合：Toggle 开启触发信息录入弹窗（对齐"导出提示词调试日志"开启时先选目录的套路）+ Modal 内用 `PasswordInput` 录入密钥（对齐"设置锁屏密码"弹窗）。

## Acceptance Criteria
- [ ] 设置页（`src/screens/settings/SettingsScreen.tsx`）新增"联网搜索"卡片，含 `Toggle`（label"联网搜索"，description 说明用途及需要 Tavily API Key）
- [ ] 开启开关且当前未保存过 Key 时，弹出 `Modal`（复用 `PasswordInput`，交互方式对齐现有"设置锁屏密码"弹窗）录入 Tavily API Key，确认后一次性 `appPreference.update({ webSearchEnabled: true, webSearchApiKey })`；已保存过 Key 时点击开关直接走普通 toggle 保存
- [ ] Key 已设置时展示掩码预览（复用 `src/screens/models/providerMeta.ts` 的 `maskApiKey`）与"更改 Key"按钮，点击复用同一个 Modal 重新录入
- [ ] 关闭开关时仅更新 `webSearchEnabled: false`，不清除已保存的 Key（下次开启无需重新输入）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

## Dependencies
Issue #59

## Type
frontend

## Priority
medium

## Source
tasks/prd-web-search-reply.md — US-005
