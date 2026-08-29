# PRD: 聊天对象搜索

## Introduction/Overview

"聊天对象"页面（[HomeScreen.tsx](src/screens/home/HomeScreen.tsx)）随着用户添加的联系人增多，尤其是启用了分组之后，逐个展开分组去找一个人会变得很麻烦。本功能在该页面加入一个常驻的搜索输入框，用户输入部分昵称即可实时过滤出昵称匹配的聊天对象卡片，无需展开分组或滚动查找。

## Goals

- 在"聊天对象"页面提供一个随时可用的搜索入口，按昵称实时过滤联系人
- 搜索时无论是否分组、分组是否折叠，都能一眼看到所有匹配结果
- 不引入额外的数据库/IPC 调用，纯前端内存过滤，保证响应即时
- 搜索结束后能无感知地恢复到搜索前的分组/折叠状态

## User Stories

### US-001: 在聊天对象页面加入常驻搜索输入框
**Description:** As a 用户, I want 在"聊天对象"页面看到一个常驻的搜索框 so that 我可以随时输入关键字查找联系人，无需额外点击才能唤出搜索。

**Acceptance Criteria:**
- [ ] 在"聊天对象" section header 区域（[HomeScreen.tsx:454-465](src/screens/home/HomeScreen.tsx#L454-L465) 附近）新增一个文本输入框，placeholder 为"搜索昵称"
- [ ] 只要联系人列表非空（`cards.length > 0`）该输入框就始终可见；当列表完全为空（"还没有聊天对象"空状态）时不显示搜索框
- [ ] 输入框有内容时，右侧显示一个清空（×）按钮，点击后清空输入并让输入框重新获得焦点
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-002: 按昵称实时过滤联系人
**Description:** As a 管理着较多聊天对象的用户, I want 输入关键字时列表实时过滤出昵称匹配的对象 so that 我不用点击搜索按钮或等待就能快速定位到目标联系人。

**Acceptance Criteria:**
- [ ] 每次在搜索框中键入字符时（无需回车或点击按钮），列表立即只显示 `name` 字段包含输入内容的联系人卡片，匹配不区分大小写
- [ ] 输入内容仅为空白字符（如全部是空格）时按空查询处理，展示未过滤的完整列表
- [ ] 通过点击 × 按钮或手动删空输入框内容清空搜索后，列表恢复为搜索前的完整内容，且分组展开/折叠状态与搜索前保持一致
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-003: 搜索时将分组视图展平为单一网格
**Description:** As a 已经把联系人整理进多个分组的用户, I want 搜索结果以一个不分组的网格展示 so that 我不需要逐个展开每个（可能已折叠的）分组去确认里面有没有匹配的人。

**Acceptance Criteria:**
- [ ] 当搜索框内容非空时，无论当前有多少个分组、哪些分组处于折叠状态，所有匹配的联系人卡片都合并展示在同一个网格中，不再显示分组标题
- [ ] 搜索激活期间，分组标题、展开/折叠箭头、每组人数、分组的重命名/删除按钮均不显示
- [ ] 清空搜索框后，视图恢复为搜索前的分组展示，且每个分组区块此前的折叠/展开状态不变
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-004: 搜索无匹配结果时的空状态
**Description:** As a 用户, I want 搜索不到任何匹配对象时看到明确的提示 so that 我知道是搜索词的问题，而不是以为应用出错了或联系人被清空了。

**Acceptance Criteria:**
- [ ] 当搜索框非空且没有任何联系人匹配时，页面显示与"还没有聊天对象"不同的提示文案（例如"未找到匹配的聊天对象"）
- [ ] 该空状态下不展示"新建聊天对象"/"新建第一个聊天对象"引导按钮（这是搜索未命中，不是联系人列表为空）
- [ ] 该空状态下可以直接清空搜索词（复用输入框自带的 × 按钮）以返回完整列表
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-005: 聊天对象搜索流程的端到端测试
**Description:** As a QA engineer, I want an automated end-to-end test covering the full 聊天对象搜索 journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试创建至少两个昵称不同的聊天对象（其中至少一个属于某个分组），在搜索框中输入其中一个昵称的子串，断言只有匹配的卡片仍然可见，且分组标题不再显示
- [ ] 测试清空搜索框，断言列表恢复为清空前的完整分组视图
- [ ] 覆盖边缘场景：输入一个不存在的关键字，断言显示"无匹配结果"空状态而非"还没有聊天对象"空状态
- [ ] Test runs in CI and passes
- [ ] Test 自行创建并清理所用的聊天对象/分组数据

## Functional Requirements

- FR-1: The system must render a persistent text search input in the 聊天对象 page's section header, visible whenever at least one chat card exists.
- FR-2: The system must hide the search input when the contact list is completely empty (the existing "还没有聊天对象" empty state).
- FR-3: The system must filter the displayed chat cards on every keystroke, with no separate submit action required.
- FR-4: The system must match the search input against each contact's `name` field using a case-insensitive substring comparison.
- FR-5: The system must treat a whitespace-only search input as an empty query and show the unfiltered view.
- FR-6: When the search input is non-empty, the system must render all matching cards in a single flat grid, suppressing group section headers, collapse/expand controls, and per-group action buttons.
- FR-7: When the search input is cleared (via the clear button or by deleting all text), the system must restore the prior grouped/ungrouped view, preserving each group section's collapsed/expanded state from before the search.
- FR-8: The system must display a clear ("×") control inside or beside the search input whenever it has a non-empty value.
- FR-9: When the search input is non-empty and no chat cards match, the system must display a distinct "no matches" empty state instead of the "no contacts at all" empty state, without the "新建聊天对象" call-to-action.
- FR-10: The system must perform the search filtering entirely client-side against already-loaded contact data, without issuing new IPC or database calls.

## Non-Goals (Out of Scope)

- 不搜索 `otherInfo`（基本信息）、`longTermGoal`（聊天目标）或所绑定角色/分组名称，仅匹配昵称
- 不做拼音搜索、模糊匹配（如编辑距离容错）或搜索建议/历史记录
- 不在匹配结果中高亮显示命中的子串
- 不提供聚焦搜索框的全局快捷键（如 "/" 或 Cmd+F）
- 不改变搜索框以外的联系人卡片交互（打开对话、编辑、删除、统计入口行为不变）

## Design Considerations

- 复用现有 [Input](src/components/ui/Input/Input.tsx) 组件样式，与页面其他表单控件保持一致的视觉风格
- 复用现有 [ContactCardGrid](src/components/ui/ContactCard/ContactCard.tsx) 作为搜索结果的展平网格容器
- 空状态文案与图标风格参照现有"还没有聊天对象"空状态的排版（[HomeScreen.tsx:467-479](src/screens/home/HomeScreen.tsx#L467-L479)），但用不同的标题/说明文字与不展示新建按钮
- 遵循 Mobile First 原则：搜索框在小宽度下应能与"新建聊天对象"按钮合理换行或收窄，不溢出

## Technical Considerations

- 联系人数据已经通过 `window.api.chatCard.list()` 一次性加载进 `cards` state（[HomeScreen.tsx:195-213](src/screens/home/HomeScreen.tsx#L195-L213)），过滤逻辑可用 `useMemo` 在渲染层完成，无需新增 IPC handler
- `groupSections` 的构造逻辑（[HomeScreen.tsx:109-120](src/screens/home/HomeScreen.tsx#L109-L120)）在搜索激活时应被绕过，改为对过滤后的 `cards`直接渲染单一 `ContactCardGrid`
- 现有 `collapsedSections` state 无需在搜索期间被修改或清空，只是渲染路径切换到展平模式，从而保证清空搜索后原折叠状态天然保留

## Success Metrics

- 搜索过滤完全在前端内存中完成，不新增任何 IPC/数据库调用
- 用户在任意分组结构下，输入昵称片段后无需手动展开分组即可看到全部匹配结果

## Open Questions

- 是否需要在未来迭代中扩展搜索范围到 `otherInfo` 或角色名？
- 是否需要在匹配结果中高亮显示命中的关键字？
