# 设置页面 — LLM 配置

## Description
提供设置页，让用户配置自己的 LLM provider、API key、model，供后续所有 AI 调用使用。

## Acceptance Criteria
- [x] 主导航可进入设置页 — `src/screens/home/HomePlaceholder.tsx`（临时首页壳，titlebar 含设置图标按钮，真正首页留给 #6）→ `src/App.tsx` 用简单的 `useState<'home'|'settings'>` 视图切换到 `SettingsScreen`，其自带 `←` 返回按钮回到首页
- [x] 表单包含：provider 选择（下拉，至少含 OpenAI、Anthropic、智谱 GLM、MiniMax、Kimi、通义千问、自定义 OpenAI 兼容端点）、API key（`*` 掩码显示，无需额外加密存储）、model 名称/选择 — `src/screens/settings/SettingsScreen.tsx` + `providerMeta.ts`；provider 用新增的 `Select` 组件（`src/components/ui/Select/`）；API Key 用新增的 `PasswordInput` 组件（show/hide 切换，默认掩码）；model 输入框下方带按 provider 变化的推荐模型 chip；选择"自定义端点"时额外展示 Endpoint 字段
- [x] 保存后配置持久化到本地数据库，重启应用后仍生效 — `electron/main/db/settingsRepository.ts`（`settings` 单行表 upsert）经 IPC（`window.api.settings.save/get`）读写；`SettingsScreen` 挂载时调用 `get()` 回填表单，SQLite 文件本身跨重启持久
- [x] API key 为空或格式明显非法时阻止保存，并显示行内错误提示 — `providerMeta.ts` 的 `validateApiKey`（空/含空白/长度过短）、`validateModel`（空）、`validateBaseUrl`（自定义端点必须 http(s) 开头），保存/测试连接前统一校验，命中即在对应字段下方显示错误且不发起请求
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — Electron 仍无法在本沙箱起 GUI（同 #1-#3），改用纯 Vite 渲染层 + headless Chromium（Playwright）驱动：首页→设置导航、provider 切换联动模型建议/端点字段、空 API Key 保存被阻止并显示行内错误、显示/隐藏密码、返回首页均截图确认；保存/测试连接在无 `window.api` 的浏览器环境下正确降级为错误 toast（"当前环境不支持保存（未连接到 Electron 主进程）"），证明了防御性判空逻辑按预期工作。控制台无报错

## Implementation Notes
- `App.tsx` previously rendered Issue #2's component-gallery showcase (its job was done once that issue's screenshots confirmed the design tokens/components). Since this is the first real screen, `App.tsx` now renders the actual app (home placeholder ⇄ settings) instead; the gallery and its now-unused `App.module.css` were removed.
- Home isn't built until Issue #6 (chat-card CRUD), so `HomePlaceholder` is an intentionally minimal stand-in — just the shared titlebar chrome (app logo + settings icon button) so "main nav → settings" is real, plus honest "开发中" copy rather than a half-built card grid.
- Design's settings.html also shows a "通用" (General) toggle section (translate-non-Chinese, auto-add-to-history, keep-history-on-close, anonymous-stats). Left out: none of it is in this issue's AC, the `settings` table schema has no columns backing those toggles, and shipping non-persisted toggles would be a fake/non-functional control. Revisit if a later issue actually specs these.
- `LlmProviderId` was previously declared locally in `electron/main/llm/client.ts`; moved the canonical union to `electron/shared/ipc-types.ts` (client.ts now derives its internal `BuiltinProviderId`/`OpenAiCompatibleProviderId` from it via `Extract`) so the settings form, IPC layer, and the actual LLM client can't drift out of sync on which provider ids are valid.
- "测试连接" is wired for real, not just a design-fidelity placeholder: a new `llm:test-connection` IPC channel calls the already-verified `callLlm()` (from Issue #1) with a throwaway one-line prompt and surfaces success/failure as a toast.
- Verified backend with a standalone `tsx` script (same pattern as #3) against a throwaway SQLite file: empty-state read, first save, upsert-not-insert on a second save with a different provider, `updatedAt` advancing, and the single-row CHECK constraint holding — 7/7 checks passed, script deleted after the run.
- The one copy change from the literal design text: settings.html's API Key hint says "在本地加密存储，不上传" (encrypted local storage), but the AC explicitly says no extra encryption is needed and the schema stores it as plain `TEXT`. Kept the literal string would have been a false security claim shown to real users, so it now reads "仅保存在本地，不会上传" (local-only, not uploaded) — accurate copy took precedence over verbatim design fidelity here.
- Post-merge, added four more builtin providers per request: `google` (Gemini), `xai` (Grok), `deepseek`, `zai` (Z.AI — pi-ai's builtin *coding-plan* endpoint `api.z.ai/api/coding/paas/v4`, distinct from the existing `zhipu` id which stays on the general 开放平台 `open.bigmodel.cn` OpenAI-compatible endpoint; kept both rather than merging since they're different products/keys). All four follow the exact same wiring as the original openai/anthropic/minimax/moonshot: added to `LlmProviderId` in `ipc-types.ts`, added to `BUILTIN_CATALOG_ID` + the dynamic-import loader in `client.ts`, added to `PROVIDER_ORDER`/`PROVIDER_META` in `providerMeta.ts`. Verified provider dropdown + per-provider model suggestion chips render correctly via the same Playwright-against-renderer-only-Vite approach, and confirmed `npm run dev`'s build output still contains no bare `require()` of pi-ai (all four new provider modules load through the existing dynamic-import fix).
- Bug found by user testing (real "测试连接" against MiniMax): `providerMeta.ts`'s suggested models for `minimax` (`abab6.5s-chat`/`abab5.5-chat`) and `moonshot` (`moonshot-v1-8k`/`-32k`/`-128k`) were stale — those model ids no longer exist in the *installed* pi-ai package's catalog (current versions are `MiniMax-M2.7`/`M2.7-highspeed`/`M3` and `kimi-k2-turbo-preview`/`kimi-k2.5`/`kimi-k3` respectively), so `resolveModel()`'s `models.getModel(catalogId, config.model)` correctly failed with "未在 minimax 模型目录中找到". These names were hand-typed from memory rather than read from the installed package — the same mistake the `google`/`xai`/`deepseek`/`zai` additions avoided by reading `node_modules/@earendil-works/pi-ai/dist/providers/data/*.json` directly. Fixed both, then wrote a throwaway script (`verify-model-catalog.ts`, deleted after running) that dynamic-imports every builtin provider and calls the real `models.getModel()` for all 21 suggested models across all 8 providers — confirms none of the suggestion chips can silently drift from the installed catalog again without a test catching it. `openai`/`anthropic` suggestions happened to still be valid despite the same risk, purely by luck.
- Follow-up worth considering (not done — flagged, not requested): the suggestion chips are still a hand-maintained list that *can* drift again whenever `@earendil-works/pi-ai` is upgraded. A sturdier fix would expose a `models:listForProvider` IPC call backed by pi-ai's real catalog so the settings form always offers/validates against live data instead of a hardcoded snapshot.

## Dependencies
Issue #1, Issue #2

## Type
fullstack

## Priority
high

## Design Reference
`UI design/settings.html`
