# PRD: 角色卡片复制功能

## 1. Introduction/Overview

在「我的角色」页面（[RolesScreen.tsx](../src/screens/roles/RolesScreen.tsx)），用户目前只能通过手动填写「角色名称」和「角色的基本信息」从零创建一个新角色。当用户想基于一个已有角色做出一个相近的变体（例如把「工作中的我」调整成「面试中的我」）时，需要重新输入全部内容，容易漏填细节。

本功能在每张角色卡片的操作区新增一个「复制」按钮，点击后立即基于该角色创建一份独立的副本（名称自动加上「副本」后缀），副本直接出现在列表中，用户可以再点击「编辑」按钮做后续调整。

## 2. Goals

- 用户可以一键复制现有角色卡片，无需手动重新填写名称和简介
- 复制后的新角色与原角色完全独立，互不影响（编辑、删除任一方都不影响另一方）
- 复制操作即时生效（无需二次确认弹窗），并给出明确的成功反馈

## 3. User Stories

### US-001: 后端支持复制角色
**Description:** As a developer, I need a repository/IPC method that duplicates a persona's name and bio into a new persona row, so the UI has a single call to create the copy.

**Acceptance Criteria:**
- [ ] 新增 `duplicatePersona(db, id)`（[personaRepository.ts](../electron/main/db/personaRepository.ts)），读取源角色的 `name`/`bio`，按 FR-2 规则计算新名称，插入一条新的 persona 记录并返回
- [ ] 若源角色 id 不存在，方法抛出错误（与 `updatePersona` 的 not-found 处理方式一致）
- [ ] 新增 IPC channel `persona:duplicate`，在 [register.ts](../electron/main/ipc/register.ts) 中注册 handler，在 [preload/index.ts](../electron/preload/index.ts) 暴露 `window.api.persona.duplicate(id): Promise<PersonaRecord>`
- [ ] Typecheck/lint 通过

### US-002: 角色卡片新增「复制」图标按钮
**Description:** As a user, I want a copy icon button on each role card's action row so I can duplicate it in one click.

**Acceptance Criteria:**
- [ ] 每张角色卡片的操作区在「编辑」和「删除」之间新增「复制」图标按钮（复用已有的 `IconCopy`，见 [icons.tsx](../src/components/ui/icons.tsx)）
- [ ] 按钮带有 `aria-label`（如「复制${persona.name}」），与现有编辑/删除按钮的可访问性写法一致
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g. via the `run` skill）

### US-003: 点击复制后立即创建副本并停留在列表
**Description:** As a user, when I click the copy button, I want the new persona to appear in the list immediately with a success toast, without opening any modal, so duplicating feels instant.

**Acceptance Criteria:**
- [ ] 点击复制按钮后调用 `window.api.persona.duplicate(id)`，成功后刷新列表（复用现有 `refresh()`），新卡片出现在列表中
- [ ] 成功后显示 toast「角色已复制」（success 类型，与现有 `handleSave`/`handleConfirmDelete` 的 toast 风格一致）
- [ ] 复制过程中该卡片的复制按钮显示 loading/禁用状态，防止重复点击产生多个副本
- [ ] 复制失败时显示错误 toast（沿用 `error_ instanceof Error ? error_.message : '复制失败'` 的写法），列表不发生变化
- [ ] 新副本的 `usageCount` 为 0（未被任何聊天对象引用），因为副本不复制任何 `chat_card` 关联
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g. via the `run` skill）

### US-004: 副本自动命名与去重
**Description:** As a user, I want the duplicated persona's name to be auto-generated based on the original so I immediately know it's a copy, even if I've duplicated the same role before.

**Acceptance Criteria:**
- [ ] 首次复制「XX」得到名称「XX副本」
- [ ] 若「XX副本」已存在于当前角色列表中，则依次尝试「XX副本2」「XX副本3」……直到得到一个当前不存在的名称
- [ ] `bio` 原样复制，不做任何修改
- [ ] Typecheck/lint 通过

