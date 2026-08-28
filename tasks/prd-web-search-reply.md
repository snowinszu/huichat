# PRD: 生成回复时按需联网搜索

## Introduction/Overview

"会聊"生成候选回复的核心流程（[generateReplies.ts](../electron/main/llm/generateReplies.ts)、经由 [register.ts](../electron/main/ipc/register.ts) 的 `reply:generate` handler）目前是纯单轮 LLM 调用（[client.ts](../electron/main/llm/client.ts) 的 `callLlm`），模型既不知道"今天"是哪天，也没有任何实时信息来源。当对方发来"明天天气怎么样啊""李健什么时候开演唱会"这类时效性问题时，模型只能靠训练数据里的旧知识瞎编，或含糊带过，生成的候选回复不可用。

本功能让"生成回复"这一步具备按需联网查询实时信息的能力：生成候选回复的同一次 LLM 调用会顺便判断这条对话是否需要查实时信息；需要的话调用 Tavily 搜索 API 拿到结果，再用结果重新生成一版更准确的候选回复。不需要联网的普通闲聊完全走原有单次调用路径，不产生额外延迟或费用。

## Goals

- 对方消息涉及天气、日期、新闻、演出/赛事时间等时效性问题时，生成的候选回复能给出具体、准确的实时信息，而不是模糊搪塞或编造
- 不涉及时效性问题的正常聊天，生成流程、延迟、prompt 内容与功能上线前完全一致，零回归
- 联网搜索是可选功能：用户不开启时整个应用行为不变；开启后需要用户自备 Tavily API Key
- 搜索失败（网络错误、Key 无效、无结果）时始终能拿到 3 条兜底候选回复，绝不因为搜索失败卡住或报错

## User Stories

### US-001: 联网搜索设置项的存储与迁移
**Description:** As a developer, I need `web_search_enabled` 和 `web_search_api_key` 持久化存储，以便应用记住用户是否开启联网搜索及其 Tavily Key。

**Acceptance Criteria:**
- [ ] `app_preference` 表（[schema.ts](../electron/main/db/schema.ts)）新增 `web_search_enabled INTEGER NOT NULL DEFAULT 0` 与 `web_search_api_key TEXT` 两列，种子 `INSERT OR IGNORE` 同步更新
- [ ] 新增迁移函数（仿照 `migrateAppPreferenceDebugExportColumns`，见 [migrations.ts](../electron/main/db/migrations.ts)）为已存在旧安装的 `app_preference` 表补上这两列，并在 [db/index.ts](../electron/main/db/index.ts) 的初始化序列中调用
- [ ] `AppPreferenceRecord` / `UpdateAppPreferenceInput`（[ipc-types.ts](../electron/shared/ipc-types.ts)）新增 `webSearchEnabled: boolean`、`webSearchApiKey: string | null`
- [ ] `appPreferenceRepository.ts` 的 `toRecord`/`UPDATABLE_COLUMNS`/`COLUMN_PARAM_VALUE` 三处按现有模式补上新字段（`webSearchApiKey` 走字符串直传，不能套用布尔的 `? 1 : 0` 转换）
- [ ] `DEFAULT_APP_PREFERENCE`（[appPreferenceDefaults.ts](../src/lib/appPreferenceDefaults.ts)）补上 `webSearchEnabled: false`、`webSearchApiKey: null`
- [ ] 复用现有 `app-preference:get`/`app-preference:update` IPC channel，不新增 channel
- [ ] Typecheck/lint passes

### US-002: Tavily 搜索客户端模块
**Description:** As a developer, I need a `searchWeb()` function that queries Tavily and returns structured results, so the reply-generation flow has a real source of current information.

