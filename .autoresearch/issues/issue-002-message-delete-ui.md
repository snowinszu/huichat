# 消息删除 UI（入口 + 二次确认 + 执行）

## Description
在 `src/screens/chat/ChatScreen.tsx` 的消息历史列表中，为每一条消息（`other` / `self` / `annotation` 三种角色）添加删除入口，点击后弹出二次确认对话框（展示待删内容摘要），确认后调用后端删除 API 并将该条消息从本地 `messages` 状态中移除。

来源：`tasks/prd-message-delete.md` — US-002、US-003（合并为一个 Issue，因为二者是同一批互相依赖的 UI 改动：有删除按钮才能触发确认弹窗）

## Acceptance Criteria
- [x] 每条消息行（`.msgRow`，含 `MessageBubble` 和 `AnnotationNote` 两种渲染形式）鼠标悬停时在气泡旁显示删除图标按钮；触屏/无 hover 环境下按钮始终可见
- [x] 删除按钮可点击区域不小于 24x24px（触屏环境建议 44x44pt），不遮挡消息文本或翻译备注
- [x] 点击删除按钮后弹出确认对话框，明确提示"确定删除这条消息？删除后无法恢复"，并展示被删除消息的内容摘要（文本消息截断预览，或标注类型+说明文字）
- [x] 点击"取消"或对话框外区域关闭时，消息保持不变
- [x] 点击"确定删除"后调用 `window.api.message.delete(messageId)`，成功后立即从 `messages` 状态数组中移除该条（`setMessages((current) => current.filter((m) => m.id !== deletedId))`），历史列表实时更新
- [x] 删除失败时（如无 Electron 桥接、DB 异常）通过 `showToast` 提示错误信息，消息保留在列表中不做乐观移除
- [x] 连续删除多条消息时，每条都需要各自独立确认
- [x] Typecheck/lint 通过
- [x] Verify in a browser（e.g., via the `run` skill）

## Dependencies
Issue #1（消息删除后端能力）

## Type
frontend

## Priority
high
