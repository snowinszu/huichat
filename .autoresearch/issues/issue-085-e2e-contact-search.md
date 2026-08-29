# 聊天对象搜索流程端到端测试

## Description
覆盖聊天对象搜索完整链路的自动化 E2E 测试：搜索过滤、清空后状态恢复、无匹配结果的空状态。依赖 issue-081 至 issue-084 全部完成。

## Acceptance Criteria
- [x] E2E 测试创建至少两个昵称不同的聊天对象（其中至少一个属于某个分组），在搜索框中输入其中一个昵称的子串，断言只有匹配的卡片仍然可见，且分组标题不再显示
- [x] 测试清空搜索框，断言列表恢复为清空前的完整分组视图（含折叠状态）
- [x] 覆盖边缘场景：输入一个不存在的关键字，断言显示"无匹配结果"空状态而非"还没有聊天对象"空状态
- [x] Test runs in CI and passes
- [x] Test 自行创建并清理所用的聊天对象/分组数据

## Dependencies
issue-081, issue-082, issue-083, issue-084

## Type
fullstack

## Priority
medium
