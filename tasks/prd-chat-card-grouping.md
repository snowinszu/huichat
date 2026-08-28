# PRD: 聊天对象分组功能

## 1. Introduction/Overview

「聊天对象」首页（[HomeScreen.tsx](../src/screens/home/HomeScreen.tsx)）目前把所有聊天对象卡片平铺展示在一个网格里。随着用户创建的聊天对象越来越多（同事、朋友、恋爱对象、客户……），平铺列表会变得难以扫视和管理。

本功能为聊天对象增加「分组」概念：每个聊天对象最多属于一个分组（类似文件夹），首页按分组分区展示，每个分区标题可折叠/展开，未分组的卡片归入固定的「未分组」区块。分组的新建、重命名、删除都通过已有的编辑弹窗和首页区块标题完成，不引入新的独立页面。

## 2. Goals

- 用户可以把聊天对象归类到自定义分组中，减少滚动查找的成本
- 分组的创建/编辑/删除操作足够轻量，不打断"新建或编辑聊天对象"这一主流程
- 删除分组不会丢失聊天对象数据，卡片自动回退为"未分组"

## 3. User Stories

### US-001: 分组数据层与仓储
**Description:** As a developer, I need a `group` table and CRUD repository functions so chat cards can reference a group and groups can be created/renamed/deleted.

**Acceptance Criteria:**
- [ ] 新增 `chat_group` 表：`id INTEGER PRIMARY KEY AUTOINCREMENT`、`name TEXT NOT NULL`、`created_at INTEGER NOT NULL`、`updated_at INTEGER NOT NULL`（命名 `chat_group` 而非 `group`，避免与 SQL 关键字冲突）
- [ ] `chat_card` 表新增 `group_id INTEGER REFERENCES chat_group(id) ON DELETE SET NULL` 列（迁移复用 [migrations.ts](../electron/main/db/migrations.ts) 现有的加列/建索引模式）
- [ ] 新增 `groupRepository.ts`：`createGroup`、`listGroupsWithUsage`（含每个分组下的聊天对象数量）、`renameGroup`（对齐 `updatePersona` 的部分字段更新写法）、`deleteGroup`（对齐 `deletePersona`，允许删除有引用的分组）
- [ ] `chatCardRepository.ts` 的 `CreateChatCardInput`/`UpdateChatCardInput` 支持写入 `groupId`
- [ ] 新增 IPC channels（`chat-group:create`/`list-with-usage`/`rename`/`delete`）与 preload 桥接方法
- [ ] Typecheck/lint 通过

### US-002: 编辑聊天对象弹窗支持选择/新建分组
**Description:** As a user, I want to assign a chat card to a group (or create a new group on the spot) while creating or editing it, so grouping never requires leaving the form.

**Acceptance Criteria:**
- [ ] 编辑/新建聊天对象弹窗新增「所属分组」下拉选择，选项包含现有全部分组和「不分组」，交互与现有「以哪个角色聊天」下拉一致
- [ ] 下拉旁提供「+ 新建分组」按钮，点击后在同一弹窗内切换为分组名称输入表单（复用 `modalMode` 状态机模式，参照 `quick-role`），保存后自动选中新分组并返回聊天对象表单，原有已填字段不丢失
- [ ] 新建分组名称为空时显示校验错误「请填写分组名称」，不允许提交
- [ ] 保存聊天对象时把选中的 `groupId` 一并写入（`null` 表示不分组）
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g. via the `run` skill）

### US-003: 首页按分组分区展示，支持折叠/展开
**Description:** As a user, I want the home screen to group chat cards into sections by their group, so I can visually separate categories at a glance.

**Acceptance Criteria:**
- [ ] 首页聊天对象列表按分组拆分为多个区块，每个区块标题展示分组名称和卡片数量（样式复用现有 `.sectionHeader`/`.sectionTitle`/`.sectionCount`）
- [ ] 未分组的卡片归入固定的「未分组」区块，始终排在所有自定义分组区块之后
- [ ] 每个区块标题可点击折叠/展开，折叠状态默认展开，且在当前会话内点击后立即生效（无需持久化到数据库）
- [ ] 分组区块的先后顺序按分组创建时间排列（早创建的分组在前）
- [ ] 区块内的卡片排序沿用现有"最近更新在前"规则
- [ ] 没有任何分组时（所有卡片都未分组），首页展示效果与当前实现一致（不显示多余的分组标题）
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g. via the `run` skill）

### US-004: 分组重命名与删除
**Description:** As a user, I want to rename or delete a group directly from its section header, so managing groups doesn't require a separate screen.