### US-005: 端到端测试——角色复制完整流程
**Description:** As a QA engineer, I want an automated end-to-end test covering the full persona-duplicate journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试创建一个角色「测试角色」，点击其复制按钮，断言列表中出现名为「测试角色副本」的新卡片，且原卡片仍然存在且内容不变
- [ ] 断言新卡片的「暂未使用」状态（usageCount 为 0）
- [ ] 覆盖边界场景：对同一角色再次点击复制，断言第二个副本被命名为「测试角色副本2」（去重逻辑生效）
- [ ] 测试在 CI 中运行并通过
- [ ] 测试自行创建和清理所需的角色数据，不依赖既有数据库状态

## 4. Functional Requirements

- FR-1: 系统必须在每张角色卡片的操作区提供一个「复制」图标按钮，位置在「编辑」和「删除」按钮之间
- FR-2: 点击「复制」按钮时，系统必须创建一条新的角色记录，`bio` 与源角色相同，`name` 为源角色名称加上「副本」后缀；若该名称已存在，则加上递增数字后缀（副本2、副本3……）直到名称唯一
- FR-3: 复制创建的新角色必须是完全独立的记录（拥有独立的 id、`createdAt`/`updatedAt`），不与源角色保留任何关联字段，也不复制任何 `chat_card` 的 `persona_id` 关联
- FR-4: 复制成功后，系统必须刷新角色列表并展示成功提示（toast），不打开任何弹窗
- FR-5: 复制失败时，系统必须展示错误提示（toast），且不得改变现有角色列表
- FR-6: 复制操作进行中，系统必须禁用该卡片的复制按钮，防止同一次点击触发多次创建

## 5. Non-Goals (Out of Scope)

- 不支持批量复制多个角色
- 不支持复制时弹窗预览/编辑名称（复制后如需改名，用户走现有的「编辑」入口）
- 不记录副本与源角色的溯源关系（如「复制自 XX」），副本创建后与原角色无任何数据关联
- 不复制角色的使用关系（`chat_card` 引用），副本的 `usageCount` 恒为 0
- 不改动现有的「新建角色」「编辑角色」「删除角色」流程

## 6. Design Considerations

- 复用现有的 `IconCopy`（[icons.tsx](../src/components/ui/icons.tsx)）和 `IconButton` 组件，保持与「编辑」「删除」按钮一致的尺寸（16px）、间距和 hover 样式
- 按钮顺序为：编辑 → 复制 → 删除，复制作为中性操作，视觉上不使用 `danger` 变体（与删除按钮区分）
- 遵循移动优先原则：操作区图标按钮的可点击区域需满足触控最小尺寸，在窄屏下不换行、不溢出

## 7. Technical Considerations

- 后端：新增 `duplicatePersona(db, id)`（[personaRepository.ts](../electron/main/db/personaRepository.ts)），内部读取源记录（`getPersona`）、计算去重后的名称（查询 `listPersonasWithUsage` 或专用的按名称查询）、调用现有 `createPersona` 完成插入
- IPC：新增 `IPC_CHANNELS.personaDuplicate`（[ipc-types.ts](../electron/shared/ipc-types.ts)），在 [register.ts](../electron/main/ipc/register.ts) 与 [preload/index.ts](../electron/preload/index.ts) 中按现有 persona 系列 handler 的写法接入
- 前端：[RolesScreen.tsx](../src/screens/roles/RolesScreen.tsx) 新增 `duplicatingId` 状态用于单卡片 loading 控制，`handleDuplicate(persona)` 函数调用 IPC、刷新列表、展示 toast，写法参照现有 `handleConfirmDelete`
- 名称去重的查重范围为当前全部角色列表（不区分是否被使用），与角色名称本身不做数据库唯一约束的现状一致（`persona.name` 无 UNIQUE 约束，去重仅是产品层面的命名规则）

## 8. Success Metrics

- 复制一个角色卡片到看见新卡片出现的耗时低于 1 秒（本地 SQLite 写入 + IPC 往返）
- 复制操作的用户点击路径为 1 次点击（无需经过弹窗确认）

## 9. Open Questions

- 无
