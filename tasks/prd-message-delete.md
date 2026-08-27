# PRD: 聊天消息删除（撤销）功能

## 1. Introduction/Overview

在聊天详情页（[ChatScreen.tsx](../src/screens/chat/ChatScreen.tsx)）中，用户可以手动粘贴"对方消息"、手动输入"我的消息"、添加图片/表情标注，也可以把 AI 生成的候选回复一键加入对话。这些都是纯手动/一键操作，一旦点错发送方、粘贴错内容、或误点"加入对话"，消息就会永久留在历史记录里，且没有任何撤回方式，只能继续将错就错，污染后续 AI 生成回复所依赖的上下文。

本功能为消息历史中的每一条记录（对方消息、我的消息、图片/表情标注）新增"删除"入口，删除前二次确认，确认后同步从本地 SQLite 数据库中彻底移除该条记录，从根源上解决"手滑加错消息"且无法挽回的问题。

## 2. Goals

- 让用户可以对聊天历史中的任意一条消息（不限时间、不限类型）发起删除。
- 删除前提供二次确认，避免误触删除本身。
- 删除后消息从数据库彻底清除，重启应用或重新打开该聊天卡片也不会再出现。
- 删除操作不影响其余消息的顺序、时间戳和后续 AI 生成回复的正常工作。

## 3. User Stories

### US-001: 消息删除后端能力（IPC + 数据库）
**Description:** As a developer, 我需要新增一个 `message:delete` IPC 通道和对应的数据库删除方法，以便前端可以请求彻底删除某条消息。

**Acceptance Criteria:**
- [ ] `electron/shared/ipc-types.ts` 的 `IPC_CHANNELS` 新增 `messageDelete: 'message:delete'`
- [ ] `electron/main/db/messageRepository.ts` 新增 `deleteMessage(db, messageId: number): void`（或返回是否成功的布尔值），执行 `DELETE FROM message WHERE id = ?`
- [ ] `electron/main/ipc/register.ts` 注册 `ipcMain.handle(IPC_CHANNELS.messageDelete, ...)`，接收 `messageId: number`，调用仓储方法
- [ ] preload 层暴露 `window.api.message.delete(messageId: number): Promise<void>`，与现有 `message.insert` / `message.listByChatCard` 风格一致
- [ ] 删除一个不存在的 `messageId` 时不抛出异常，静默视为已删除（幂等）
- [ ] Typecheck/lint 通过

### US-002: 消息列表中显示删除入口
**Description:** As a user, 我希望在每一条消息（对方消息、我的消息、标注）上能看到删除按钮，以便定位到需要撤回的那一条。

**Acceptance Criteria:**
- [ ] 每条消息行（`.msgRow`，含 `MessageBubble` 和 `AnnotationNote` 两种渲染形式）鼠标悬停时在气泡旁显示一个删除图标按钮；触屏/无 hover 环境下始终可见（不依赖 hover 才能操作）
- [ ] 删除图标使用现有图标风格（参考 `IconButton` 组件），不遮挡消息文本或翻译备注
- [ ] 删除按钮的可点击区域不小于 24x24px，避免误触旁边内容
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g., via the `run` skill）

### US-003: 删除二次确认与执行
**Description:** As a user, 我希望点击删除后先看到确认提示，确认后该消息才真正从历史和数据库中移除，避免手滑误删。

**Acceptance Criteria:**
- [ ] 点击某条消息的删除按钮后，弹出确认对话框，明确提示"确定删除这条消息？删除后无法恢复"
- [ ] 确认对话框展示被删除消息的内容摘要（文本消息截断预览，或标注类型+说明文字），帮助用户确认删对了目标
- [ ] 点击"取消"或对话框外区域关闭时，消息保持不变
- [ ] 点击"确定删除"后调用 `window.api.message.delete(messageId)`，成功后立即从 `messages` 状态数组中移除该条，历史列表实时更新，无需刷新页面
- [ ] 删除失败时（如无 Electron 桥接、DB 异常）通过 `showToast` 提示错误信息，消息保留在列表中不做乐观移除
- [ ] 连续删除多条消息时，每条都需要各自独立确认（不做批量跳过）
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g., via the `run` skill）

### US-004: 删除对 AI 生成回复上下文的影响
**Description:** As a user, 我希望删除某条历史消息后，之后再次点击"生成回复"时，AI 不会再参考已删除的那条消息。

**Acceptance Criteria:**
- [ ] 删除消息后，`window.api.reply.generate` / `window.api.reply.polish` 的对话上下文来源于删除后最新的 `message` 表数据，不包含已删除的记录
- [ ] 删除的是最新一条"对方消息"后，再次生成回复时不会报错，而是基于剩余最新的消息继续工作（若删空后没有任何"对方消息"，沿用现有的空历史处理逻辑，不新增特殊报错）
- [ ] Typecheck/lint 通过

### US-005: 端到端测试——消息删除完整流程
**Description:** As a QA engineer, 我需要一个自动化端到端测试覆盖"添加消息 → 删除消息 → 确认从数据库移除"的完整链路，防止未来改动引入回归。

