# 首页快捷新建角色弹窗同步新增文字风格输入框

## Description
让首页快捷新建角色表单与「我的角色」编辑弹窗保持一致，同步新增「文字风格」输入框。参见 [tasks/prd-persona-writing-style.md](../../tasks/prd-persona-writing-style.md) US-003、FR-3、FR-4。

## Acceptance Criteria
- [x] [HomeScreen.tsx](../../src/screens/home/HomeScreen.tsx) 的快捷新建角色表单（`modalMode === 'quick-role'`）新增与 Issue #077 一致的「文字风格」输入框
- [x] 保存时把文字风格内容一并写入 `persona.create` 调用
- [x] Typecheck/lint 通过
- [x] Verify in a browser（e.g. via the `run` skill）

## Dependencies
Issue #076（角色数据层支持文字风格字段）

## Type
frontend

## Priority
medium
