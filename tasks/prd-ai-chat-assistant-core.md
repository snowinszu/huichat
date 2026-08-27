# PRD: AI 聊天辅助助手 — 核心闭环（Phase 1）

## 1. Introduction/Overview

很多人不擅长在社交软件上聊天：不知道怎么回、怕说错话、想不出合适的语气。这个功能要做一个 **Electron 桌面应用**，帮用户"代笔"社交聊天回复：用户把对方发来的消息复制粘贴进应用，AI 根据这段对话的背景（对方是谁、这次聊天想达成什么目标、用户自己扮演什么角色）生成 3 条不同语气的候选回复，用户挑一条一键复制回真正的聊天软件里发送。应用不接入任何社交平台账号，只做"辅助生成"，不做自动发送。

本 PRD 覆盖 **Phase 1（核心闭环）**：聊天对象卡片管理、粘贴消息生成回复、语气选择、重新生成、一键复制、自动信息提取、外语翻译、内容润色、设置页 LLM 配置。

以下功能明确 **不在本 PRD 范围内**，将作为 **Phase 2 PRD** 单独规划：聊天复盘总结报告、AI 自动总结对方风格/性格特征、应用锁（密码保护）、聊天回滚、联网搜索获取外部信息。

## 2. Goals

- 用户能在 3 步以内（粘贴消息 → 选语气 → 复制）完成"看到对方消息"到"拿到可发送回复"的全流程
- 每个聊天对象的背景信息（对方资料、聊天目标、己方角色）集中存储在一张"卡片"上，AI 生成时自动带入这些上下文
- 生成结果始终提供 3 条候选，且支持一键重新生成，避免用户被单一结果卡住
- 非中文的粘贴消息自动附带中文翻译，降低外语聊天门槛
- 所有聊天记录和卡片信息本地持久化，重启应用后不丢失

## 3. User Stories

### US-001: Electron 项目初始化与 pi-agent 集成
**Description:** As a developer, I need an Electron app shell with a local SQLite database and pi (earendil-works/pi) integrated as the multi-provider LLM client, so the app has a working technical foundation for all subsequent features.

**Acceptance Criteria:**
- [ ] Electron app boots to a main window via `npm run dev`（或等效命令）
- [ ] pi 作为依赖集成，可在 main 进程中通过给定的 provider + API key 发起一次 LLM 调用并拿到返回内容
- [ ] 首次启动时在本地 app-data 目录初始化 SQLite 数据库文件，并创建初始表结构（migration）
- [ ] Typecheck/lint passes

### US-002: 设置页面 — LLM 配置
**Description:** As a user, I want a settings page to input my LLM API key and choose a provider/model, so the app can generate content using my own account.

**Acceptance Criteria:**
- [ ] 主导航可进入设置页
- [ ] 表单包含：provider 选择（下拉，至少含 OpenAI、Anthropic、智谱 GLM、MiniMax、Kimi（Moonshot）、通义千问（Qwen）、自定义 OpenAI 兼容端点）、API key（输入框，界面以 `*` 掩码显示，无需额外加密存储）、model 名称/选择
- [ ] 保存后配置持久化到本地数据库，重启应用后仍生效
- [ ] API key 为空或格式明显非法时阻止保存，并显示行内错误提示
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-003: 创建/管理己方角色 Profile
**Description:** As a user, I want to create multiple "my persona" profiles, so I can reuse a consistent self-identity across different chat targets.

**Acceptance Criteria:**
- [ ] 有一个角色列表页展示所有已创建的己方角色（名称 + 摘要）
- [ ] 支持创建/编辑/删除角色，字段包括：角色名称、基本信息（自由文本）
- [ ] 删除一个已被聊天对象卡片引用的角色时，弹出确认提示说明影响
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-004: 创建/管理聊天对象卡片
**Description:** As a user, I want to create a chat target card holding the other person's info, my ultimate goal for this relationship, and which persona I'm using, so all chat context lives in one place.

