# 历史摘要生成与滚动更新

## Description
新增 `maybeSummarizeHistory(db, chatCardId)` 函数，在每次消息插入后以 fire-and-forget 方式调用（语义与已有的 `maybeExtractInfo` 一致）。当"保留窗口（最近 100 条）之外、尚未被摘要覆盖"的消息估算 token 数达到阈值时，调用 LLM 把已有摘要与新的老消息内容合并压缩成新摘要，持久化并推进水位线。

来源：`tasks/prd-chat-history-summary.md` — US-003

## Acceptance Criteria
- [x] 新增函数（如 `maybeSummarizeHistory(db, chatCardId)`），在每次消息插入后被调用（fire-and-forget，不阻塞插入），语义与已有的 `maybeExtractInfo` 一致
- [x] 仅当"保留窗口（最近 100 条）之外、且尚未被摘要覆盖"的消息内容估算 token 数达到阈值时，才真正触发一次摘要生成；未达到阈值时函数直接返回，不产生任何 LLM 调用
- [x] 触发时，调用 LLM 把"已有摘要（如果有）+ 这批新的老消息内容"合并压缩成一份新的摘要文本，写回 `history_summary`，并把 `summarized_through_message_id` 推进到这批老消息中最新一条的 id，确保同一批消息不会被重复摘要
- [x] 生成的摘要文本本身有长度上限（如不超过 500 字），避免摘要随对话不断进行而无限膨胀
- [x] 摘要生成失败（无当前模型、网络错误、响应异常等）时静默失败并记录日志，不能抛出未处理异常，不能阻塞消息插入或其他功能
- [x] 该次 LLM 调用复用现有的调试导出机制，来源标注为"历史摘要"
- [x] Typecheck/lint 通过

## Verification Notes
新增 `electron/main/llm/summarizeHistory.ts`：`maybeSummarizeHistory(db, chatCardId, callModel = callLlm)` 与 `maybeExtractInfo` 同款 fire-and-forget 契约。核心常量：`HISTORY_RETENTION_WINDOW=100`（保留窗口）、`SUMMARY_TRIGGER_TOKEN_THRESHOLD=3000`（触发阈值）、`SUMMARY_MAX_LENGTH=500`（摘要长度硬上限，代码里用 `.slice()` 强制截断，不只是 prompt 里的口头要求）。逻辑：取保留窗口之外、且 id 大于 `summarizedThroughMessageId` 水位线的"新老消息"，估算其 token 数，达到阈值才真正发起一次 LLM 调用，把"已有摘要 + 新老消息内容"合并压缩，写回摘要并把水位线推进到这批消息中最新一条的 id。消息格式化复用了 `promptContext.ts` 里原本私有的 `formatMessage`（现已导出），避免重复实现说话人前缀/翻译后缀/标注格式化逻辑。`register.ts` 的 `messageInsert` handler 在每次插入后无条件调用它（不像自动信息提取那样受偏好开关控制，PRD 明确本功能没有用户可见开关）。

真实端到端验证（Electron + mock LLM server）：
1. **正确触发+watermark**：插入 11 条长消息（每条约 330 个 CJK 字符）+ 89 条短填充消息（共 100 条，仍在保留窗口内）——确认此时摘要调用为 0 次、`history_summary` 仍为空；再逐条插入短消息直到触发（实测在总数达到 110 条、10 条长消息的估算 token 数越过阈值时触发），确认恰好触发 1 次、返回的摘要文本被正确写入、`summarized_through_message_id` 落在长消息的 id 范围内且非空；此后再插入 5 条小消息，确认剩余待摘要内容不足以再次触发（仍是 1 次）。
2. **不阻塞验证**：用一个自建的可控延迟 mock server，让匹配摘要 prompt 的请求故意延迟 3 秒，确认触发摘要的那次消息插入耗时仅 4ms、随后立即发起的"生成回复"调用耗时仅 6ms 且返回正确结果——均远快于 3 秒延迟，证明背景摘要生成不会阻塞消息插入或其他 LLM 功能；等待超过延迟时间后确认摘要确实最终落盘，证明"快"不是因为摘要偷偷跳过了。

（过程中发现的插曲：第一版验证脚本的测试数据字符串里意外包含了"历史摘要"这个检测关键词本身，被自动信息提取功能的 prompt 回显命中，产生了一次误报——纯粹是测试脚本自身的数据/断言设计问题，与被测代码无关，已改用更精确、不与测试内容重叠的检测关键词修复。）

## Dependencies
Issue #42（chat_card 新增摘要相关字段）、Issue #43（Token 数量启发式估算函数）

## Type
backend

## Priority
high
