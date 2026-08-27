# PRD: 模型设置独立页面 + 通用设置开关

## 1. Introduction/Overview

现在应用的"设置页"其实做了两件不相关的事：管理 LLM 模型卡片（provider/API Key/model），以及……没有别的了——UI 设计稿里本来就有的"通用设置"开关区块（翻译非中文消息、生成时自动添加到历史等）一直没有真正实现。这让"设置"这个词变得含糊：点进去看到的全是模型配置，找不到任何"应用行为"相关的开关。

这个功能做两件事：

1. **把模型卡片管理从"设置页"里搬出来，单独做一个页面**，首页新增一个独立入口进入，"设置"这个词回归它本来的含义。
2. **把"设置页"改造成真正的通用设置页**，接入 UI 设计稿里已有的开关：翻译非中文消息、生成时自动添加到历史；并新增两个当前设计稿里没有、但贴合产品逻辑的开关：自动信息提取、深色模式。每个开关都要真正生效，不是摆设。

## 2. Goals

- 用户能在首页直接进入"模型"页面管理多个模型卡片，与"设置"入口分开，语义清晰
- "设置页"里的每个开关都真实持久化、真实影响对应功能的行为，重启应用后仍生效
- 关闭"翻译非中文消息"后，粘贴非中文消息不再发起任何翻译请求，省下一次 LLM 调用
- 开启"生成时自动添加到历史"后，点击候选回复的"复制"按钮即完成复制并加入对话历史，无需再多点一次
- 关闭"自动信息提取"后，粘贴消息不再触发后台的 AI 信息提取
- 开启"深色模式"后，全应用（首页/角色/模型/设置/聊天）切换到深色配色，重启后保持

## 3. User Stories

### US-001: 模型卡片管理迁移到独立页面
**Description:** As a user, I want to manage my model cards on their own page instead of inside "Settings", so the two concepts don't get confused.

**Acceptance Criteria:**
- [ ] 首页顶栏新增一个独立入口图标（与"我的角色""设置"并列），点击进入模型卡片页面
- [ ] 模型卡片页面承载现有全部能力：列表展示、创建、编辑、删除（含删除当前模型保护）、设为当前模型、测试连接——功能与现状完全一致，仅是从"设置"路由搬到独立路由
- [ ] 原"设置"入口不再显示任何模型卡片相关内容
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-002: 通用设置页面骨架与持久化
**Description:** As a developer, I need a place to store app-wide preference toggles that persists across restarts, so subsequent stories have something to read from and write to.

**Acceptance Criteria:**
- [ ] 新增单行偏好设置表（结构类似现有 `settings` 单行表，但与已废弃不用的旧 LLM 配置表完全独立），字段覆盖本 PRD 涉及的全部开关
- [ ] 设置页展示开关列表（复用 UI 设计稿 `toggle-row` 的视觉样式：标题+说明+开关按钮）
- [ ] 切换任一开关立即持久化到数据库，无需额外"保存"按钮
- [ ] 应用重启后开关状态保持切换前的值
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-003: "翻译非中文消息"开关接入
**Description:** As a user, I want to turn off automatic translation, so pasting non-Chinese messages doesn't trigger an AI call I don't want.

**Acceptance Criteria:**
- [ ] 开关默认开启（与当前行为一致：非中文消息自动翻译）
- [ ] 关闭后，粘贴非中文消息不再调用翻译、气泡下方不显示翻译区块，且不发起任何 LLM 请求
- [ ] 开启后行为与当前一致：非中文消息自动附带中文翻译
- [ ] 切换开关无需重启应用，下一次粘贴消息即生效
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-004: "生成时自动添加到历史"开关接入
**Description:** As a user, I want clicking "复制" to also add the reply to the conversation history when this is on, so I don't need two separate clicks.

**Acceptance Criteria:**
- [ ] 开关默认关闭（保持当前行为：复制与加入对话历史是两个独立按钮/动作）
- [ ] 开启后，候选回复卡片上的"复制"按钮点击后：复制到剪贴板 **且** 自动把该条回复加入对话历史（等价于同时触发现有的复制与加入对话两个动作）
- [ ] 开启状态下，原本独立的"加入对话"按钮可以保留（点击效果与复制按钮触发的加入历史行为一致，不产生重复消息）
- [ ] 关闭后行为与当前一致：复制只复制，加入历史需单独点击
- [ ] 切换开关无需重启应用，下一次生成回复即生效
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-005: "自动信息提取"开关接入
**Description:** As a privacy-conscious user, I want to turn off automatic background info extraction, so the AI doesn't silently record facts about me or the other person from every message.

**Acceptance Criteria:**
- [ ] 开关默认开启（与当前行为一致：每条消息插入后台自动触发信息提取）
- [ ] 关闭后，粘贴/添加消息不再触发后台信息提取调用，聊天对象与角色的"基本信息"字段不再被自动追加
- [ ] 开启后行为与当前一致
- [ ] 切换开关无需重启应用，下一条消息即按新状态生效
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-006: 深色模式开关与全局深色主题
**Description:** As a user, I want a dark mode option, so I can use the app comfortably in low-light settings.

**Acceptance Criteria:**
- [ ] 设计 token 层新增深色配色变量（背景/表面/文字/边框等），覆盖首页、角色页、模型页、设置页、聊天页全部已有组件
- [ ] 开关默认关闭（浅色模式，与当前唯一支持的外观一致）
- [ ] 开启后应用整体（含已打开的其他页面）立即切换为深色配色，无需重启
- [ ] 重启应用后保持上次选择的模式
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)，需截图确认至少首页、聊天页在深色模式下的可读性（文字对比度、边框可见）

