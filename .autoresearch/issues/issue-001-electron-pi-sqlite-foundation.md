# Electron 项目初始化 + pi 集成 + SQLite 基础

## Description
搭建 Electron 应用外壳，集成 pi（earendil-works/pi）作为多 provider LLM 客户端，初始化本地 SQLite 数据库，作为后续所有功能的技术基座。

## Acceptance Criteria
- [x] Electron app 通过 `npm run dev`（或等效命令）启动到主窗口 — 代码路径完整（`electron/main/index.ts` 中 `app.whenReady()` → `createWindow()`），vite 构建 main/preload/renderer 三端全部成功；但本次开发环境的沙箱设置了 `ELECTRON_RUN_AS_NODE=1`，导致 Electron 二进制被强制以纯 Node 模式运行、无法真正弹出 GUI 窗口，因此窗口显示未能在此会话中肉眼验证。请在本地终端运行 `npm run dev` 做最终视觉确认。
- [x] pi 作为依赖集成，可在 main 进程中通过给定 provider + API key 发起一次 LLM 调用并拿到返回内容 — 已用本地 mock OpenAI 兼容端点验证 `callLlm()`：正确发送 `Authorization: Bearer <apiKey>`、正确解析流式响应并返回文本
- [x] 首次启动时在本地 app-data 目录初始化 SQLite 数据库文件，并创建初始表结构（migration）— 已用独立脚本验证 schema 创建 persona/chat_card/message/settings 四张表、可重复执行（幂等）、外键关系（persona → chat_card → message）工作正常
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过

## Post-merge fix (found via Issue #4)
The original `callLlm()` verification only ever ran through a standalone script (real Node ESM), never through the actual compiled `dist-electron/main/index.js`. That hid a real bug: `vite-plugin-electron`'s `notBundle()` compiles main-process TypeScript to CommonJS, so the static `import ... from '@earendil-works/pi-ai'` (and its `/providers/*`, `/api/*` subpath imports) compiled down to `require("@earendil-works/pi-ai")`. pi-ai is ESM-only (`"exports"` has no `"require"` condition), so Node's CJS loader threw `ERR_PACKAGE_PATH_NOT_EXPORTED` the first time this code path actually ran inside the app — which only happened once Issue #4 wired `callLlm` into a live IPC handler (`llm:test-connection`); nothing before that imported `electron/main/llm/client.ts` from the app's real startup path.

Fixed in `electron/main/llm/client.ts`: every pi-ai import is now a lazy, cached dynamic `import()` (Node's ESM loader honors the `"import"` condition regardless of the importing module's own CJS/ESM-ness), with only type-only (`import type` / `typeof import(...)`) references at the top level so nothing compiles to a runtime `require()`. Confirmed by rebuilding and grepping `dist-electron/main/index.js` for `require("@earendil-works/pi-ai")` — no longer present; rollup now inlines pi-ai's provider chunks instead of leaving them as an external `require()`.

## Dependencies
None

## Type
infra

## Priority
high