**Acceptance Criteria:**
- [ ] 每个自定义分组的区块标题旁提供「重命名」「删除」图标按钮（「未分组」区块不显示这两个按钮，因为它不是一个真实分组记录）
- [ ] 点击「重命名」后标题原地切换为输入框，回车或失焦保存，为空时恢复原名称并提示错误
- [ ] 点击「删除」弹出确认对话框；若该分组下有聊天对象，对话框需提示"组内 N 个聊天对象将变为未分组"（文案与措辞参照角色删除时的警示弹窗 [RolesScreen.tsx](../src/screens/roles/RolesScreen.tsx) 里 `usageCount > 0` 的处理）
- [ ] 确认删除后，该分组从数据库中移除，原属于它的聊天对象自动出现在「未分组」区块中（依赖 US-001 的 `ON DELETE SET NULL`）
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g. via the `run` skill）

### US-005: 端到端测试——聊天对象分组完整流程
**Description:** As a QA engineer, I want an automated end-to-end test covering the full grouping journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试创建一个聊天对象，在编辑弹窗中通过「+ 新建分组」创建分组「工作」并分配给它，断言首页出现「工作」区块且该卡片显示在其中
- [ ] 断言折叠该区块后卡片被隐藏，再次点击展开后卡片重新可见
- [ ] 覆盖边界场景：删除「工作」分组后，断言原卡片出现在「未分组」区块中，而不是丢失
- [ ] 测试在 CI 中运行并通过
- [ ] 测试自行创建和清理所需的聊天对象与分组数据，不依赖既有数据库状态

## 4. Functional Requirements

- FR-1: 系统必须提供 `chat_group` 数据表和对应的创建/查询/重命名/删除仓储方法
- FR-2: 系统必须允许 `chat_card` 关联至多一个分组（`group_id` 可为空）
- FR-3: 编辑/新建聊天对象弹窗必须提供「所属分组」下拉选择框，选项包含全部现有分组与「不分组」
- FR-4: 编辑/新建聊天对象弹窗必须提供「+ 新建分组」快捷入口，创建成功后自动选中新分组
- FR-5: 首页必须按分组对聊天对象卡片分区展示，未分组卡片归入固定的「未分组」区块并始终排在最后
- FR-6: 每个分组区块标题必须支持点击折叠/展开
- FR-7: 每个自定义分组区块标题必须提供重命名和删除入口，「未分组」区块不提供
- FR-8: 删除分组时，系统必须将该分组下所有聊天对象的 `group_id` 置空（自动回退为未分组），不得删除聊天对象本身
- FR-9: 分组区块的排列顺序必须按分组创建时间升序排列
- FR-10: 每个分组区块内的卡片排序必须沿用现有的"最近更新在前"规则

## 5. Non-Goals (Out of Scope)

- 不支持一个聊天对象同时属于多个分组（多标签）
- 不支持分组的手动拖拽排序（分组顺序固定为创建时间顺序，卡片顺序固定为最近更新时间）
- 不支持跨分组批量移动/批量操作聊天对象
- 不支持分组的图标、颜色等视觉自定义
- 折叠/展开状态不做持久化，刷新或重新打开应用后恢复默认展开
- 不涉及「我的角色」页面（[RolesScreen.tsx](../src/screens/roles/RolesScreen.tsx)）的分组，本功能仅作用于聊天对象首页

## 6. Design Considerations

- 分组区块标题复用现有 [HomeScreen.module.css](../src/screens/home/HomeScreen.module.css) 的 `.sectionHeader`/`.sectionTitle`/`.sectionCount` 样式，追加折叠箭头图标与重命名/删除图标按钮
- 「所属分组」下拉与「+ 新建分组」按钮的布局对齐现有「以哪个角色聊天」+「+ 新建角色」的 `.selectRow` 布局（[HomeScreen.tsx:424-438](../src/screens/home/HomeScreen.tsx#L424-L438)）
- 遵循移动优先原则：折叠箭头、重命名/删除图标按钮需满足触控最小尺寸

## 7. Technical Considerations

- 新表命名为 `chat_group` 而非 `group`（SQLite 关键字冲突风险）
- 迁移方式参照 [migrations.ts](../electron/main/db/migrations.ts) 中已有的"新增列 + 索引"迁移写法，为 `chat_card.group_id` 建索引（参照现有 `idx_chat_card_persona_id`）
- `groupRepository.ts` 的结构与命名对齐 `personaRepository.ts`（`listGroupsWithUsage` 对齐 `listPersonasWithUsage`），保持代码风格一致
- 前端分组状态（哪些区块折叠）用组件内 `useState` 维护即可，无需持久化或写入数据库
- HomeScreen 中把 `cards` 按 `groupId` 分桶为 `Map<number | null, ChatCardRecord[]>`，再按分组创建时间排序渲染区块

## 8. Success Metrics

- 拥有 10+ 聊天对象的用户可以通过折叠不相关分组，将目标聊天对象的可见位置提升到首屏内
- 新建分组到完成聊天对象分配的操作路径不超过 3 次点击（打开编辑弹窗 → 新建分组 → 保存）

## 9. Open Questions

- 无
