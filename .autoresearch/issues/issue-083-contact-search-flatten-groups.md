# 搜索时将分组视图展平为单一网格

## Description
当搜索处于激活状态（issue-082 的过滤逻辑）时，忽略分组结构，把所有匹配的联系人卡片合并展示在同一个网格里，避免用户需要逐个展开折叠的分组去查找匹配结果。清空搜索后需恢复到搜索前的分组视图及各分组的折叠/展开状态。

## Acceptance Criteria
- [x] 当搜索框内容非空时，无论当前有多少个分组、哪些分组处于折叠状态，所有匹配的联系人卡片都合并展示在同一个网格中（复用 [ContactCardGrid](src/components/ui/ContactCard/ContactCard.tsx)），不再显示分组标题
- [x] 搜索激活期间，分组标题、展开/折叠箭头、每组人数、分组的重命名/删除按钮均不显示
- [x] 清空搜索框后，视图恢复为搜索前的分组展示，且每个分组区块此前的折叠/展开状态（`collapsedSections` state）不变
- [x] Typecheck/lint 通过
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
issue-082

## Type
frontend

## Priority
medium
