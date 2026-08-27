# PRD: 聊天统计页面

## 1. Introduction/Overview

在首页每张聊天对象卡片（`ContactCard`）的右上角操作区，新增一个"统计"入口图标。点击后跳转到一个全新的统计页面，展示该聊天对象的各类聊天数据指标——发送了多少消息、多久聊一次、什么时候最活跃、双方谁更主动、以及基于当前配置的 AI 对长期/短期目标的达成情况给出的评估。

打个比方：这就像给每一段聊天关系生成一份"体检报告"——本来这些数据都分散记录在聊天记录里（`message` 表），现在把它们汇总、计算、可视化，让用户一眼看清这段关系的"聊天画像"。

## 2. Goals

- 让用户无需翻聊天记录，就能快速了解与某个聊天对象的互动强度、活跃规律和主动性对比
- 用可视化（图表）的方式呈现消息的时间分布规律（一天中什么时候聊、一周中哪几天聊）
- 借助已配置的 LLM，自动给出长期/短期目标的达成情况评估，作为决策参考
- 统计入口不打断现有首页/聊天页的操作路径，保持一致的导航模式

## 3. User Stories

### US-001: 聊天统计数据聚合（后端计算 + IPC）
**Description:** As a developer, I need a backend aggregation layer that computes all numeric/date-based chat stats for a given chat card, so the UI has a single source of truth to render.

**Acceptance Criteria:**
- [ ] 新增 `electron/main/db/chatStatsRepository.ts`，对外提供一个函数（如 `computeChatStats(db, chatCardId)`），基于 `message` 表中 `role IN ('self', 'other')` 的记录计算：我方消息数、对方消息数、活跃天数、首次聊天时间（最早消息 `created_at`）、最后聊天时间（最晚消息 `created_at`）、最长连续聊天天数（历史最长的"每天都有消息"连续日期串）、最长沉默时间（相邻两条消息之间最大时间间隔）、平均每日消息数（总消息数 ÷ 活跃天数，保留 1 位小数）、24 小时消息分布（按本地时间 0-23 时分桶计数）、星期一至星期日消息分布（按本地时间分桶计数）、双方主动发起聊天次数（每个有消息的自然日，取当天最早一条消息的 `role`，按 `role` 归类计数为"我方发起天数"/"对方发起天数"）
- [ ] `role = 'annotation'` 的记录不计入以上任何统计
- [ ] 聊天记录为空（该 chat_card 下没有 self/other 消息）时返回明确的"空数据"结构，不抛错
- [ ] 通过 `electron/preload` 暴露新 IPC 通道（如 `window.api.chatStats.get(chatCardId)`），并在 `electron/main/ipc/register.ts` 注册
- [ ] Typecheck/lint passes

### US-002: 卡片右上角新增统计入口，跳转到新页面
**Description:** As a user, I want a stats icon on each contact card so that I can jump straight into that contact's chat stats page.

**Acceptance Criteria:**
- [ ] `src/components/ui/icons.tsx` 新增一个统计/图表图标组件（如 `IconChart`），风格与现有图标（`IconEdit`、`IconTrash` 等）一致
- [ ] `ContactCard` 操作区（`styles.actions`，当前含编辑/删除按钮）新增统计按钮，新增 `onOpenStats` 回调 prop，点击时阻止事件冒泡（不触发卡片本身的 `onOpen`）
- [ ] `App.tsx` 的 `View` 联合类型新增 `'stats'` 分支，与现有 `'chat'` 分支一样携带对应的 `chatCardId`；点击统计图标后设置该 view 并渲染新的 `StatsScreen`
- [ ] `StatsScreen` 页面顶部有返回按钮，点击后回到首页（`view = 'home'`）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g. via the `run` skill)

### US-003: 统计页面 —— 核心数字指标展示
**Description:** As a user, I want to see the core numeric stats for a contact so that I can understand our interaction volume and rhythm at a glance.

**Acceptance Criteria:**
- [ ] 页面加载时调用 `window.api.chatStats.get(chatCardId)`，展示：我发送的消息数、对方发送的消息数、活跃天数、首次聊天时间（格式化为可读日期时间）、最后聊天时间、最长连续聊天天数、最长沉默时间（格式化为"N天N小时"等可读时长）、平均每日消息数、我方主动发起聊天次数、对方主动发起聊天次数
- [ ] 数据加载中显示 loading 状态；加载失败显示错误提示
- [ ] 该聊天对象没有任何 self/other 消息时，显示明确的空状态提示（如"暂无聊天记录，还没有可统计的数据"），不展示图表或目标评估区块
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g. via the `run` skill)

