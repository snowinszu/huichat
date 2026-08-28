# 编辑聊天对象弹窗支持选择/新建分组

## Description
在编辑/新建聊天对象弹窗（[HomeScreen.tsx](../../src/screens/home/HomeScreen.tsx)）新增「所属分组」下拉与「+ 新建分组」快捷入口，交互对齐现有「以哪个角色聊天」+「+ 新建角色」的模式。参见 [tasks/prd-chat-card-grouping.md](../../tasks/prd-chat-card-grouping.md) US-002、FR-3、FR-4。

## Acceptance Criteria
- [x] 编辑/新建聊天对象弹窗新增「所属分组」下拉选择，选项包含全部现有分组和「不分组」，布局对齐现有 `.selectRow`（[HomeScreen.tsx:424-438](../../src/screens/home/HomeScreen.tsx#L424-L438)）
- [x] 下拉旁提供「+ 新建分组」按钮，点击后在同一弹窗内切换为分组名称输入表单（复用 `modalMode` 状态机，参照 `quick-role` 的实现），保存成功后自动选中新分组并返回聊天对象表单，原有已填字段不丢失
- [x] 新建分组名称为空时显示校验错误「请填写分组名称」，不允许提交
- [x] 保存聊天对象（新建或编辑）时把选中的 `groupId` 一并写入 IPC 调用（`null` 表示不分组）
- [x] Typecheck/lint 通过
- [x] Verify in a browser（e.g. via the `run` skill）

## Dependencies
Issue #068（分组数据层与仓储）

## Type
frontend

## Priority
high