**Acceptance Criteria:**
- [ ] E2E 测试添加一条"对方消息"和一条"我的消息"，进入历史列表后各自触发删除、确认弹窗、点击确认，断言两条消息都从界面上消失
- [ ] E2E 测试断言删除后重新加载该聊天卡片（重新调用 `message.listByChatCard` 或刷新页面）时，被删除的消息不会重新出现，验证数据库记录已被真正清除
- [ ] 覆盖至少一个边界/失败路径：点击删除后在确认弹窗中选择"取消"，断言消息仍然保留在列表中
- [ ] 测试在 CI 中可运行并通过
- [ ] 测试自行创建并清理所需的聊天卡片和消息数据，不依赖测试执行顺序

## 4. Functional Requirements

- FR-1: 系统必须在 `IPC_CHANNELS` 中新增 `messageDelete` 通道，并在主进程注册对应 handler。
- FR-2: 系统必须在 `messageRepository.ts` 中提供按 `id` 删除单条消息记录的数据库方法。
- FR-3: 系统必须在 preload 的 `window.api.message` 上暴露 `delete(messageId: number)` 方法。
- FR-4: 系统必须在聊天历史的每一条消息行（`other` / `self` / `annotation` 三种角色）上展示删除入口。
- FR-5: 系统必须在用户点击删除入口后弹出二次确认对话框，展示待删除消息内容摘要。
- FR-6: 系统必须仅在用户在确认对话框中点击"确定"后才执行删除。
- FR-7: 系统必须在删除成功后将该消息从当前 `messages` 状态中移除，使界面立即反映最新历史。
- FR-8: 系统必须在删除失败时通过 toast 提示错误，并保持该消息在列表中不变。
- FR-9: 系统必须保证删除操作是对数据库的真实物理删除（而非软删除/前端隐藏），确保重新查询该聊天卡片消息列表时不再包含被删除的记录。
- FR-10: 系统必须保证删除某条消息不影响其余消息的顺序与时间戳显示。

## 5. Non-Goals (Out of Scope)

- 不做"撤销的撤销"（即删除后不提供恢复/找回已删除消息的功能，删除即永久生效）。
- 不做批量多选删除（一次仅删除一条，需分别确认）。
- 不做编辑消息内容的功能（本 PRD 只处理删除，不处理修改文本）。
- 不做添加消息后几秒内的 toast 快速撤销（已在澄清问题中确定采用"随时可删除"方案，取代该方案）。
- 不涉及短期目标（`shortTermGoal`）、聊天卡片本身、模型配置等其他实体的删除/撤销。

## 6. Design Considerations

- 复用现有 `IconButton` 组件样式实现删除图标按钮，视觉上与返回按钮、图片/表情说明按钮保持一致的图标语言。
- 确认对话框可复用项目内已有的弹窗/Modal 模式（若已有 `AnnotationNote` 弹出面板一类的浮层组件可参考其样式），无需引入新的弹窗库。
- 删除按钮在 `self` 消息行（靠右对齐）和 `other`/`annotation` 消息行（靠左对齐，带头像）中都需要合理放置，不与头像、翻译备注（`TranslationNote`）重叠。
- 移动端优先：删除按钮触控区域按最小 44x44pt（或项目现有触控规范）设计，不能仅依赖 hover 才能触发。

## 7. Technical Considerations

- 需修改的核心文件：
  - `electron/shared/ipc-types.ts`（新增 channel 常量）
  - `electron/main/db/messageRepository.ts`（新增 `deleteMessage`）
  - `electron/main/ipc/register.ts`（注册 handler）
  - `electron/preload`（暴露 `message.delete`）
  - `src/screens/chat/ChatScreen.tsx`（渲染删除入口、确认弹窗、调用 API、更新本地状态）
- 现有 `handleAddMessage` / `handleAddAnnotation` / `handleAddReplyToThread` 都通过 `setMessages((current) => [...current, inserted])` 追加消息；删除需要对称地实现 `setMessages((current) => current.filter((m) => m.id !== deletedId))`。
- AI 回复生成（`reply.generate` / `reply.polish`）的上下文读取应确认其数据来源于 `message` 表实时查询（而非缓存的历史快照），删除后自然生效，无需额外改动生成逻辑本身（US-004 主要是验证，不一定需要新代码）。

## 8. Success Metrics

- 用户从点击删除到消息从历史中消失、且重新打开该聊天卡片后不再出现，全流程操作不超过 2 次点击（删除 + 确认）。
- 删除功能上线后，用户对"加错消息导致回复生成不准"的相关反馈/客诉下降。

## 9. Open Questions

- 确认对话框的具体交互组件（原生 `confirm()` 还是自定义 Modal）由实现阶段决定，是否已有可复用的 Modal 组件需要在开发前确认。
- 是否需要为"标注"类型消息的确认摘要做特殊截断/展示规则（当前假设与文本消息一致，按文字长度截断）。