**Acceptance Criteria:**
- [ ] 新增 `electron/main/llm/webSearch.ts`，导出 `searchWeb(apiKey: string, query: string): Promise<WebSearchResult[]>`（`WebSearchResult` 含 `title`/`url`/`content`），使用 Node 22 原生全局 `fetch` POST Tavily 的 `/search` 接口，返回结果按相关度取前 5 条
- [ ] 请求的服务端地址可通过一个 E2E 专用环境变量覆盖（仿照 [index.ts](../electron/main/index.ts) 里 `E2E_USER_DATA_DIR` 的写法），使 E2E 测试能指向本地 mock server 而非真实 Tavily
- [ ] 网络失败、非 2xx 响应、鉴权失败等情况统一抛出一个带明确 message 的 `Error`，不在本模块内静默吞掉或重试
- [ ] 导出 `formatSearchResults(results: WebSearchResult[]): string`，将结果拼成供 prompt 使用的文本块（标题 + 摘要 + 来源链接）
- [ ] Typecheck/lint passes

### US-003: 生成回复 prompt 支持"顺便判断是否需要联网"与二次生成
**Description:** As a user, I want the reply-generation prompt to decide for itself whether a web search is needed, so I don't have to manually flag time-sensitive questions.

**Acceptance Criteria:**
- [ ] `buildReplyPrompt`（[generateReplies.ts](../electron/main/llm/generateReplies.ts)）新增两个互斥的可选参数：`webSearchEnabled`（第一阶段：注入当前日期，要求模型 JSON 输出除 `replies` 外再带 `needsSearch: boolean` 和 `searchQuery: string | null`，且即便 `needsSearch` 为 true 也必须照常给出 3 条兜底 `replies`）与 `searchResults`（第二阶段：把结果拼进新增的【实时搜索结果】区块，schema 退回纯 `replies`）；两个参数都不传时行为与现状完全一致
- [ ] 新增 `parseGenerateRepliesResponse(text): { replies: ReplyCandidate[]; needsSearch: boolean; searchQuery: string | null }`，复用现有 `toReplyCandidate` 辅助函数解析扩展后的 JSON；原有 `parseReplies` 不改动，继续给"未开启联网""第二阶段"以及 `reply:polish` 使用
- [ ] `needsSearch` 判断标准明确写入 prompt 指令：仅当对方最后一条消息涉及模型无法确定的时效性信息（天气、日期、新闻、演出/赛事时间等）时才应设为 true，普通闲聊/情感类问题不触发
- [ ] Typecheck/lint passes

### US-004: reply:generate 编排两阶段流程与优雅降级
**Description:** As a user, I want reply generation to automatically search and regenerate when needed, and to still work smoothly when search fails, so a bad network or invalid key never blocks me from getting a reply.

**Acceptance Criteria:**
- [ ] `reply:generate` handler（[register.ts](../electron/main/ipc/register.ts)）读取 `AppPreferenceRecord`，仅当 `webSearchEnabled && webSearchApiKey` 均就绪时才走两阶段流程，否则原样走现有单次调用路径（不构造任何联网相关 prompt 文案）
- [ ] 两阶段流程：第一次 `callLlm` → `parseGenerateRepliesResponse`；`needsSearch` 为 false 时直接返回第一次的 `replies`，全程只发生一次 LLM 调用
- [ ] `needsSearch` 为 true 时调用 `searchWeb(webSearchApiKey, searchQuery)`；搜索抛错或返回空结果时直接回退返回第一阶段的兜底 `replies`，不再重试、不向渲染层暴露搜索失败的错误
- [ ] 搜索成功时用 `formatSearchResults` 结果调用 `buildReplyPrompt(..., searchResults)` 发起第二次 `callLlm`，`parseReplies` 解析后作为最终结果返回
- [ ] 两次 `callLlm` 调用都各自走一遍 `debugExportContextFor`，source 标签区分"生成回复（判断联网）"与"生成回复（联网后）"，便于调试导出日志区分两轮
- [ ] IPC 返回类型保持 `ReplyCandidate[]` 不变，渲染层（聊天界面）无需任何改动
- [ ] Typecheck/lint passes

### US-005: 设置页联网搜索开关与 Key 管理
**Description:** As a user, I want a toggle and API key field in Settings, so I can turn web search on/off and manage my Tavily key myself.

