# 统计页面分布图表（24 小时 + 星期分布）

## Description
在统计页面新增两个柱状图区块：一天 24 小时的消息分布，以及周一到周日的消息分布。两者都来自 #31 计算好的分桶数据，是同一页面区块的同类展示工作，合并为一个 issue。

## Acceptance Criteria
- [x] 以柱状图展示 0-23 时 each 小时的消息总数（self + other 合计，按本地时间分桶）
- [x] 全部小时消息数为 0 时，图表仍正常渲染（各柱为 0），不报错
- [x] 以柱状图展示周一至周日（本地时间）each 天的消息总数（self + other 合计），星期顺序固定为周一 → 周日
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g. via the `run` skill)

## Implementation Notes
- 未引入图表库——两个分布图都是一个小型内联 `BarChart` 组件（纯 CSS flexbox + 高度百分比），避免为 24/7 根柱子的简单图表引入依赖
- `barChart` 容器 `overflow-x: auto`，每根柱子 `flex: 1 0 20px`——窄屏（mobile-first）下横向滚动查看全部 24 根小时柱，而不是把柱子压缩到不可辨认的宽度
- 空数据时 `Math.max(1, ...values)` 保证分母不为 0，全部柱子渲染为 0 高度而非除零报错
- 与 #33 使用同一个 `stats` fetch 结果，未新增额外的数据请求

## Dependencies
Issue #31, Issue #32

## Type
frontend

## Priority
medium

## PRD Reference
tasks/prd-chat-stats.md — US-004, US-005, FR-12, FR-13