**Acceptance Criteria:**
- [ ] 首页有"新建聊天对象"按钮，点击打开创建表单
- [ ] 表单字段：对方基本信息（自由文本）、头像上传（图片文件，本地存储并显示缩略图）、聊天最终目标（自由文本）、己方角色（从 US-003 已创建角色中选择）
- [ ] 首页以卡片形式展示所有聊天对象（头像 + 名称/摘要）
- [ ] 支持编辑已有卡片信息；支持删除卡片（删除前需二次确认）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-005: 设置本次聊天的短期目标
**Description:** As a user, I want to set a short-term goal for the current chat session separately from the long-term goal, so replies can be tailored to what I'm trying to accomplish right now.

**Acceptance Criteria:**
- [ ] 聊天界面内可直接编辑该卡片的"短期目标"字段（不必回到卡片编辑表单）
- [ ] 短期目标随卡片持久化，并在后续生成回复时作为上下文传给 AI
- [ ] 修改短期目标后无需重启应用，下一次生成即生效
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-006: 聊天界面 — 粘贴对方消息并自动翻译
**Description:** As a user, I want to paste the other person's message into the chat screen and, if it's not Chinese, see a Chinese translation next to it, so I always understand what they said.

**Acceptance Criteria:**
- [ ] 聊天界面有输入/粘贴框，提交后该消息以"对方"消息气泡形式加入对话线程
- [ ] 系统自动检测消息语言；非中文时自动生成中文翻译并在气泡旁/下方展示
- [ ] 中文消息不显示翻译区块
- [ ] 消息原文与翻译（如有）关联该聊天卡片持久化到数据库
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-007: 生成三条候选回复（含语气选择）
**Description:** As a user, I want the AI to generate three candidate replies in a tone I choose, so I can pick the best one to send.

**Acceptance Criteria:**
- [ ] 聊天界面提供语气选择器（单选），至少包含：礼貌、幽默、暧昧、真诚、撒娇、高冷、简洁直接、安慰共情，用户须先选定唯一一种语气才能生成
- [ ] 点击"生成回复"会调用 LLM（经由 pi），带入卡片上下文（对方信息/己方角色/最终目标/短期目标/历史消息）与用户选定的单一语气，返回 3 条内容不同、但语气统一为该选定语气的候选回复（并非一条语气对应一条回复）
- [ ] 3 条候选并排/列表展示，每条可独立复制
- [ ] 生成过程中显示 loading 状态；调用失败时显示错误状态并提供重试按钮
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-008: 重新生成按钮
**Description:** As a user, I want a regenerate button to get new candidate replies when I'm not satisfied with the current ones, so I'm not stuck with the first result.

**Acceptance Criteria:**
- [ ] 候选回复旁的"重新生成"按钮会用相同上下文/语气重新发起一次生成
- [ ] 新结果替换当前展示的 3 条候选（不影响已持久化的历史记录）
- [ ] 生成请求进行中时，重新生成按钮禁用，防止重复提交
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-009: 一键复制回复内容
**Description:** As a user, I want to copy a chosen candidate reply with one click, so I can paste it into my actual chat app.

**Acceptance Criteria:**
- [ ] 每条候选回复上有复制按钮
- [ ] 点击复制将纯文本写入系统剪贴板，并显示短暂的成功提示（如 toast/勾选图标）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-010: 己方内容润色
**Description:** As a user, I want to type what I want to say and have the AI polish it, so my message sounds better while keeping my original intent.

**Acceptance Criteria:**
- [ ] 界面提供与"生成回复"区分开的输入框（如"我想表达…"），接受自由文本
- [ ] "润色"操作将草稿 + 上下文（语气、卡片信息）发给 LLM，返回润色后的版本
- [ ] 润色结果可复制，也可作为"己方"消息加入对话线程
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-011: 图片/表情内容标注
**Description:** As a user, I want to describe an image or sticker the other person sent by picking a content type and typing its meaning, so the AI can use that context without doing actual image recognition.