### US-004: 统计页面 —— 24 小时消息分布图
**Description:** As a user, I want to see a chart of message counts by hour of day so that I know when this contact and I are most active.

**Acceptance Criteria:**
- [ ] 以柱状图展示 0-23 时each 小时的消息总数（self + other 合计，按本地时间分桶）
- [ ] 全部小时消息数为 0 时，图表仍正常渲染（各柱为 0），不报错
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g. via the `run` skill)

### US-005: 统计页面 —— 星期分布图
**Description:** As a user, I want to see a chart of message counts by weekday so that I know which days of the week we chat most.

**Acceptance Criteria:**
- [ ] 以柱状图展示周一至周日（本地时间）each 天的消息总数（self + other 合计）
- [ ] 星期顺序固定为周一 → 周日
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g. via the `run` skill)

### US-006: 聊天目标达成情况（AI 自动评估）
**Description:** As a user, I want the app to automatically assess whether my long-term/short-term goals with this contact have been achieved, based on our actual chat history, so I don't have to judge it myself.

**Acceptance Criteria:**
- [ ] 统计页面展示该 chat_card 的 `long_term_goal`、`short_term_goal` 原文；两者均为空时，该区块显示"未设置目标"，不发起 AI 调用
- [ ] 至少设置了一个目标时，页面打开后自动调用一次当前已配置的 LLM（复用 `electron/main/llm/generateReplies.ts` 中已有的当前模型/API Key 配置获取方式），结合目标文本与聊天记录，生成一个达成情况判断：分类结果（未达成 / 部分达成 / 已达成）+ 一句话理由
- [ ] 该结果不做数据库持久化，每次打开统计页都重新调用生成
- [ ] AI 调用中显示 loading 状态；调用失败（如未配置 LLM、网络错误）显示明确的错误提示，不影响页面其余统计指标的展示
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g. via the `run` skill)

### US-007: 聊天统计完整流程端到端测试
**Description:** As a QA engineer, I want an automated end-to-end test covering the full chat-stats journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试准备一个带有若干 self/other 消息（跨多天、不同小时/星期）及长期/短期目标的 chat_card 测试数据
- [ ] 测试从首页点击该卡片的统计图标，进入统计页，断言核心数字指标（消息数、活跃天数、首末聊天时间等）与预置数据一致
- [ ] 断言 24 小时分布图与星期分布图渲染出与预置数据匹配的柱值
- [ ] 覆盖边缘路径：对一个没有任何消息的 chat_card 打开统计页，断言显示空状态提示而非报错或空白图表
- [ ] 覆盖边缘路径：mock LLM 调用失败，断言目标达成区块显示错误提示且不影响其余指标渲染
- [ ] Test runs in CI and passes
- [ ] Test 独立准备和清理自己的测试数据

## 4. Functional Requirements

- FR-1: `ContactCard` 右上角操作区必须新增一个统计入口图标，点击后不触发卡片本身的 `onOpen`
- FR-2: 点击统计入口后，系统必须导航到新的独立统计页面（复用 `App.tsx` 现有的 view 路由模式），并携带对应 `chatCardId`
- FR-3: 统计页面必须提供返回按钮，点击后返回首页
- FR-4: 系统必须统计并展示"我发送的消息数"（`role = 'self'` 的消息计数，不含 `role = 'annotation'`）
- FR-5: 系统必须统计并展示"对方发送的消息数"（`role = 'other'` 的消息计数，不含 `role = 'annotation'`）
- FR-6: 系统必须统计并展示"活跃天数"，定义为按本地日历日计算、至少有一条 self/other 消息的自然日天数
- FR-7: 系统必须统计并展示"首次聊天时间"，取该 chat_card 下最早一条 self/other 消息的 `created_at`
- FR-8: 系统必须统计并展示"最后聊天时间"，取该 chat_card 下最晚一条 self/other 消息的 `created_at`
- FR-9: 系统必须统计并展示"最长连续聊天天数"，定义为历史上"每个自然日均有至少一条消息"的最长连续日期串长度
- FR-10: 系统必须统计并展示"最长沉默时间"，定义为按时间排序后相邻两条 self/other 消息之间的最大时间间隔，并以可读时长格式展示
- FR-11: 系统必须统计并展示"平均每日消息数"，计算方式为总消息数（self + other）÷ 活跃天数
- FR-12: 系统必须以柱状图展示 24 小时消息分布（本地时间 0-23 时分桶，self + other 合计）
- FR-13: 系统必须以柱状图展示周一至周日消息分布（本地时间分桶，self + other 合计）
- FR-14: 系统必须统计并展示"我方主动发起聊天次数"与"对方主动发起聊天次数"，定义为按自然日分段、取每个活跃日最早一条消息的发送方进行归类计数
- FR-15: 当至少设置了长期目标或短期目标之一时，系统必须在统计页打开时自动调用当前已配置的 LLM，结合目标文本与聊天记录生成目标达成情况评估（分类 + 一句话理由）
- FR-16: 当长期目标和短期目标均为空时，系统不得发起目标评估的 LLM 调用，须直接展示"未设置目标"
- FR-17: 目标达成情况评估结果不得持久化到数据库，每次打开统计页均须重新生成
- FR-18: 当该 chat_card 下不存在任何 self/other 消息时，系统必须展示空状态提示，且不渲染图表和目标评估区块
- FR-19: 当 LLM 调用失败时，系统必须在目标评估区块展示错误提示，且不得影响其余统计指标的正常展示

