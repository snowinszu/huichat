# reply:generate 编排两阶段流程与优雅降级

## Description
在 `reply:generate` handler（`electron/main/ipc/register.ts`）里把设置存储（Issue #59）、搜索客户端（Issue #60）、双阶段 prompt（Issue #61）串起来：读取用户偏好判断是否需要走联网流程，需要时先做"判断+兜底生成"，按需触发搜索，再决定是否发起第二次生成。核心约束是优雅降级——搜索失败绝不能让用户拿不到候选回复。

## Acceptance Criteria
- [ ] `reply:generate` handler 读取 `AppPreferenceRecord`，仅当 `webSearchEnabled && webSearchApiKey` 均就绪时才走两阶段流程，否则原样走现有单次调用路径（不构造任何联网相关 prompt 文案）
- [ ] 两阶段流程：第一次 `callLlm` → `parseGenerateRepliesResponse`；`needsSearch` 为 false 时直接返回第一次的 `replies`，全程只发生一次 LLM 调用
- [ ] `needsSearch` 为 true 时调用 `searchWeb(webSearchApiKey, searchQuery)`；搜索抛错或返回空结果时直接回退返回第一阶段的兜底 `replies`，不再重试、不向渲染层暴露搜索失败的错误
- [ ] 搜索成功时用 `formatSearchResults` 结果调用 `buildReplyPrompt(..., searchResults)` 发起第二次 `callLlm`，`parseReplies` 解析后作为最终结果返回
- [ ] 两次 `callLlm` 调用都各自走一遍 `debugExportContextFor`，source 标签区分"生成回复（判断联网）"与"生成回复（联网后）"，便于调试导出日志区分两轮
- [ ] IPC 返回类型保持 `ReplyCandidate[]` 不变，渲染层（聊天界面）无需任何改动
- [ ] Typecheck/lint passes

## Dependencies
Issue #59, Issue #60, Issue #61

## Type
backend

## Priority
high

## Source
tasks/prd-web-search-reply.md — US-004
