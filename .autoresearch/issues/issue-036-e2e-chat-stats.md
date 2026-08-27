# 聊天统计完整流程端到端测试

## Description
覆盖聊天统计功能从卡片入口到统计页面完整渲染的端到端测试，包括核心指标、图表与 AI 目标评估，以及空数据和 AI 调用失败的边缘路径。

## Acceptance Criteria
- [x] E2E 测试准备一个带有若干 self/other 消息（跨多天、不同小时/星期）及长期/短期目标的 chat_card 测试数据
- [x] 测试从首页点击该卡片的统计图标，进入统计页，断言核心数字指标（消息数、活跃天数、首末聊天时间等）与预置数据一致
- [x] 断言 24 小时分布图与星期分布图渲染出与预置数据匹配的柱值
- [x] 覆盖边缘路径：对一个没有任何消息的 chat_card 打开统计页，断言显示空状态提示而非报错或空白图表
- [x] 覆盖边缘路径：mock LLM 调用失败，断言目标达成区块显示错误提示且不影响其余指标渲染
- [ ] Test runs in CI and passes — **未在本环境验证，见 Implementation Notes**
- [x] Test 独立准备和清理自己的测试数据

## Implementation Notes
- 新增 `e2e/chat-stats.spec.ts`，结构参照 `e2e/smart-tone-mode.spec.ts`（真实 Electron + 真实 SQLite + `mockLlmServer`），而非渲染层 mock
- **关键约束**：`insertMessage`（`electron/main/db/messageRepository.ts`）总是用 `Date.now()` 盖 `created_at`，应用自身的 IPC 面完全没有"回填历史时间"的入口，所以没法只靠点 UI 造出跨天/跨小时的测试数据。改为在 Electron 主进程**内部**（`electronApp.evaluate`）用一个新开的 `better-sqlite3` 连接直接写 `chat_card`/`message` 表——之所以不在 Playwright 测试进程里直接 `require('better-sqlite3')`，是因为 `postinstall` 的 `electron-rebuild -f -w better-sqlite3` 是针对 Electron 的 ABI 重新编译原生绑定的，与运行测试进程的 Node 版本大概率不是同一个 ABI；放到 `electronApp.evaluate` 里 `require`，拿到的必然是应用自己在用的那份已重编译绑定，规避了 ABI 不匹配的风险
- 测试数据设计：3 个连续自然日（dayA/B/C，锚定在"今天本地零点"往前推 1-3 天，避免测试运行时刻正好跨天导致的边界抖动），共 6 条 self/other 消息 + 1 条 annotation（刻意排除），手工按 `chatStatsRepository.ts` 的算法反推出每个指标的期望值（消息数 3/3、活跃天数 3、连续天数 3、最长沉默 1 天 12 小时、平均每日 2、我方发起 1 次/对方发起 2 次），断言时不重新调用被测算法，避免测试和实现共享同一个 bug 而互相掩盖
- 星期分布断言不依赖具体星期几（CI 跑的日期不固定）：只断言"3 个柱子是 2、4 个柱子是 0"这个由"3 个连续自然日"必然推出的性质
- 图表断言通过每根柱子的 `title="<label>: <count> 条"` 属性定位，并用 `h2` 标题 + `locator('..')` 把断言范围限定在对应的 `chartSection` 内，避免两个图表的柱子互相干扰计数
- **无法在当前沙箱环境中实际运行验证**：真实 Electron GUI 在本沙箱下无法启动（`electron.app` 在 vanilla Node 下是 `undefined`，与 #7/#9/#32 记录的根因一致），这是环境限制，不是本次改动引入的问题。已确认 `npm run build` 产物存在、`tsc --noEmit`/`eslint .`（含新 spec 文件）全部通过；测试文件本身的逻辑已经过静态复核（手工验算每个断言数值），但 `npm run test:e2e` 这条命令本身需要在能启动 Electron GUI 的机器（真实 CI 或开发者本机）上跑一遍才能真正确认通过

## Dependencies
Issue #31, Issue #32, Issue #33, Issue #34, Issue #35

## Type
infra

## Priority
medium

## PRD Reference
tasks/prd-chat-stats.md — US-007
