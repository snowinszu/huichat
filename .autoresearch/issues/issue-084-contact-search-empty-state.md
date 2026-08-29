# 搜索无匹配结果时的空状态

## Description
当搜索框非空但没有任何联系人的昵称匹配时，展示一个区别于"还没有聊天对象"的独立空状态提示，避免用户误以为联系人被清空或应用出错。

## Acceptance Criteria
- [x] 当搜索框非空且没有任何联系人匹配时，页面显示与"还没有聊天对象"不同的提示文案（例如"未找到匹配的聊天对象"）
- [x] 该空状态下不展示"新建聊天对象"/"新建第一个聊天对象"引导按钮
- [x] 该空状态下可以直接清空搜索词（复用输入框自带的 × 按钮）以返回完整列表
- [x] Typecheck/lint 通过
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
issue-082

## Type
frontend

## Priority
medium
