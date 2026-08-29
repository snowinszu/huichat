# 在聊天对象页面加入常驻搜索输入框

## Description
在"聊天对象"页面（[HomeScreen.tsx](src/screens/home/HomeScreen.tsx)）的 section header 加入一个常驻搜索输入框，作为后续过滤功能的入口。仅负责 UI 呈现与本地输入状态，不涉及过滤逻辑。

## Acceptance Criteria
- [x] 在"聊天对象" section header 区域（[HomeScreen.tsx:454-465](src/screens/home/HomeScreen.tsx#L454-L465) 附近）新增一个文本输入框，placeholder 为"搜索昵称"
- [x] 只要联系人列表非空（`cards.length > 0`）该输入框就始终可见；当列表完全为空（"还没有聊天对象"空状态）时不显示搜索框
- [x] 输入框有内容时，右侧显示一个清空（×）按钮，点击后清空输入并让输入框重新获得焦点
- [x] Typecheck/lint 通过
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
None

## Type
frontend

## Priority
high
