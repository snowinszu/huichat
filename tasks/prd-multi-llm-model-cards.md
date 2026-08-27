# PRD: 多 LLM 模型卡片

## 1. Introduction/Overview

现在应用的"设置页"只能保存**一份** LLM 配置（provider + API key + model）：`settings` 表是单行表，每次保存都会覆盖上一份。这意味着用户如果想在 OpenAI 和 Anthropic 之间切换，或者想用两个不同的 API Key（比如工作账号和个人账号），就必须先删掉旧配置再重填一遍，很麻烦，也容易误删。

这个功能把"设置页"的单一配置表单，改造成**多张可管理的"模型卡片"**——就像应用里已有的"聊天对象卡片"一样：每张卡片保存一份独立的 provider/API Key/model 配置，用户可以随时新建、编辑、删除多张卡片，并从中**选择一张作为"当前模型"**。之后应用里所有需要调用 AI 的功能（生成回复、翻译、自动提取信息、内容润色、测试连接）都统一使用这张"当前模型"卡片的配置。

## 2. Goals

- 用户可以保存多份 LLM 配置（不同 provider、不同账号的 API Key），互不覆盖
- 在已保存的配置之间切换只需一次点击，不必重新输入 API Key/model
- 任意时刻有且只有一张卡片是"当前模型"，全应用所有 AI 调用统一使用它，不产生歧义
- 没有任何模型卡片时，需要调用 AI 的功能会被明确拦截并引导用户先去创建卡片，而不是发起注定失败的请求
- 切换当前模型后无需重启应用，下一次 AI 调用立即生效

## 3. User Stories

### US-001: 新增模型卡片数据表
**Description:** As a developer, I need a new `llm_model_card` table that can hold many rows (one per model configuration) with a single "current" flag, so the app can move off the single-row `settings` table.

**Acceptance Criteria:**
- [ ] `schema.ts` 新增 `llm_model_card` 表：`id`、`name`（卡片名称）、`provider`、`api_key`、`model`、`base_url`（可空）、`is_current`（0/1）、`created_at`、`updated_at`
- [ ] 数据库层保证任意时刻至多一行 `is_current = 1`（写入"设为当前"时在同一事务内先清除旧的当前标记）
- [ ] 旧 `settings` 表按已确认决定不做数据迁移，保留表结构但新代码不再读写它
- [ ] Typecheck/lint passes

### US-002: 设置页展示模型卡片列表
**Description:** As a user, I want to see all my saved LLM model cards on the settings page, so I know what configurations I have and which one is currently active.

**Acceptance Criteria:**
- [ ] 设置页原有的单一配置表单替换为卡片列表：每张卡片显示卡片名称、provider 名称、API Key 掩码预览（如 `sk-...abcd`）、model 名称
- [ ] 当前模型的卡片有明显的"当前"标记（徽章样式）
- [ ] 没有任何卡片时显示空状态提示，并引导点击"新建模型卡片"
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-003: 创建模型卡片
**Description:** As a user, I want to create a new model card with its own name, provider, API key, and model, so I can add another LLM configuration without overwriting an existing one.

**Acceptance Criteria:**
- [ ] "新建模型卡片"按钮打开创建表单，字段：卡片名称（必填文本）、provider（下拉，复用现有 provider 列表）、API key（掩码输入，show/hide 切换）、model（输入框 + 按 provider 变化的推荐模型 chip）
- [ ] 选择"自定义端点"provider 时额外显示 Endpoint 字段
- [ ] 卡片名称为空、API key 为空/格式非法、自定义端点缺失或格式非法时阻止保存，并显示行内错误提示（复用现有 `validateApiKey`/`validateModel`/`validateBaseUrl`）
- [ ] 创建的是应用内第一张模型卡片时，自动将其设为当前模型
- [ ] 保存后卡片出现在列表中，持久化到数据库，重启应用后仍存在
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-004: 编辑模型卡片
**Description:** As a user, I want to edit an existing model card's fields, so I can fix a typo or rotate an API key without recreating the card.