**Acceptance Criteria:**
- [ ] 在对方消息输入区，用户可选择添加"图片/表情"条目（可替代或附加于文本消息）
- [ ] 该条目需填写：内容类型（下拉，如 表情/图片/其他）+ 文字含义描述（自由文本，如"一只猫咪偎依在主人身边"）
- [ ] 该条目会被纳入后续生成回复的上下文
- [ ] 该条目在对话线程中以独立气泡样式展示（图标 + 描述文字）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-012: 自动提取并记录双方信息
**Description:** As a user, I want the app to automatically pick up new facts about myself and the other person as the chat progresses, so future replies stay consistent with what's already been said.

**Acceptance Criteria:**
- [ ] 每次新增一条对方或己方消息后，触发一次信息提取（经由 LLM），识别消息中提到的新事实（如姓名、日期、偏好等）
- [ ] 提取到的信息追加保存到该卡片的对方信息/己方角色信息中，用户可在卡片详情中查看和编辑
- [ ] 提取失败（如 LLM 调用出错）不阻塞正常聊天流程，仅静默记录错误日志
- [ ] 已提取信息会作为上下文用于后续回复生成
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-013: 聊天记录持久化
**Description:** As a developer, I need every chat message, translation, extracted fact, and card change saved to the local database, so nothing is lost between sessions and later features (e.g. summary reports) can rely on complete history.

**Acceptance Criteria:**
- [ ] 每条消息（对方/己方，不含未发送的候选回复）写入 SQLite，关联对应卡片 ID 与时间戳
- [ ] 应用重启后重新打开某聊天卡片，能按时间顺序看到完整历史消息
- [ ] 卡片信息（资料/目标/角色关联）的编辑会立即持久化并在界面同步反映
- [ ] Typecheck/lint passes

### US-014: 端到端测试 — 完整聊天辅助流程
**Description:** As a QA engineer, I want an automated end-to-end test covering the full chat-assist journey, so we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试创建一个己方角色、创建一张引用该角色的聊天对象卡片，并设置最终目标与短期目标
- [ ] 测试粘贴一条对方消息（含至少一条非中文消息），断言翻译正确展示
- [ ] 测试选择一种语气并生成 3 条候选回复，断言返回 3 条不同内容，复制其中一条并断言剪贴板内容正确
- [ ] 测试点击"重新生成"，断言候选内容发生变化
- [ ] 覆盖边界场景：LLM 调用失败（如无效 API key）时界面显示错误状态而非崩溃
- [ ] 测试可在 CI 中运行并通过
- [ ] 测试自行创建与清理所用数据（角色/卡片/消息）

## 4. Functional Requirements

- FR-1: 系统必须以 Electron 桌面应用形式运行，使用本地 SQLite 数据库持久化数据，不做云端同步
- FR-2: 系统必须通过 pi（earendil-works/pi）统一调用用户在设置页配置的 LLM provider
- FR-3: 系统必须提供设置页，允许用户配置 LLM provider（至少含 OpenAI、Anthropic、智谱 GLM、MiniMax、Kimi、通义千问、自定义 OpenAI 兼容端点）、API key、model
- FR-4: 系统必须支持创建、编辑、删除多个"己方角色"档案
- FR-5: 系统必须支持创建、编辑、删除"聊天对象卡片"，卡片包含对方基本信息、头像、聊天最终目标、关联的己方角色
- FR-6: 系统必须支持在卡片/聊天界面内设置并编辑本次聊天的短期目标
- FR-7: 系统必须允许用户粘贴对方消息文本，并将其作为消息记录加入对应卡片的对话线程
- FR-8: 当粘贴的对方消息被检测为非中文时，系统必须自动生成并展示中文翻译
- FR-9: 系统必须支持用户选择语气（至少含礼貌、幽默、暧昧、真诚、撒娇、高冷、简洁直接、安慰共情）后生成 3 条候选回复
- FR-10: 系统必须提供"重新生成"操作，基于相同上下文与语气重新生成 3 条候选回复
- FR-11: 系统必须为每条候选回复提供一键复制到系统剪贴板的功能
- FR-12: 系统必须支持用户输入自己想表达的草稿内容，并调用 AI 对其进行润色
- FR-13: 系统必须支持用户为对方发送的图片/表情添加"内容类型 + 文字含义"标注，并将其纳入生成上下文
- FR-14: 系统必须在每次新增消息后自动提取双方新增的事实信息，并追加到卡片对应信息字段中
- FR-15: 系统必须将所有聊天消息、翻译结果、提取信息与卡片变更持久化到本地数据库

