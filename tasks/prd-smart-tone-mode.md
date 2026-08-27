# PRD: 语气选择器新增「智能模式」

## Introduction/Overview

现有聊天界面的语气选择器（[ChatScreen.tsx:31](../src/screens/chat/ChatScreen.tsx#L31)）提供 8 种固定语气预设（礼貌、幽默、暧昧、真诚、撒娇、高冷、简洁直接、安慰共情），用户必须手动选定其中一种才能生成候选回复或润色草稿。这要求用户每次都要自己判断"这条消息该用什么语气回"，对不熟悉聊天技巧的用户来说仍有一定门槛。

本功能在语气选择器中新增一个「智能模式」选项，**排在所有语气选项最前面，并作为默认选中项**。选中智能模式后，用户无需手动挑语气——AI 会根据当前聊天卡片的上下文（对方是谁、己方角色、聊天目标、历史消息等）自动判断当下最合适的一种语气，并用这个语气生成 3 条候选回复或润色草稿。用户始终可以随时点击某个具体语气 chip 切换回手动模式。

## Goals

- 降低"选语气"这一步的决策成本，让新手用户开箱即用
- 让"生成回复"“润色”默认可用（不再要求用户先手动选语气才能点击）
- 保留现有 8 种预设语气 + 自定义语气的手动选择能力，二者可自由切换
- 智能模式生成结果与手动选择语气生成的结果在展示形式上保持一致，不引入额外 UI 复杂度

## User Stories

### US-001: 语气选择器新增「智能模式」并默认选中
**Description:** As a user, I want a "智能模式" option at the front of the tone selector, selected by default, so I can generate a reply without first deciding on a tone myself.

**Acceptance Criteria:**
- [ ] 语气选择器的选项列表中新增「智能模式」chip，渲染顺序固定在最前面（早于礼貌/幽默等 8 个预设及自定义语气）
- [ ] 进入聊天卡片对话界面时，`selectedTone` 默认即为「智能模式」，无需用户手动点击即可使用
- [ ] 「智能模式」与其余语气 chip（预设 + 自定义）互斥单选：点击任意其它语气会取消「智能模式」的选中状态，反之点击「智能模式」会取消其它语气的选中状态
- [ ] 「生成回复」「润色」按钮在默认状态（智能模式已选中）下即为可点击（不再要求用户先手动选语气才解锁按钮）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-002: 智能模式下自动判断语气并生成候选回复
**Description:** As a user, I want the AI to infer the most fitting tone from the conversation context when I generate replies in smart mode, so the 3 candidates already match the situation without me picking a tone.

**Acceptance Criteria:**
- [ ] 智能模式选中时点击"生成回复"，请求会将"智能模式"作为语气标识传给后端（区别于自由文本语气值，避免与用户自定义同名语气冲突）
- [ ] 后端在构造生成回复的 prompt 时，针对该标识替换为"请结合对话上下文自动判断最合适的一种语气"的指令，而不是把标识字面值当作语气名称拼入 prompt
- [ ] LLM 依据聊天卡片上下文（对方信息/己方角色/最终目标/短期目标/历史消息）判断出唯一一种语气，返回的 3 条候选回复内容不同、但语气保持统一（与现有手动选择语气时的"同语气 3 条内容"逻辑一致）
- [ ] 候选回复的展示方式与手动选择语气时完全一致，**不显示** AI 判断出的具体语气名称
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-003: 智能模式下"重新生成"允许语气重新判断
**Description:** As a user, I want each "重新生成" click in smart mode to re-evaluate the best tone, so the suggestion can adapt if my sense of the conversation changes.

**Acceptance Criteria:**
- [ ] 智能模式下点击"重新生成"，使用相同上下文重新发起一次生成请求，后端每次独立判断语气，不缓存或复用上一次判断出的语气
- [ ] 因此同一张卡片内连续多次"重新生成"，AI 判断出的语气可以不同，也可以相同——由 AI 依据当次判断结果决定
- [ ] 前端不需要感知、存储或展示判断出的语气，只需正常渲染新一轮的 3 条候选内容
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-004: 智能模式下自动判断语气并润色草稿
**Description:** As a user, I want polishing a draft in smart mode to also auto-infer the tone from context and the draft itself, so I don't have to switch to manual tone selection just to polish.

**Acceptance Criteria:**
- [ ] 智能模式选中时点击"润色"，请求同样携带"智能模式"标识而非具体语气文本
- [ ] 后端构造润色 prompt 时，结合草稿内容 + 聊天卡片上下文，指示 LLM 自动判断最合适的语气后再润色
- [ ] 润色结果的展示方式与手动选择语气时一致，不显示 AI 判断出的具体语气名称
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-005: 端到端测试——智能模式完整流程
**Description:** As a QA engineer, I want an automated end-to-end test covering the full smart-mode journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试打开一张聊天卡片，断言语气选择器默认选中「智能模式」且「生成回复」按钮可点击（无需手动选语气）
- [ ] 测试点击"生成回复"，断言返回 3 条内容不同的候选回复，且请求负载中语气字段为智能模式标识而非某个具体预设语气
- [ ] 测试在候选回复上点击"重新生成"，断言重新发起了一次生成请求并返回新的 3 条候选内容
- [ ] 测试切换到手动选择某个预设语气（如"简洁直接"），断言「智能模式」chip 变为未选中，且后续生成请求携带该预设语气文本
- [ ] 覆盖边界场景：草稿输入区在智能模式下点击"润色"，断言润色请求携带智能模式标识并返回润色结果
- [ ] 测试运行于 CI 并通过
- [ ] 测试独立可重复运行，自行创建和清理所需的聊天卡片数据

## Functional Requirements

- FR-1: 系统必须在语气选择器的选项列表中新增「智能模式」，且渲染顺序固定为第一位
- FR-2: 系统必须在用户进入聊天卡片对话界面时，将「智能模式」设为语气选择的默认值
- FR-3: 系统必须保证「智能模式」与其它语气选项（预设 8 种 + 自定义语气）互斥单选
- FR-4: 系统必须在「智能模式」被选中时，使「生成回复」与「润色」按钮无需额外操作即可点击
- FR-5: 系统必须为「智能模式」使用独立于自由文本的标识传递给后端，避免与用户自定义语气的同名文本冲突
- FR-6: 系统必须在收到「智能模式」标识时，将生成回复 prompt 中的语气指令替换为"根据对话上下文自动判断最合适的语气"，而非把标识值当作语气名称直接拼入 prompt
- FR-7: 系统必须保证智能模式下生成的 3 条候选回复语气统一、内容不同，判断逻辑与现有"选定语气→3条同语气回复"一致
- FR-8: 系统必须在收到「智能模式」标识时，将润色 prompt 中的语气指令替换为"结合草稿与上下文自动判断最合适的语气"
- FR-9: 系统必须保证智能模式下每次"生成回复"或"重新生成"都重新独立判断语气，不缓存复用上一次判断结果
- FR-10: 系统必须保证生成结果、润色结果的 UI 展示中不出现 AI 判断出的具体语气名称

## Non-Goals (Out of Scope)

- 不在 UI 中展示或暴露 AI 判断出的具体语气名称（含候选回复卡片、润色结果、任何 tooltip）
- 不允许用户为智能模式配置"候选语气池"（即不支持限定 AI 只能在某几个语气中判断选择）
- 不改变现有 8 种预设语气与自定义语气的行为、样式和 IPC 契约字段类型
- 不新增"语气判断结果确认"这一额外交互步骤，用户不需要对 AI 判断出的语气进行二次确认
- 不涉及跨会话记忆用户偏好语气（例如"记住我上次手动选的语气并下次默认展示"），本次固定默认值为智能模式

## Design Considerations

- 「智能模式」chip 复用现有 `ToneChip` 组件样式，仅位置固定在语气选择器最前面，视觉上与预设语气 chip 无差异（不额外加图标/特殊配色，避免造成"智能=更高级"的视觉暗示导致用户误判）
- 无需新增任何用于展示"判断结果"的 UI 元素（已明确决定不展示）

## Technical Considerations

- `TONE_OPTIONS` 目前是纯字符串数组（[ChatScreen.tsx:31](../src/screens/chat/ChatScreen.tsx#L31)），`selectedTone`/`tone` 全链路（IPC 类型、`generateReplies.ts`、`polishDraft.ts`）都以裸 `string` 类型直接拼进 prompt。新增智能模式建议使用一个不会与自由文本冲突的内部标识（例如常量 `SMART_TONE_ID`），展示文本为"智能模式"，避免用户自定义语气恰好输入"智能模式"四个字时产生歧义
- `generateReplies.ts` / `polishDraft.ts` 中现有的 `请以"${tone}"的语气...` 拼接逻辑需要判断该标识，分支为"根据对话上下文自动判断最合适的语气"这一指令文案，其余上下文注入方式（对方信息/己方角色/目标/历史消息）保持不变
- AI 判断语气时不限制必须落在预设 8 种语气之内，可自由判断更贴切的表达（内部使用，不展示，不影响现有预设列表）
- `selectedTone` 默认值由 `null`（[ChatScreen.tsx:52](../src/screens/chat/ChatScreen.tsx#L52)）改为智能模式标识；原本依赖 `disabled={!selectedTone}` 的按钮禁用逻辑自然满足，无需额外改动
- 无需新增单独的"语气判断"LLM 调用：语气判断指令直接内嵌在现有生成/润色 prompt 中，由同一次 LLM 调用完成判断+生成，不增加额外请求延迟

## Success Metrics

- 新用户在聊天卡片界面首次点击"生成回复"时，无需手动选语气即可成功生成的比例达到 100%（默认智能模式覆盖）
- 智能模式生成的候选回复被用户复制使用（一键复制）的比例不低于手动选择语气时的复制率，作为语气判断质量的间接衡量

## Open Questions

- 是否未来需要在候选回复旁提供一个可选的"查看AI判断的语气"入口（本次明确不做，作为后续迭代方向）
- 智能模式与自定义语气的"记住我上次选择"是否是后续需要补充的偏好持久化需求（本次固定默认智能模式，不做记忆）
