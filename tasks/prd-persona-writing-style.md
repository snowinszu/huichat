# PRD: 角色文字风格字段

## 1. Introduction/Overview

角色档案（persona）目前只有「角色名称」和「角色的基本信息」两个字段，描述的是身份和性格背景，但没有地方描述这个角色说话时的具体书写习惯（比如"一般不加标点符号""习惯每句话结束都加表情"）。这些习惯对 AI 生成回复的"像不像本人"影响很大，却缺少一个专门的输入位置。

本功能在角色的创建/编辑表单（[RolesScreen.tsx](../src/screens/roles/RolesScreen.tsx) 和首页快捷新建角色弹窗 [HomeScreen.tsx](../src/screens/home/HomeScreen.tsx)）中新增一个「文字风格」输入框，并把内容实际写入 AI 生成回复/润色草稿时使用的 prompt，让生成结果真正体现这些书写习惯。

## 2. Goals

- 用户可以为角色补充具体的文字/说话风格描述，与「基本信息」分开填写
- 「我的角色」编辑页和首页快捷新建角色弹窗的字段保持一致，不出现"两个入口能填的信息不一样"的情况
- 文字风格描述会被实际用于 AI 生成回复和润色草稿的 prompt，而不仅仅是展示用的备注

## 3. User Stories

### US-001: 角色数据层支持文字风格字段
**Description:** As a developer, I need the persona table and repository to support a `style` field so it can be created, edited, and read back like `name`/`bio`.

**Acceptance Criteria:**
- [ ] `persona` 表新增 `style TEXT NOT NULL DEFAULT ''` 列；沿用 [migrations.ts](../electron/main/db/migrations.ts) 中"新增列"的既有迁移写法（参照 `migrateChatCardHistorySummaryColumns`），确保老用户升级后已有角色档案不会因缺列报错
- [ ] `PersonaRecord`/`CreatePersonaInput`/`UpdatePersonaInput`（[ipc-types.ts](../electron/shared/ipc-types.ts)）新增可选的 `style` 字段
- [ ] `personaRepository.ts` 的 `createPersona`/`updatePersona`/`toRecord` 支持读写 `style`
- [ ] Typecheck/lint 通过

### US-002: 我的角色编辑弹窗新增文字风格输入框
**Description:** As a user, I want to describe a persona's writing habits in its edit form so I can capture details like "不加标点符号" separately from the general bio.

**Acceptance Criteria:**
- [ ] [RolesScreen.tsx](../src/screens/roles/RolesScreen.tsx) 的新建/编辑角色弹窗在「角色的基本信息」下方新增「文字风格」多行文本框，placeholder 提示示例（如"一般不加标点符号、习惯每句话结束都加表情"）
- [ ] 该字段为可选项，留空时不影响保存
- [ ] 保存时把文字风格内容一并写入 `persona.create`/`persona.update` 调用
- [ ] 重新打开编辑弹窗时，已保存的文字风格内容正确回显
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g. via the `run` skill）

### US-003: 首页快捷新建角色弹窗同步新增文字风格输入框
**Description:** As a user, I want the same writing-style field available when I quickly create a persona from the home screen's chat-card form, so both entry points capture the same information.

**Acceptance Criteria:**
- [ ] [HomeScreen.tsx](../src/screens/home/HomeScreen.tsx) 的快捷新建角色表单（`modalMode === 'quick-role'`）新增与 US-002 一致的「文字风格」输入框
- [ ] 保存时把文字风格内容一并写入 `persona.create` 调用
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g. via the `run` skill）

### US-004: 文字风格写入 AI 角色设定 prompt
**Description:** As a user, I want the persona's writing-style notes to actually shape the AI's generated replies, not just sit as a display-only note.

