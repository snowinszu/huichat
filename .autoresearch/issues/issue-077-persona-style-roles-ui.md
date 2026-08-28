# 我的角色编辑弹窗新增文字风格输入框

## Description
在「我的角色」新建/编辑弹窗新增「文字风格」多行输入框。参见 [tasks/prd-persona-writing-style.md](../../tasks/prd-persona-writing-style.md) US-002、FR-2、FR-4。

## Acceptance Criteria
- [x] [RolesScreen.tsx](../../src/screens/roles/RolesScreen.tsx) 的新建/编辑角色弹窗在「角色的基本信息」下方新增「文字风格」多行文本框，placeholder 提示示例（如"一般不加标点符号、习惯每句话结束都加表情"）
- [x] 该字段为可选项，留空时不影响保存
- [x] 保存时把文字风格内容一并写入 `persona.create`/`persona.update` 调用
- [x] 重新打开编辑弹窗时，已保存的文字风格内容正确回显
- [x] Typecheck/lint 通过
- [x] Verify in a browser（e.g. via the `run` skill）

## Dependencies
Issue #076（角色数据层支持文字风格字段）

## Type
frontend

## Priority
high
