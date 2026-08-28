# 消息列表新增「回退」按钮与二次确认

## Description
在每条消息行新增「回退」按钮，点击后确认将删除的消息数量再执行。参见 [tasks/prd-message-revert.md](../../tasks/prd-message-revert.md) US-002、FR-3、FR-4、FR-5、FR-6。

## Acceptance Criteria
- [x] 每条消息行在现有「删除消息」图标按钮旁新增「回退」图标按钮，可见性/悬浮行为与现有删除按钮一致（[ChatScreen.tsx:457-466](../../src/screens/chat/ChatScreen.tsx#L457-L466)）
- [x] 该消息是当前对话最后一条消息时，「回退」按钮不显示
- [x] 点击「回退」弹出确认对话框，明确显示将删除其后的消息条数（可直接从前端已加载的 `messages` 状态数组按索引计算，无需新增后端计数接口）
- [x] 取消确认对话框后，消息列表不发生任何变化
- [x] 确认后调用 `window.api.message.revert(id)`，成功后从本地消息列表中移除被删除的消息，并展示成功提示
- [x] 调用失败时展示错误提示，消息列表保持不变
- [x] Typecheck/lint 通过
- [x] Verify in a browser（e.g. via the `run` skill）

## Dependencies
Issue #073（后端支持"回退到此消息"）

## Type
frontend

## Priority
high