**Acceptance Criteria:**
- [ ] 每张卡片提供"编辑"入口，打开预填当前值的表单（复用创建表单与校验规则）
- [ ] 保存后立即更新列表展示与数据库持久化
- [ ] 若编辑的是当前模型卡片，保存后仍保持"当前"标记不变
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-005: 删除模型卡片
**Description:** As a user, I want to delete a model card I no longer need, so my card list stays relevant.

**Acceptance Criteria:**
- [ ] 每张非当前卡片提供"删除"入口，删除前弹出二次确认对话框
- [ ] 确认后卡片从列表和数据库中移除
- [ ] 尝试删除"当前模型"卡片时，操作被阻止，并提示"请先切换当前模型后再删除"
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-006: 切换当前模型
**Description:** As a user, I want to mark a different saved card as the current model, so all AI features immediately start using that configuration.

**Acceptance Criteria:**
- [ ] 每张非当前卡片提供"设为当前模型"操作
- [ ] 点击后该卡片变为当前模型，原当前卡片的标记被取消，列表实时更新
- [ ] 切换后无需重启应用，下一次 AI 调用即使用新的当前模型配置
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-007: 卡片自测连接
**Description:** As a user, I want to test any saved card's connection independent of whether it's the current model, so I can verify a new API key works before switching to it.

**Acceptance Criteria:**
- [ ] 每张卡片提供"测试连接"操作，使用该卡片自身的 provider/API key/model 发起一次真实的一次性 LLM 调用
- [ ] 成功/失败均以 toast 形式反馈，不要求该卡片是当前模型
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-008: 所有 AI 调用功能统一读取当前模型
**Description:** As a user, I want every AI-powered feature (generate reply, regenerate, translation, auto info extraction, content polish) to use whichever card I've marked as current, so behavior is predictable and consistent across the app.

**Acceptance Criteria:**
- [ ] 生成回复、重新生成、翻译、自动信息提取、内容润色等功能改为读取当前模型卡片的配置发起 LLM 调用，不再依赖旧 `settings` 表
- [ ] 不存在任何模型卡片（新用户或已清空）时，上述功能的触发入口应提示"请先在设置页创建并选择模型"，并引导跳转设置页，不发起注定失败的请求
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-009: 端到端测试多模型卡片流程
**Description:** As a QA engineer, I want an automated end-to-end test covering the full model-card journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试：创建两张不同 provider 的模型卡片，确认第一张自动成为当前模型
- [ ] E2E 测试：切换当前模型到第二张卡片，验证列表中的"当前"徽章随之转移
- [ ] 覆盖边界场景：尝试删除当前模型卡片被阻止并显示提示；清空所有卡片后，触发一次需要 AI 的操作（如"生成回复"）应看到引导提示而非报错崩溃
- [ ] 测试在 CI 中运行并通过
- [ ] 测试独立可重复，自行创建与清理所用数据

## 4. Functional Requirements

- FR-1: 系统必须新增 `llm_model_card` 表，替代旧的单行 `settings` 表作为 LLM 配置的存储来源
- FR-2: 系统必须保证任意时刻数据库中至多一张模型卡片的 `is_current` 为真
- FR-3: 设置页必须以列表形式展示所有已保存的模型卡片，包含名称、provider、API Key 掩码预览、model，以及当前模型的徽章标记
- FR-4: 系统必须提供创建模型卡片的表单，字段包括卡片名称、provider、API key、model，provider 为自定义端点时额外包含 Endpoint 字段
- FR-5: 系统必须在保存模型卡片前校验卡片名称非空、API key 合法、（自定义端点时）Endpoint 合法，任一校验失败则阻止保存并显示行内错误
- FR-6: 当创建的是应用内第一张模型卡片时，系统必须自动将其设为当前模型
- FR-7: 系统必须支持编辑已有模型卡片的全部字段
- FR-8: 系统必须支持删除非当前的模型卡片，删除前需二次确认
- FR-9: 当用户尝试删除当前模型卡片时，系统必须阻止该操作并提示需先切换当前模型
- FR-10: 系统必须支持将任意一张非当前卡片设为当前模型，并同步取消原当前卡片的标记
- FR-11: 切换当前模型后，系统必须立即对后续 AI 调用生效，无需重启应用
- FR-12: 系统必须支持对任意一张模型卡片（无论是否为当前模型）发起测试连接
- FR-13: 系统中所有发起 LLM 调用的功能（生成回复、重新生成、翻译、自动信息提取、内容润色）必须统一使用当前模型卡片的配置
- FR-14: 当不存在任何模型卡片时，系统必须在需要 AI 能力的入口处提示用户先创建并设置模型，并阻止发起无效的 LLM 调用

