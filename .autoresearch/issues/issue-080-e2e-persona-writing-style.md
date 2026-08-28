# E2E 测试——角色文字风格完整流程

## Description
覆盖文字风格填写、回显、以及实际进入生成回复 prompt 的完整链路。参见 [tasks/prd-persona-writing-style.md](../../tasks/prd-persona-writing-style.md) US-005。

## Acceptance Criteria
- [x] E2E 测试创建一个角色并填写文字风格（如"每句话结尾加个哈哈"），保存后重新打开编辑弹窗，断言该内容正确回显
- [x] 测试用该角色创建聊天对象并触发一次"生成回复"，通过 mock LLM server 捕获实际发送的 prompt 文本，断言其中包含填写的文字风格内容
- [x] 覆盖边界场景：不填写文字风格时生成的 prompt 中不出现【说话习惯】小节
- [x] 测试在 CI 中运行并通过
- [x] 测试自行创建和清理所需的角色与聊天对象数据，不依赖既有数据库状态

## Dependencies
Issue #076（角色数据层支持文字风格字段）, Issue #077（我的角色编辑弹窗新增文字风格输入框）, Issue #078（首页快捷新建角色弹窗同步新增文字风格输入框）, Issue #079（文字风格写入 AI 角色设定 prompt）

## Type
fullstack

## Priority
medium
