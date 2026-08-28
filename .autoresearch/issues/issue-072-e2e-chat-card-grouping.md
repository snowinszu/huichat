# 端到端测试——聊天对象分组完整流程

## Description
覆盖创建分组、分配、折叠展开、删除回退未分组的完整链路（UI → IPC → 数据库）。参见 [tasks/prd-chat-card-grouping.md](../../tasks/prd-chat-card-grouping.md) US-005。

## Acceptance Criteria
- [x] E2E 测试创建一个聊天对象，在编辑弹窗中通过「+ 新建分组」创建分组「工作」并分配给它，断言首页出现「工作」区块且该卡片显示在其中
- [x] 断言折叠该区块后卡片被隐藏，再次点击展开后卡片重新可见
- [x] 覆盖边界场景：删除「工作」分组后，断言原卡片出现在「未分组」区块中，而不是丢失
- [x] 测试在 CI 中运行并通过
- [x] 测试自行创建和清理所需的聊天对象与分组数据，不依赖既有数据库状态

## Dependencies
Issue #068（分组数据层与仓储）, Issue #069（编辑聊天对象弹窗支持选择/新建分组）, Issue #070（首页按分组分区展示，支持折叠/展开）, Issue #071（分组重命名与删除）

## Type
fullstack

## Priority
medium
