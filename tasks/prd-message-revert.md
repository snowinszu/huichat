# PRD: 聊天消息回退功能

## 1. Introduction/Overview

在聊天对象的消息列表（[ChatScreen.tsx](../src/screens/chat/ChatScreen.tsx)）中，每条消息目前只有「删除」操作，只能逐条删除单条消息。当用户想清空某条消息之后的所有内容（例如聊歪了想从某个节点重新聊起），需要逐条手动删除，非常繁琐。

本功能在每条消息的操作区新增一个「回退」按钮：点击后，该消息**本身保留**，但它之后的所有消息（包括标注类消息）都会被永久删除，相当于把对话"回退"到这条消息刚发出时的状态。

## 2. Goals

- 用户可以一键清空某条消息之后的所有后续消息，无需逐条删除
- 回退操作不可逆，必须有二次确认，避免误触导致数据丢失
- 回退不影响被点击的消息本身及其之前的所有消息

## 3. User Stories

### US-001: 后端支持"回退到此消息"
**Description:** As a developer, I need a repository method that deletes every message after a given message (within the same chat card) while keeping that message itself, so the UI has a single call to perform the bulk delete.

**Acceptance Criteria:**
- [ ] 新增 `revertToMessage(db, messageId): number`（[messageRepository.ts](../electron/main/db/messageRepository.ts)），删除同一 `chat_card_id` 下，`(created_at, id)` 严格大于目标消息 `(created_at, id)` 的所有消息，返回实际删除的条数
- [ ] 目标消息本身不会被删除
- [ ] 目标消息 id 不存在时返回 `0`，不抛错（与 `deleteMessage` 的幂等约定一致）
- [ ] 新增 IPC channel `message:revert`，在 [register.ts](../electron/main/ipc/register.ts) 注册 handler
- [ ] [preload/index.ts](../electron/preload/index.ts) 暴露 `window.api.message.revert(id): Promise<number>`
- [ ] Typecheck/lint 通过

### US-002: 消息列表新增「回退」按钮与二次确认
**Description:** As a user, I want a "回退" button next to each message's delete button so I can clear everything after a chosen point in the conversation, with a clear warning before it happens.

**Acceptance Criteria:**
- [ ] 每条消息行在现有「删除消息」图标按钮旁新增「回退」图标按钮，可见性/悬浮行为与现有删除按钮一致
- [ ] 该消息是当前对话最后一条消息时（其后没有任何消息），「回退」按钮不显示（回退 0 条消息没有意义）
- [ ] 点击「回退」弹出确认对话框，明确显示将删除其后的消息条数（如"将删除此消息之后的 3 条消息，此操作无法撤销"）
- [ ] 取消确认对话框后，消息列表不发生任何变化
- [ ] 确认后调用 `window.api.message.revert(id)`，成功后从本地消息列表中移除被删除的那些消息（无需整页刷新），并展示成功提示（如"已回退，删除了 3 条消息"）
- [ ] 调用失败时展示错误提示，消息列表保持不变
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g. via the `run` skill）

### US-003: End-to-end test of message revert flow
**Description:** As a QA engineer, I want an automated end-to-end test covering the full message-revert journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试在一个聊天对象下添加至少 4 条消息，对中间某条消息点击「回退」，确认对话框中显示的待删除条数与实际后续消息数一致
- [ ] 确认删除后，断言该消息及其之前的消息仍然存在，其后的消息全部从界面消失
- [ ] 断言离开聊天页面再重新进入后，被删除的消息不会重新出现（验证是真实的数据库删除而非仅本地状态更新）
- [ ] 覆盖边界场景：对话中最后一条消息不显示「回退」按钮
- [ ] 测试在 CI 中运行并通过
- [ ] 测试自行创建和清理所需的聊天对象与消息数据，不依赖既有数据库状态

## 4. Functional Requirements

- FR-1: 系统必须提供一个方法，删除指定消息之后（按 `created_at` 升序，`id` 作为同毫秒时间戳下的次序）的所有消息，并保留该消息本身
- FR-2: 该删除范围必须限定在同一个聊天对象（`chat_card_id`）内
- FR-3: 系统必须在每条消息行提供「回退」按钮，位置紧邻现有「删除」按钮
- FR-4: 当消息是对话中的最后一条时，系统必须隐藏该消息的「回退」按钮
- FR-5: 点击「回退」时，系统必须先弹出确认对话框，并展示将被删除的消息数量，用户确认后才真正执行删除
- FR-6: 删除成功后，系统必须从当前显示的消息列表中移除对应消息，且再次加载该聊天对象时这些消息不会重新出现

## 5. Non-Goals (Out of Scope)

- 不提供"撤销回退"（即回退操作本身没有反悔机制，被删除的消息无法恢复）
- 不允许编辑或修改被回退保留的消息内容
- 不影响尚未发送/尚未插入数据库的 AI 候选回复草稿状态
- 不支持批量选择多条消息后统一回退，只针对单条消息的"回退到此处"操作

## 6. Design Considerations

- 复用现有「删除消息」的 `IconButton`（[ChatScreen.tsx:457-466](../src/screens/chat/ChatScreen.tsx#L457-L466)）尺寸、hover 行为与放置方式，「回退」按钮紧邻其左侧或右侧
- 复用现有 `ConfirmDialog` 组件（参照消息删除确认弹窗 [ChatScreen.tsx:680](../src/screens/chat/ChatScreen.tsx#L680) 的写法）
- 图标可复用已有的 `IconRefresh`（[icons.tsx](../src/components/ui/icons.tsx)），避免新增图标资源

## 7. Technical Considerations

- SQL 删除条件必须用 `(created_at, id)` 元组比较（而非仅 `created_at`），因为同一毫秒内可能插入多条消息，需要用 `id` 作为确定性的次序依据 —— 与现有 `listMessagesByChatCard` 的 `ORDER BY created_at ASC, id ASC` 排序约定保持一致
- 待删除数量可直接从前端已加载的 `messages` 状态数组中按目标消息在数组中的位置计算（`messages.length - index - 1`），无需为此新增一个"预览计数"的后端接口

## 8. Success Metrics

- 用户清空某条消息之后的所有内容，只需 2 次点击（回退 → 确认），而不是逐条删除
- 回退操作的确认弹窗能准确反映将删除的消息数量，误删投诉为零

## 9. Open Questions

- 无