## 5. Non-Goals (Out of Scope)

- 不支持自定义时间范围筛选（如"只看最近 30 天"），本期统计口径为该聊天对象的全部历史消息
- 不支持跨多个聊天对象的统计对比或排行榜
- 不支持将统计结果导出（PDF/图片/分享）
- 不支持用户手动标注/覆盖"目标是否达成"的判断结果
- 不提供随时间变化的历史趋势图（如"每周消息数变化曲线"），仅提供当前时点的汇总统计
- 不基于统计结果触发任何通知、提醒或自动化操作
- "连续聊天天数"展示的是历史最长连续记录，不展示"当前是否仍在连续中"的实时状态

## 6. Design Considerations

- 复用现有 `IconButton`、`Modal`/页面路由等 UI 组件规范，保持与 `ChatScreen`、`HomeScreen` 一致的视觉风格
- 图标新增遵循 `src/components/ui/icons.tsx` 现有 SVG 图标写法
- 移动端优先：统计数字卡片、柱状图需在窄屏下正常换行/滚动展示，图表容器宽度自适应
- 目标达成情况区块与其余数字指标区块视觉上应有区分（如单独卡片 + loading/error 独立状态），避免 AI 调用延迟拖慢整页渲染的观感——数字指标和图表应先行展示，目标评估区块可异步加载

## 7. Technical Considerations

- 新增 `electron/main/db/chatStatsRepository.ts`，SQL 聚合基于 `message` 表（`chat_card_id`、`role`、`created_at`），排除 `role = 'annotation'`
- 目标评估复用 `electron/main/llm/generateReplies.ts` 中获取"当前模型配置"（`llm_model_card` 表 `is_current = 1`）的既有逻辑，避免重复实现 provider 集成
- 新增 IPC 通道需在 `electron/preload` 与 `electron/main/ipc/register.ts` 中注册，并同步更新 `ElectronApi` 类型定义（`src/types/electron-api.d.ts` 引用的 preload 类型）
- 新增页面 `src/screens/stats/StatsScreen.tsx`，路由方式与 `ChatScreen` 一致（`App.tsx` 中 `view === 'stats'` 分支）
- 24 小时/星期分布图表：优先复用项目中已有的图表方案（如有），若无则引入轻量方案，避免引入过重的图表库依赖
- 时区：所有"本地时间"分桶（小时、星期、自然日）均以运行应用的设备本地时区为准，不做时区选择/转换

## 8. Success Metrics

- 用户可在 3 次点击以内（首页 → 统计图标 → 统计页渲染完成）看到某聊天对象的完整统计数据
- 统计页面数字指标（不含 AI 目标评估）首屏渲染时间与聊天记录规模无明显卡顿（本地 SQLite 聚合查询）
- 目标评估功能可用率：在已配置 LLM 且网络正常情况下，评估调用成功率应与现有"生成回复"功能的成功率相当

## 9. Open Questions

- "最长连续聊天天数"是否需要额外展示"当前连续天数"（区别于历史最长）？本期按 Non-Goals 中约定仅展示历史最长，如后续需要可再拆分新指标
- 24 小时/星期分布图是否需要按 self/other 分开展示（堆叠柱状图），而非仅展示合计值？本期为合计值，如有细分需求可作为后续迭代
- 图表库选型（是否已有项目内统一方案）需要在实现前确认，本 PRD 未强制指定具体库