**Acceptance Criteria:**
- [ ] 设置页（[SettingsScreen.tsx](../src/screens/settings/SettingsScreen.tsx)）新增"联网搜索"卡片，含 `Toggle`（label"联网搜索"，description 说明用途及需要 Tavily API Key）
- [ ] 开启开关且当前未保存过 Key 时，弹出 `Modal`（复用 `PasswordInput`，交互方式对齐现有"设置锁屏密码"弹窗）录入 Tavily API Key，确认后一次性 `appPreference.update({ webSearchEnabled: true, webSearchApiKey })`；已保存过 Key 时点击开关直接走普通 toggle 保存
- [ ] Key 已设置时展示掩码预览（复用 `providerMeta.ts` 的 `maskApiKey`）与"更改 Key"按钮，点击复用同一个 Modal 重新录入
- [ ] 关闭开关时仅更新 `webSearchEnabled: false`，不清除已保存的 Key（下次开启无需重新输入）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-006: 端到端测试——联网搜索完整流程
**Description:** As a QA engineer, I want an automated end-to-end test covering the full web-search reply journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] 新增 `e2e/web-search-reply.spec.ts`，仿照现有测试用 `startMockLlmServer`（[mockLlmServer.ts](../e2e/support/mockLlmServer.ts)）模拟 LLM，同时起一个本地 mock HTTP server 模拟 Tavily 接口，通过 US-002 新增的 E2E 环境变量指向它
- [ ] 测试在设置页开启"联网搜索"并填入 mock Key，粘贴一条时效性问题消息（如"明天天气怎么样"），点击"生成回复"：断言 mock LLM 收到了两次请求（第一次带 `needsSearch` 判断的 prompt，第二次 prompt 含【实时搜索结果】区块），且 mock Tavily server 收到了一次搜索请求，最终候选回复渲染出来
- [ ] 覆盖边界场景：mock LLM 对某条非时效性消息返回 `needsSearch: false`，断言全程只发生一次 LLM 调用、Tavily mock server 未被请求
- [ ] 覆盖边界场景：mock Tavily server 返回错误状态码，断言生成流程不报错，最终仍渲染出第一阶段的兜底候选回复
- [ ] 测试运行于 CI 并通过
- [ ] 测试独立可重复运行，自行创建和清理所需的聊天卡片、模型卡片数据

## Functional Requirements

- FR-1: 系统必须为"联网搜索"提供独立的开关设置，默认关闭，关闭时生成回复的 prompt、调用次数与功能上线前完全一致
- FR-2: 系统必须要求用户在开启联网搜索前提供 Tavily API Key，并将其与开关状态一并持久化存储
- FR-3: 系统必须在联网搜索开启且 Key 已配置时，于生成回复的第一次 LLM 调用中一并要求模型输出"是否需要联网"（`needsSearch`）及"搜索关键词"（`searchQuery`），且无论是否需要联网都必须同时给出 3 条兜底候选回复
- FR-4: 系统必须仅在 `needsSearch` 为 true 时才实际发起搜索请求，为 false 时直接使用第一次调用产出的候选回复，不产生第二次 LLM 调用或任何搜索请求
- FR-5: 系统必须在搜索请求失败（网络错误、鉴权失败、无结果）时回退使用第一阶段的兜底候选回复，不向用户暴露错误、不阻塞生成流程
- FR-6: 系统必须在搜索成功后，将搜索结果注入新一轮 prompt 的独立区块中，发起第二次 LLM 调用生成最终候选回复并返回
- FR-7: 系统必须保证联网搜索相关逻辑只作用于"生成回复"（`reply:generate`），不改变"润色"（`reply:polish`）的行为
- FR-8: 系统必须在设置页提供联网搜索开关与 API Key 录入/查看/更改入口，Key 展示时做掩码处理
- FR-9: 系统必须保证联网搜索对聊天渲染界面透明——候选回复的展示形式、数量、字段与未开启联网搜索时完全一致，不额外展示搜索来源标识或链接

## Non-Goals (Out of Scope)

