# 聊天统计数据聚合（后端计算 + IPC）

## Description
在 `electron/main/db` 层新增聊天统计聚合能力，基于 `message` 表为某个 `chat_card` 计算全部数字类/日期类统计指标，并通过 IPC 暴露给渲染进程，作为统计页面的唯一数据来源。

## Acceptance Criteria
- [x] 新增 `electron/main/db/chatStatsRepository.ts`，对外提供一个函数（如 `computeChatStats(db, chatCardId)`），基于 `message` 表中 `role IN ('self', 'other')` 的记录计算：我方消息数、对方消息数、活跃天数、首次聊天时间（最早消息 `created_at`）、最后聊天时间（最晚消息 `created_at`）、最长连续聊天天数（历史最长的"每天都有消息"连续日期串）、最长沉默时间（相邻两条消息之间最大时间间隔）、平均每日消息数（总消息数 ÷ 活跃天数，保留 1 位小数）、24 小时消息分布（按本地时间 0-23 时分桶计数）、星期一至星期日消息分布（按本地时间分桶计数）、双方主动发起聊天次数（每个有消息的自然日，取当天最早一条消息的 `role`，按 `role` 归类计数为"我方发起天数"/"对方发起天数"）
- [x] `role = 'annotation'` 的记录不计入以上任何统计
- [x] 聊天记录为空（该 chat_card 下没有 self/other 消息）时返回明确的"空数据"结构，不抛错
- [x] 通过 `electron/preload` 暴露新 IPC 通道（如 `window.api.chatStats.get(chatCardId)`），并在 `electron/main/ipc/register.ts` 注册，同步更新 `ElectronApi` 类型定义
- [x] Typecheck/lint passes

## Implementation Notes
- `computeChatStats` 一次性拉取该 chat_card 全部 self/other 消息（按 `created_at, id` 升序）后在 JS 内单趟遍历完成全部聚合，而非拆成多条 SQL——个人聊天助手的单会话消息量级不需要数据库端聚合优化，单趟遍历更容易同时算出流式指标（沉默间隔、连续天数）
- 本地日历日用 `Date.UTC(y, m, d) / 86400000` 转成整数 key（`localDayIndex`），而非直接用本地 ms 时间戳排序——避免夏令时切换导致同一天两个时间点算出不同的"天数差"
- `longestSilenceMs`／`firstMessageAt`／`lastMessageAt` 在消息数为 0 时为 `null` 而非 `0`，用以区分"没有数据"和"间隔为 0"
- 顺带在 preload 暴露了 `window.api.chatStats.evaluateGoal`（对应 #35 的 IPC 通道常量），但 main 进程尚未注册其 handler——这是 #35 的范围，本 issue 只搭好类型和常量，避免 #35 再改一遍 preload 签名
- 未新增独立单元测试文件：项目目前没有 vitest/jest 等单元测试框架，仅有 Playwright E2E（`npm run test:e2e`）；该函数的正确性由 #36 的端到端测试通过真实 SQLite 数据验证

## Dependencies
None

## Type
backend

## Priority
high

## PRD Reference
tasks/prd-chat-stats.md — US-001, FR-4 ~ FR-14, FR-18
