# 按昵称实时过滤联系人

## Description
基于 issue-081 加入的搜索输入框，实现按昵称（`name` 字段）实时、不区分大小写的子串过滤，且过滤完全在前端内存中完成，不新增 IPC/数据库调用。

## Acceptance Criteria
- [x] 每次在搜索框中键入字符时（无需回车或点击按钮），列表立即只显示 `name` 字段包含输入内容的联系人卡片，匹配不区分大小写
- [x] 输入内容仅为空白字符（如全部是空格）时按空查询处理，展示未过滤的完整列表
- [x] 通过点击 × 按钮或手动删空输入框内容清空搜索后，列表恢复为搜索前的完整内容，且分组展开/折叠状态与搜索前保持一致
- [x] 过滤逻辑完全在客户端内存中完成（基于已加载的 `cards` state），不新增 IPC/数据库调用
- [x] Typecheck/lint 通过
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
issue-081

## Type
frontend

## Priority
high