- 不覆盖"润色回复"（`reply:polish`）功能，该流程本次保持不变
- 不在候选回复 UI 上展示"来自联网搜索"的标识、图标或来源链接——搜索结果只作为生成时的参考信息，自然融入回复文本
- 不做搜索频率/用量限制或额度预警，交由用户自行控制 Tavily Key 的使用量
- 不支持除 Tavily 外的其他搜索引擎（含国内引擎），也不做多引擎切换
- 不缓存搜索结果，每次触发都是一次新请求
- 不引入通用的 LLM tool-calling / function-calling 框架，也不改变现有 10 个 provider 的调用抽象（[client.ts](../electron/main/llm/client.ts)）——联网能力完全由应用层的两阶段 prompt 编排实现，与用户选用哪个 LLM provider 无关
- 不提供"测试联网搜索连接"这类独立的连接测试入口（区别于模型卡片已有的连接测试）

## Design Considerations

- 设置页"联网搜索"卡片的交互模式完全复用已有两种成熟模式的组合：Toggle 开启触发信息录入弹窗（对齐"导出提示词调试日志"开启时先选目录的套路）+ Modal 内用 `PasswordInput` 录入密钥（对齐"设置锁屏密码"弹窗）
- Key 掩码展示复用 `providerMeta.ts` 现成的 `maskApiKey`，与模型卡片列表里 API Key 的展示方式保持一致，不新造一套展示逻辑
- 聊天界面（[chat 目录](../src/screens/chat)）不需要任何改动——这是本功能刻意收敛的设计目标之一：功能对渲染层完全透明

## Technical Considerations

- 复用 `app_preference` 单例表存储开关与 Key，不新建独立表，理由：这两个字段和 `debugPromptExport`/`debugExportDir` 是同一类"全局行为开关+配套配置"，行为模式已有现成范式可循
- `searchWeb` 请求体/鉴权字段（`api_key` in body vs `Authorization: Bearer`）需在实现时核对 Tavily 当前文档，历史上是 body 内带 `api_key`
- Node 22（见 [.nvmrc](../.nvmrc)）与 Electron 43 的主进程原生支持全局 `fetch`，无需为此新增网络请求依赖
- E2E 测试需要能拦截真实的 Tavily 网络请求——参照 `E2E_USER_DATA_DIR`（[index.ts](../electron/main/index.ts) 中已有先例）的模式新增一个环境变量，让 `webSearch.ts` 在测试环境下把请求指向本地 mock server，而不是引入 mock 框架去拦截 `fetch`
- `parseGenerateRepliesResponse` 与现有 `parseReplies` 共享 `toReplyCandidate` 解析辅助函数，避免重复实现 JSON 容错解析逻辑
- 两次 `callLlm` 调用复用同一个 `modelCard` 配置（用户当前选中的 LLM provider/model），搜索决策与最终生成用的是同一个模型，不引入"用小模型做分类、大模型做生成"的分层策略

## Success Metrics

- 人工测试：对包含天气/日期/演出时间等时效性问题的对方消息，开启联网搜索后生成的候选回复包含具体、非模糊的实时信息（US-006 的时效性用例可作为回归基准）
- 不涉及时效性问题的对话，开启联网搜索前后生成延迟基本一致（只产生一次 LLM 调用，无搜索请求）——由 US-006 的"非时效性消息只调用一次 LLM"用例保障
- 关闭联网搜索开关时，`reply:generate` 的 prompt 内容与调用次数与功能上线前逐字节一致——由代码路径分支（US-004）和 E2E 回归共同保障

## Open Questions

- 是否未来需要支持除 Tavily 外的搜索引擎（尤其是中文覆盖更好的国内引擎），以提升"李健演唱会"这类中文实体查询的准确率？本次已明确接受 Tavily 中文覆盖偏弱的取舍
- 是否需要把这一能力后续扩展到"润色回复"或其他 AI 调用点（如目标评估）？本次明确排除
- 未来用户量上升后，是否需要提供官方托管的搜索额度（而非人人自备 Key）？本次不在范围内
