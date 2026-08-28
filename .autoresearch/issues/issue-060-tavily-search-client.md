# Tavily 搜索客户端模块

## Description
新增独立的搜索客户端模块，封装对 Tavily 搜索 API 的调用，供后续的生成回复编排逻辑使用。使用 Node 22 原生全局 `fetch`（Electron 43 主进程环境自带，无需新增依赖）。失败情况统一抛错，不在本模块内做静默降级——降级逻辑属于调用方（reply:generate handler）的职责。

## Acceptance Criteria
- [ ] 新增 `electron/main/llm/webSearch.ts`，导出 `searchWeb(apiKey: string, query: string): Promise<WebSearchResult[]>`（`WebSearchResult` 含 `title`/`url`/`content`），POST Tavily 的 `/search` 接口，返回结果按相关度取前 5 条
- [ ] 请求的服务端地址可通过一个 E2E 专用环境变量覆盖（仿照 `electron/main/index.ts` 中 `E2E_USER_DATA_DIR` 的写法），使 E2E 测试能指向本地 mock server 而非真实 Tavily
- [ ] 网络失败、非 2xx 响应、鉴权失败等情况统一抛出一个带明确 message 的 `Error`，不在本模块内静默吞掉或重试
- [ ] 导出 `formatSearchResults(results: WebSearchResult[]): string`，将结果拼成供 prompt 使用的文本块（标题 + 摘要 + 来源链接）
- [ ] Typecheck/lint passes

## Dependencies
None

## Type
backend

## Priority
high

## Source
tasks/prd-web-search-reply.md — US-002
