# 生成回复/润色/目标评估接入摘要与截断

## Description
修改共用的历史上下文构建逻辑（`buildContextSection`）：当聊天记录总数超过 100 条时，改为使用"已保存的历史摘要 + 最近 100 条消息原文"构建提示词里的聊天记录部分。因为"生成回复""润色""目标评估"三个功能共用这同一段逻辑，接入一次即可让三者同时生效。

来源：`tasks/prd-chat-history-summary.md` — US-004

## Acceptance Criteria
- [x] 修改共用的历史上下文构建逻辑（`buildContextSection`）：当聊天记录总数超过 100 条时，改为使用"已保存的历史摘要 + 最近 100 条消息原文"构建提示词里的聊天记录部分，而不是全部历史原文
- [x] 聊天记录总数不超过 100 条时，行为与现状完全一致（无摘要、无截断，直接使用全部原文）
- [x] "生成回复""润色""目标评估"三个功能因共用该逻辑，接入一次即同时生效，无需分别修改
- [x] 当前还没有任何已保存摘要、但历史已超过 100 条时（摘要尚未来得及生成），使用"最近 100 条原文"且不包含摘要占位内容，不报错
- [x] Typecheck/lint 通过

## Verification Notes
`promptContext.ts` 新增私有辅助函数 `buildHistorySection(card, messages)`，被 `buildContextSection` 调用：消息总数 ≤100 或还没有 `historySummary` 时，行为与改动前完全一致（"【聊天记录】"+全部/最近100条原文，空历史仍是"（暂无历史消息）"）；一旦总数 >100 且 `historySummary` 非空，则切换为"【更早的对话摘要】"+摘要文本+"【最近的聊天记录】"+最近100条原文两段式结构。`HISTORY_RETENTION_WINDOW=100` 常量定义移到了 `promptContext.ts`（而不是 `summarizeHistory.ts`），因为 `summarizeHistory.ts` 已经需要从 `promptContext.ts` 导入 `formatMessage`，若常量定义反过来会造成两个模块互相导入的循环依赖；改为 `summarizeHistory.ts` 单向导入 `promptContext.ts` 的 `formatMessage` 和 `HISTORY_RETENTION_WINDOW`，两边共用同一份"100条"定义，不会出现两处数值不一致的风险。

`buildContextSection` 是 `buildReplyPrompt`（生成回复）、`buildPolishPrompt`（润色）、`buildGoalEvaluationPrompt`（目标评估）三者共用的唯一历史上下文构建入口（已用 grep 确认三者都直接调用它），因此这一处改动无需在三个文件里分别重复。`generateReplies.ts` 里额外的 `buildAwaitingReplyNote(messages)`（判断最后一条是否是"我"发的）仍然接收未截断的完整 `messages` 数组，但只读取其最后一条的 `role`，不受截断影响。

用真实 Electron + mock LLM server 端到端验证了三种场景下"生成回复"实际发送的 prompt：①50 条消息（≤100）——保留原有"【聊天记录】"标签、包含最早的消息，行为不变；②追加到 150 条但摘要尚未生成——仍是"【聊天记录】"标签（无摘要占位符），但已正确截断（最早的消息被排除，最近的消息仍在）；③手动写入一份摘要后——prompt 切换为"【更早的对话摘要】"+摘要正文+"【最近的聊天记录】"结构，摘要内容出现在 prompt 里，同时仍然正确排除保留窗口之外的原始消息。

## Dependencies
Issue #42（chat_card 新增摘要相关字段）、Issue #44（历史摘要生成与滚动更新）

## Type
backend

## Priority
high