## 5. Non-Goals (Out of Scope)

- 不支持按聊天对象/聊天卡片分别指定不同的模型（当前模型为全局唯一生效范围，已与用户确认）
- 不设置模型卡片数量上限
- 不对旧版单行 `settings` 表中已保存的配置做自动迁移（已与用户确认清空重来）
- 不新增 API Key 加密存储机制（保持现状：本地明文存储，不上传）
- 不做模型卡片的跨设备同步/云端备份
- 不为模型卡片新增图片头像上传（区别于聊天对象卡片），仅用文字/provider 标识区分

## 6. Design Considerations

- 复用现有组件：`Modal`、`Select`、`PasswordInput`、`ConfirmDialog`、toast 提示
- 复用 `providerMeta.ts` 中的 `PROVIDER_ORDER`/`PROVIDER_META`/`validateApiKey`/`validateModel`/`validateBaseUrl`，创建/编辑表单与现有设置表单保持一致的校验体验
- 卡片列表可参考现有 `ContactCard`/角色列表的列表项样式，但无需头像图片，用 provider 图标或首字母代替
- 当前模型徽章样式需与"聊天对象卡片"上的标签徽章视觉一致，保持全应用设计语言统一

## 7. Technical Considerations

- 新增 `modelCardRepository.ts`（`electron/main/db/`），参照现有 `personaRepository`/`chatCardRepository` 的写法，提供 list/create/update/delete/setCurrent/getCurrent
- 新增对应 IPC channel（如 `modelCard:list`/`create`/`update`/`delete`/`setCurrent`/`testConnection`），在 `ipc-types.ts` 与 `register.ts` 中注册，参照现有 `settings:get`/`settings:save`/`llm:test-connection` 的实现模式
- `extractInfo.ts` 与 `register.ts` 中现有的 `getSettings()` 调用点需要替换为读取当前模型卡片配置的等价函数；若当前无卡片，需要返回可被上层正确识别并转化为用户提示的错误，而不是让 LLM 调用直接报错崩溃
- "设为当前模型"的写操作需要在单个数据库事务内完成"清除旧当前标记 + 设置新当前标记"，避免出现 0 张或 2 张当前卡片的中间态
- 旧 `settings` 表与相关 IPC channel 可保留但视为废弃，不在本次改造中删除（无需迁移脚本）

## 8. Success Metrics

- 用户可以在不清空已保存配置的前提下，新增并在至少 2 个不同 provider/账号的模型卡片间切换
- 切换当前模型后，下一次生成回复/测试连接立即使用新配置，无需重启应用
- 没有任何模型卡片时，触发"生成回复"等功能 100% 被正确拦截并提示，不产生无效的 LLM 请求或未处理异常

## 9. Open Questions

- [Assumption] 卡片名称是否要求唯一性：本 PRD 假设不强制唯一，允许重复名称，仅作展示用途；如需强制唯一，需在 US-003/US-004 补充校验规则
- 是否需要按 provider 分组或允许用户手动排序卡片列表？当前默认按创建时间排序，如有需求可在后续迭代补充
- 是否需要为"测试连接"结果增加历史记录（比如"上次测试成功于 X 分钟前"），还是保持现状的一次性 toast 反馈？
