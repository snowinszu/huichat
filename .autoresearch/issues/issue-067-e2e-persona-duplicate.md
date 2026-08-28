# 端到端测试——角色复制完整流程

## Description
覆盖角色复制的完整链路（UI → IPC → 数据库），确保命名去重与副本独立性不回归。参见 [tasks/prd-persona-duplicate.md](../../tasks/prd-persona-duplicate.md) US-005。

## Acceptance Criteria
- [x] E2E 测试创建一个角色「测试角色」，点击其复制按钮，断言列表中出现名为「测试角色副本」的新卡片，且原卡片仍然存在且内容不变
- [x] 断言新卡片的 usageCount 为 0（显示「暂未使用」）
- [x] 覆盖边界场景：对同一角色再次点击复制，断言第二个副本被命名为「测试角色副本2」（去重逻辑生效）
- [x] 测试在 CI 中运行并通过
- [x] 测试自行创建和清理所需的角色数据，不依赖既有数据库状态

## Dependencies
Issue #065（后端支持复制角色）, Issue #066（角色卡片复制按钮与交互）

## Type
fullstack

## Priority
medium
