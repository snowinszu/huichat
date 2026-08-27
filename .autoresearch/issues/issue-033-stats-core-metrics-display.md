# 统计页面核心数字指标展示

## Description
在 #32 搭好的统计页面骨架中，接入 #31 的聊天统计 IPC，展示除图表和 AI 目标评估之外的全部核心数字/日期类指标。

## Acceptance Criteria
- [x] 页面加载时调用 `window.api.chatStats.get(chatCardId)`，展示：我发送的消息数、对方发送的消息数、活跃天数、首次聊天时间（格式化为可读日期时间）、最后聊天时间、最长连续聊天天数、最长沉默时间（格式化为"N天N小时"等可读时长）、平均每日消息数、我方主动发起聊天次数、对方主动发起聊天次数
- [x] 数据加载中显示 loading 状态；加载失败显示错误提示
- [x] 该聊天对象没有任何 self/other 消息时，显示明确的空状态提示（如"暂无聊天记录，还没有可统计的数据"），不展示图表或目标评估区块
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g. via the `run` skill)

## Implementation Notes
- `formatDuration`/`formatDateTime` are local helpers in `StatsScreen.tsx`, not shared `lib/` utilities — no other screen needs "N天N小时" formatting yet, so this follows the "no premature abstraction" guidance rather than pre-emptively generalizing
- `longestSilenceMs === null` (fewer than 2 messages) renders as `—` rather than `0 分钟`, matching the repository's null-means-"not enough data" convention from #31
- Verified in the same browser session as #32/#34/#35 (see #32's notes for the sandbox workaround) — tiles rendered with correct values against a hand-computed mock dataset, and the empty-state message appeared with a zero-message mock card

## Dependencies
Issue #31, Issue #32

## Type
frontend

## Priority
high

## PRD Reference
tasks/prd-chat-stats.md — US-003, FR-18
