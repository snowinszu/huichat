# 首页按分组分区展示，支持折叠/展开

## Description
首页聊天对象列表按分组拆分为多个可折叠区块，未分组卡片归入固定的「未分组」区块。参见 [tasks/prd-chat-card-grouping.md](../../tasks/prd-chat-card-grouping.md) US-003、FR-5、FR-6、FR-9、FR-10。

## Acceptance Criteria
- [x] 首页聊天对象列表按分组拆分为多个区块，每个区块标题展示分组名称和卡片数量（样式复用 [HomeScreen.module.css](../../src/screens/home/HomeScreen.module.css) 的 `.sectionHeader`/`.sectionTitle`/`.sectionCount`）
- [x] 未分组的卡片归入固定的「未分组」区块，始终排在所有自定义分组区块之后
- [x] 每个区块标题可点击折叠/展开，默认展开，折叠状态用组件内 `useState` 维护，无需持久化
- [x] 分组区块的先后顺序按分组创建时间升序排列
- [x] 区块内的卡片排序沿用现有"最近更新在前"规则（`updated_at DESC`）
- [x] 没有任何自定义分组时（所有卡片都未分组），首页展示效果与当前实现一致，不显示多余的分组标题
- [x] Typecheck/lint 通过
- [x] Verify in a browser（e.g. via the `run` skill）

## Dependencies
Issue #068（分组数据层与仓储）, Issue #069（编辑聊天对象弹窗支持选择/新建分组）

## Type
frontend

## Priority
high