### US-007: 端到端测试：设置与模型页拆分 + 偏好开关生效
**Description:** As a QA engineer, I want an automated end-to-end test covering the split pages and preference toggles, so we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试：从首页分别进入"模型"页与"设置"页，确认模型页仍可完成创建模型卡片，设置页不出现任何模型卡片相关内容
- [ ] E2E 测试：关闭"翻译非中文消息"后粘贴一条非中文消息，断言不出现翻译区块（结合 mock LLM server 的请求计数，断言未发起翻译请求）
- [ ] E2E 测试：开启"生成时自动添加到历史"后点击候选回复"复制"，断言该条回复出现在对话历史中
- [ ] 覆盖边界场景：关闭"自动信息提取"后添加消息，断言聊天对象基本信息字段未被追加
- [ ] 测试在 CI 中运行并通过
- [ ] 测试独立可重复，自行创建与清理所用数据（沿用既有 `E2E_USER_DATA_DIR` 隔离机制）

## 4. Functional Requirements

- FR-1: 首页顶栏必须新增独立入口，进入模型卡片管理页面（内容与现有设置页的模型部分完全一致，仅换路由）
- FR-2: 设置页必须不再包含任何模型卡片相关 UI 或数据读取
- FR-3: 系统必须新增一张独立的单行偏好设置表，存储本 PRD 涉及的全部开关状态
- FR-4: 设置页必须以开关行（标题+说明+开关按钮）形式展示：翻译非中文消息、生成时自动添加到历史、自动信息提取、深色模式
- FR-5: 切换任一开关必须立即持久化，且立即对后续行为生效，无需重启应用
- FR-6: 翻译非中文消息关闭时，粘贴消息流程必须完全跳过翻译调用
- FR-7: 生成时自动添加到历史开启时，候选回复的"复制"操作必须同时完成复制与加入对话历史
- FR-8: 自动信息提取关闭时，消息插入后不得触发后台信息提取调用
- FR-9: 深色模式开启时，全部已有页面与组件必须切换为对应的深色配色变量，不得出现浅色模式残留的硬编码颜色
- FR-10: 深色模式状态必须在应用启动时读取上次保存的值并应用，不需要用户每次手动重新开启

## 5. Non-Goals (Out of Scope)

- 不实现"关闭应用时保留历史记录"开关（UI 设计稿中已有但本次不做，聊天记录始终本地持久化，不提供"退出清空"选项）
- 不实现"发送使用统计（匿名）"开关（需要真实的遥测后端，超出本次范围；不做仅 UI 占位的假开关）
- 不提供"跟随系统"的深色模式第三态，仅提供开/关两态
- 不做设置项的搜索/分组/多级导航，开关列表保持单页平铺
- 不做跨设备的设置同步

## 6. Design Considerations

- 模型页复用现有 `SettingsScreen` 的全部 UI 实现（列表、创建/编辑弹窗、删除确认、当前徽章、测试连接、设为当前模型），只是整体搬到新路由/新组件文件
- 设置页开关行样式来自 `UI design/settings.html` 的 `.toggle-row`/`.toggle` 样式（标题 14px + 说明 12px 灰色 + 42×24 胶囊开关），复刻其视觉但接入真实状态而非纯前端 `classList.toggle`
- 深色模式的配色需要在 `src/styles/tokens.css` 基础上补充一套深色变量，具体色值需重新设计（当前设计稿未提供深色版本），需保证与现有浅色配色相同的语义分层（accent/surface/text/border/semantic）

## 7. Technical Considerations

- 新表命名建议 `app_preference`（`id INTEGER PRIMARY KEY CHECK (id=1)`，与现有 `settings` 单行表模式一致但完全独立，不复用已废弃的 `settings` 表列）
- 首页导航状态机（`App.tsx` 的 `View` 联合类型）需新增一个视图值（如 `'models'`），并把现有 `SettingsScreen` 拆成 `ModelsScreen`（原模型卡片内容）与新的 `SettingsScreen`（开关列表）
- 翻译开关：`electron/main/ipc/register.ts` 的 `messageTranslate` handler 调用前置读取偏好，关闭时前端直接跳过调用 `window.api.message.translate`，不发起 IPC
- 自动信息提取开关：`electron/main/ipc/register.ts` 的 `message:insert` handler 中，`extractAndSaveInfo` 的 fire-and-forget 调用前置读取偏好，关闭时不调用
- 深色模式：建议采用 CSS 变量在 `:root`/`[data-theme="dark"]` 两套取值 + 在应用根节点动态设置 `data-theme` 属性的方案，避免为每个组件写重复的深色样式
- 复用 #14-#18 已建立的"单行配置表 + repository + IPC + preload 桥接"模式，减少新模式引入

## 8. Success Metrics

- 用户可以在不经过"设置"页面的情况下，通过首页独立入口在 2 次点击内进入模型卡片管理
- 关闭对应开关后，翻译/自动信息提取功能 100% 不再发起 LLM 调用（可通过请求计数验证）
- 深色模式下应用全部页面视觉一致，无浅色硬编码残留

## 9. Open Questions

- [Assumption] "生成时自动添加到历史"默认关闭（保持当前两个独立按钮的行为），而非设计稿截图里展示的默认开启状态——设计稿的"开"更像是示意状态而非产品决策，倾向于默认不改变现有交互习惯，待用户确认
- 深色模式的具体色值方案（是否需要设计师介入，还是由实现时按现有语义自行推导一套深色配色）尚未确定
- "关闭应用时保留历史记录""发送使用统计"这两个设计稿已有但本次排除的开关，是否需要在设置页 UI 上以"即将推出"的禁用状态展示，还是完全不出现？（倾向完全不出现，避免展示不可用功能）