## 5. Non-Goals (Out of Scope)

- 不直接对接任何社交平台账号或 API，不做自动发送，仅支持复制粘贴
- 不做聊天复盘总结报告（留待 Phase 2 PRD）
- 不做 AI 自动总结对方风格/性格特征来指导生成（留待 Phase 2 PRD）
- 不做应用锁/密码保护（留待 Phase 2 PRD）
- 不做聊天回滚功能（留待 Phase 2 PRD）
- 不做联网搜索获取外部最新信息（留待 Phase 2 PRD）
- 不做图片/表情的图像识别或图像生成，仅支持用户手动标注内容类型与文字含义
- 不做云端数据同步或多设备协同

## 6. Design Considerations (Optional)

- 应用为 Electron 桌面应用，UI 以桌面窗口尺寸为基准设计（非移动端），需支持窗口缩放时的基本响应式布局（如最小宽度、卡片网格自适应换行）
- 首页采用卡片网格布局展示聊天对象，卡片包含头像、名称摘要、最近消息预览
- 聊天界面采用双栏或上下结构：上方为对话线程（气泡样式区分"对方"/"己方"/"图片标注"三种类型），下方为输入区（粘贴框、语气选择器、生成/重新生成按钮、润色输入框）
- 候选回复以卡片列表形式并排展示在生成区，每条附复制按钮

## 7. Technical Considerations (Optional)

- AI 框架：使用 pi（[github.com/earendil-works/pi](https://github.com/earendil-works/pi)），TypeScript/Node 实现的统一多 provider LLM API + agent loop，适合运行在 Electron 主进程中
- Provider 覆盖：需支持 OpenAI、Anthropic、智谱 GLM、MiniMax、Kimi（Moonshot）、通义千问（Qwen）等主流模型，以及自定义 OpenAI 兼容端点；若 pi 未原生支持某家，需评估通过其 OpenAI 兼容接口接入
- 数据库：本地 SQLite（如 better-sqlite3），首次启动时创建 schema；表至少包括 persona（己方角色）、chat_card（聊天对象卡片）、message（聊天消息）、settings（LLM 配置）
- 翻译复用设置页配置的同一 LLM 完成，不引入额外的独立翻译 API 依赖
- API key 存储在本地数据库/配置文件中，以明文保存；仅在设置页 UI 层以 `*` 掩码显示，Phase 1 不做操作系统级密钥库（Keychain）加密，完整的访问保护留待 Phase 2（应用锁）一并设计
- 头像与图片标注不涉及图像内容的 AI 识别，仅做本地文件存储与展示
- 主进程与渲染进程之间通过 IPC 传递 LLM 调用请求，避免直接在渲染进程暴露 API key

## 8. Success Metrics

- 从粘贴对方消息到复制一条回复，用户操作步骤 ≤ 4 步（粘贴 → 选语气 → 生成 → 复制）
- 100% 的非中文粘贴消息展示中文翻译
- 新建聊天对象卡片到获得第一条生成回复，操作步骤 ≤ 5 步
- E2E 测试（US-014）在 CI 中稳定通过

## 9. Open Questions

- US-012 自动提取的信息是否需要用户确认后才写入卡片，还是静默写入、事后可编辑？`[Assumption: 静默写入，用户可在卡片详情中随时编辑/删除]`
- 语气预设（礼貌/幽默/暧昧/真诚/撒娇/高冷/简洁直接/安慰共情）是否需要支持用户自定义新增？`[Assumption: Phase 1 使用固定预设列表，自定义语气留待后续]`
