# 生成回复 prompt 支持"顺便判断联网"与二次生成

## Description
扩展 `buildReplyPrompt`（`electron/main/llm/generateReplies.ts`），使生成回复的第一次 LLM 调用能够顺便判断这条对话是否需要联网查询实时信息，并在需要时给出搜索关键词；同时支持第二阶段——把搜索结果注入 prompt 后再生成一版最终回复。两种模式都不触发时（即两个新参数都不传），prompt 行为与现状完全一致，保证未开启联网搜索的用户零回归。

## Acceptance Criteria
- [ ] `buildReplyPrompt` 新增两个互斥的可选参数：`webSearchEnabled`（第一阶段：注入当前日期，要求模型 JSON 输出除 `replies` 外再带 `needsSearch: boolean` 和 `searchQuery: string | null`，且即便 `needsSearch` 为 true 也必须照常给出 3 条兜底 `replies`）与 `searchResults`（第二阶段：把结果拼进新增的【实时搜索结果】区块，schema 退回纯 `replies`）；两个参数都不传时行为与现状完全一致
- [ ] 新增 `parseGenerateRepliesResponse(text): { replies: ReplyCandidate[]; needsSearch: boolean; searchQuery: string | null }`，复用现有 `toReplyCandidate` 辅助函数解析扩展后的 JSON；原有 `parseReplies` 不改动，继续给"未开启联网""第二阶段"以及 `reply:polish` 使用
- [ ] `needsSearch` 判断标准明确写入 prompt 指令：仅当对方最后一条消息涉及模型无法确定的时效性信息（天气、日期、新闻、演出/赛事时间等）时才应设为 true，普通闲聊/情感类问题不触发
- [ ] Typecheck/lint passes

## Dependencies
None

## Type
backend

## Priority
high

## Source
tasks/prd-web-search-reply.md — US-003