**Acceptance Criteria:**
- [ ] [promptContext.ts](../electron/main/llm/promptContext.ts) 的 `buildContextSection` 在【我的角色设定】部分之外，当 `persona.style` 非空时额外输出一个【说话习惯】小节，包含该文字风格内容
- [ ] `persona.style` 为空时不额外输出这个小节（不出现空标题）
- [ ] 生成候选回复（`reply:generate`）和润色草稿（`reply:polish`）两条链路都使用了包含该小节的 prompt
- [ ] Typecheck/lint 通过

### US-005: End-to-end test of persona writing-style flow
**Description:** As a QA engineer, I want an automated end-to-end test covering the full writing-style journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试创建一个角色并填写文字风格（如"每句话结尾加个哈哈"），保存后重新打开编辑弹窗，断言该内容正确回显
- [ ] 测试用该角色创建聊天对象并触发一次"生成回复"，通过 mock LLM server 捕获实际发送的 prompt 文本，断言其中包含填写的文字风格内容
- [ ] 覆盖边界场景：不填写文字风格时生成的 prompt 中不出现【说话习惯】小节
- [ ] 测试在 CI 中运行并通过
- [ ] 测试自行创建和清理所需的角色与聊天对象数据，不依赖既有数据库状态

## 4. Functional Requirements

- FR-1: 系统必须为 `persona` 表新增 `style` 字段（文本，可为空字符串）
- FR-2: 「我的角色」的新建/编辑弹窗必须提供「文字风格」多行输入框
- FR-3: 首页快捷新建角色弹窗必须提供与「我的角色」一致的「文字风格」输入框
- FR-4: 保存角色时，文字风格内容必须随 `name`/`bio` 一并持久化
- FR-5: 当 `persona.style` 非空时，生成回复和润色草稿的 prompt 必须包含一个独立的【说话习惯】小节，内容为该文字风格文本
- FR-6: 当 `persona.style` 为空时，prompt 中不得出现【说话习惯】小节

## 5. Non-Goals (Out of Scope)

- 不提供预设的文字风格模板/选项列表，字段是纯自由文本
- 不对文字风格内容做任何格式校验或字数限制
- 不涉及角色复制功能（[persona-duplicate](./prd-persona-duplicate.md)）以外的其他角色相关功能改动，复制角色时是否带上 `style` 由现有复制逻辑（复制 `name`+`bio`）自然扩展决定，不在本 PRD 中单独定义验收标准
- 不影响历史摘要（history summary）等其他 prompt 拼装逻辑，仅影响【我的角色设定】相关部分

## 6. Design Considerations

- 复用现有 `Textarea` 组件，样式与「角色的基本信息」输入框一致（[RolesScreen.tsx:212-218](../src/screens/roles/RolesScreen.tsx#L212-L218)）
- 字段标签统一使用「文字风格」，placeholder 用具体示例引导用户填写短句而非长篇大论

## 7. Technical Considerations

- 迁移方式参照 [migrations.ts](../electron/main/db/migrations.ts) 中已有的"新增列"迁移函数（如 `migrateChatCardHistorySummaryColumns`），新增一个 `migrateAddPersonaStyleColumn`（或等价命名）并在 [db/index.ts](../electron/main/db/index.ts) 的 `initDatabase` 中调用
- `personaRepository.ts` 的 `updatePersona` 是通用的"按 patch 里出现的字段动态拼 SQL"写法，`style` 字段名与列名一致，天然适配现有实现，无需额外映射
- prompt 拼装逻辑集中在 `promptContext.ts` 的 `buildContextSection`，是 `reply:generate`、`reply:polish`、`chat-stats:evaluate-goal` 等多条链路共用的入口，改动这里即可让文字风格自动覆盖生成回复和润色两条路径

## 8. Success Metrics

- 用户能在创建角色的同一个表单内一次性填完名称、基本信息、文字风格，无需二次编辑
- 抽样生成的回复中，文字风格描述的书写习惯（如不加标点、加表情）可被观察到体现在输出文本里

## 9. Open Questions

- 无
