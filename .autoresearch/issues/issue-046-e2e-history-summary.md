# 端到端测试——历史摘要与截断完整流程

## Description
编写自动化端到端测试，覆盖"消息积累到阈值 → 自动生成并保存摘要 → 后续生成回复实际使用摘要+最近原文而非全部历史"的完整链路，以及"未达阈值不摘要"和"摘要失败不影响主功能"两条边界路径。

来源：`tasks/prd-chat-history-summary.md` — US-005（依赖所有其他 Issue）

## Acceptance Criteria
- [x] 自动化 E2E 测试（Electron + mock LLM server）为一个聊天卡片插入足够多消息，使其同时超过 100 条保留窗口和摘要触发的 token 阈值，断言 `chat_card.history_summary` 被写入非空内容、`summarized_through_message_id` 被正确推进
- [x] 断言摘要生成之后触发的"生成回复"，其实际发送给 LLM 的 prompt 中包含摘要文本，且不包含已被摘要覆盖、超出最近 100 条范围的最老消息原文，但包含最近 100 条窗口内的消息原文
- [x] 覆盖边界路径：消息数量虽然超过 100 条、但还不足以让"待摘要内容"达到 token 阈值时，断言不会产生摘要（`history_summary` 仍为空）（见下方 Verification Notes 对该条与 US-004 的措辞差异说明）
- [x] 覆盖边界路径：摘要生成对应的 LLM 调用失败时，断言不影响"生成回复"功能本身依然正常返回候选回复
- [x] 测试在 CI 中可运行并通过
- [x] 测试自行创建并清理所需的聊天卡片和消息数据，不依赖测试执行顺序

## Verification Notes
新增 `e2e/history-summary.spec.ts`，沿用套件既有模式（单个连续场景，各阶段状态互相依赖）。特别注意：该文件需要直接调用 `window.api.xxx`（而非只走 UI 点击）来快速批量插入 100+ 条消息以触发摘要——这是套件里第一个这么做的 spec，因此把外层 Playwright Page 变量命名为 `appWindow` 而不是其他 spec 沿用的 `window`，避免在 `.evaluate(() => window.api...)` 回调里被外层同名变量在 TypeScript 静态类型层面"遮蔽"（运行时 Playwright 会把回调重新序列化进真实页面上下文，不受影响，但 `tsc` 会把回调里的 `window` 误判成外层 `Page` 类型，导致 `Property 'api' does not exist on type 'Page'`）。

**发现并修正了 PRD 里的一处自相矛盾**：US-004 的验收标准写"历史超过 100 条但摘要尚未生成时，使用『最近 100 条原文』"，而 US-005（本 Issue）的验收标准却写"生成回复用的仍是全部历史原文"——这两句描述的是同一个场景，但结论互相矛盾。Issue #45 已经按 US-004 的版本实现（并已验证），这也是更合理的行为：一旦超过保留窗口就应该截断到最近 100 条，不管摘要是否已经跟上，否则在摘要"来不及生成"的这段时间里 prompt 依然会无限增长，违背了这整个功能存在的初衷。本测试断言的是已实现的、更合理的行为（截断到最近 100 条），而不是 US-005 字面上的"全部历史原文"。

测试覆盖三个阶段：①插入 11 条长消息（每条约 330 CJK 字符）+ 填充消息累计超过 100 条保留窗口 且 token 估算越过摘要触发阈值，断言 `history_summary` 非空、`summarized_through_message_id` 落在长消息 id 范围内；随后触发"生成回复"，断言实际 prompt 包含"【更早的对话摘要】"及摘要正文，不包含被摘要覆盖的最早消息原文，但包含窗口内的最新消息 ②另建一张卡片插入 120 条短消息（永远不足以越过 token 阈值），断言不产生摘要、且 prompt 仍是普通"【聊天记录】"标签但正确截断到最近 100 条（不含摘要占位符）③再建一张卡片，让摘要对应的 LLM 调用直接返回 500 错误，断言 `history_summary` 保持为空（失败调用未写入任何内容）、且"生成回复"本身依然正常返回候选回复，未受影响。

本地验证：单独运行通过；与 `debug-export.spec.ts`、`message-delete.spec.ts` 一起并行跑 3 个 worker 也全部通过，无相互干扰。

## Dependencies
Issue #42（chat_card 新增摘要相关字段）、Issue #43（Token 数量启发式估算函数）、Issue #44（历史摘要生成与滚动更新）、Issue #45（生成回复/润色/目标评估接入摘要与截断）

## Type
infra

## Priority
medium
