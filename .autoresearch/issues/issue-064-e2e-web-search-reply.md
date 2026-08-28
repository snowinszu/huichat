# 端到端测试——联网搜索完整流程

## Description
为联网搜索功能新增自动化端到端测试，覆盖设置开启、时效性问题触发搜索并生成回复、非时效性问题不触发搜索、搜索失败优雅降级三条路径。仿照现有 E2E 测试用 `startMockLlmServer` 模拟 LLM，并新起一个本地 mock HTTP server 模拟 Tavily 接口。

## Acceptance Criteria
- [ ] 新增 `e2e/web-search-reply.spec.ts`，仿照现有测试用 `startMockLlmServer`（`e2e/support/mockLlmServer.ts`）模拟 LLM，同时起一个本地 mock HTTP server 模拟 Tavily 接口，通过 Issue #60 新增的 E2E 环境变量指向它
- [ ] 测试在设置页开启"联网搜索"并填入 mock Key，粘贴一条时效性问题消息（如"明天天气怎么样"），点击"生成回复"：断言 mock LLM 收到了两次请求（第一次带 `needsSearch` 判断的 prompt，第二次 prompt 含【实时搜索结果】区块），且 mock Tavily server 收到了一次搜索请求，最终候选回复渲染出来
- [ ] 覆盖边界场景：mock LLM 对某条非时效性消息返回 `needsSearch: false`，断言全程只发生一次 LLM 调用、Tavily mock server 未被请求
- [ ] 覆盖边界场景：mock Tavily server 返回错误状态码，断言生成流程不报错，最终仍渲染出第一阶段的兜底候选回复
- [ ] 测试运行于 CI 并通过
- [ ] 测试独立可重复运行，自行创建和清理所需的聊天卡片、模型卡片数据

## Dependencies
Issue #59, Issue #60, Issue #61, Issue #62, Issue #63

## Type
infra

## Priority
medium

## Source
tasks/prd-web-search-reply.md — US-006
