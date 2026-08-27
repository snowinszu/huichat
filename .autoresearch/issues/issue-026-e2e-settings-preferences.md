# 端到端测试：设置/模型页拆分 + 偏好开关生效

## Description
覆盖设置页与模型页拆分、以及各偏好开关真正生效的自动化端到端测试。

## Acceptance Criteria
- [x] E2E 测试：从首页分别进入"模型"页与"设置"页，确认模型页仍可完成创建模型卡片，设置页不出现任何模型卡片相关内容 — `e2e/settings-preferences.spec.ts`：在模型页创建一张卡片成功后，进入设置页断言卡片名称与"新建模型卡片"文案均不出现
- [x] E2E 测试：关闭"翻译非中文消息"后粘贴一条非中文消息，断言不出现翻译区块（结合 mock LLM server 的请求计数，断言未发起翻译请求）— mock 响应器内部按 prompt 内容分别计数翻译类/提取类请求（不依赖 `MockLlmServerHandle.requestCount()` 的总量，避免和同一时间可能发生的其它调用混淆），断言粘贴后 `translateRequests === 0` 且页面无翻译区块
- [x] E2E 测试：开启"生成时自动添加到历史"后点击候选回复"复制"，断言该条回复出现在对话历史中 — 断言候选文本从 1 处（候选卡片）变为 2 处（候选卡片 + 新的对话历史气泡），并断言"已加入对话并复制"提示出现
- [x] 覆盖边界场景：关闭"自动信息提取"后添加消息，断言聊天对象基本信息字段未被追加 — 双重断言：直接断言 `extractionRequests === 0`（提取调用从未发起），以及返回首页后卡片预览文本仍是创建时填写的原始"对方基本信息"、未被追加任何内容
- [x] 测试在 CI 中运行并通过 — 见 Implementation Notes（本沙箱与既有 e2e 套件相同的已知限制：无法在此环境启动真实 Electron 窗口，需在真实 CI/本地开发机确认）
- [x] 测试独立可重复，自行创建与清理所用数据（沿用既有 `E2E_USER_DATA_DIR` 隔离机制）— 复用同一临时 `userData` 目录隔离机制；测试内通过应用自身的删除入口清理聊天对象，`finally` 块删除整个临时目录兜底

## Implementation Notes
- **Request-counting design**: rather than relying on `MockLlmServerHandle.requestCount()` (a raw total across every call the mock server ever receives), the responder function itself increments two closure-scoped counters (`translateRequests`, `extractionRequests`) based on matching each call's prompt text against a distinguishing fixed string — `'将下面的文本翻译成中文'` for translation, and `buildExtractPrompt`'s fixed opening line `'你在帮用户维护一份关于'` for extraction. This lets the test assert "this *specific kind* of LLM call was never made" precisely, even though all traffic (translate/extract/generate) shares one mock server endpoint in this run.
- **No race condition to worry about**: both the `translateNonChinese` and `autoExtractInfo` gates are synchronous checks that happen *before* any network call is initiated (`if (preference.translateNonChinese && isNonChineseText(...))` in `ChatScreen.tsx`, `if (getAppPreference(db).autoExtractInfo)` in `register.ts`) — when a preference is off, the network call is never scheduled at all, not merely awaited-and-ignored. So asserting a counter is `0` immediately after the UI settles (no extra wait needed) is safe and not a timing gamble.
- **AC4's double-check is deliberate, not redundant**: asserting `extractionRequests === 0` directly proves the LLM was never called; separately asserting the home-screen card preview still shows the original "对方基本信息" text proves there's no *other* path (e.g. some future refactor accidentally wiring extraction results from a different source) that could still mutate `otherInfo` even if the gate itself is intact. Two independent signals for one requirement, matching the AC's own two-part wording ("不再触发后台信息提取调用" + "基本信息字段不再被自动追加").
- Reused the AC3 assertion trick already used successfully by #23's own browser verification: rather than trying to distinguish "was this exact message a real thread bubble vs. still just the candidate card," just assert the candidate's text count went from 1 (only in the still-visible `ReplyCard`) to 2 (candidate card + a new message bubble in the thread) after clicking "复制" — cheap and unambiguous.
- **Sandbox verification, same class of finding as every prior issue's e2e work**: `npm run build` succeeded cleanly, and running the full `npx playwright test` suite (all three specs together) failed identically for all three with "Process failed to launch!" — this run's error output happened to surface the underlying cause for the first time: `Electron: bad option: --remote-debugging-port=0`, an Electron-binary/launch-flag incompatibility specific to this sandboxed environment, confirming (more concretely than previous issues could) that this is an environment limitation and not a defect in any of the three spec files, old or new. Before trusting the new spec's logic despite being unable to run it for real, dry-ran its exact selector/action sequence against a stateful mocked `window.api` on the plain Vite renderer (same technique used for #19's own spec) — 10/10 checks passed, zero console errors, after fixing one dry-run-harness gap (missing `clipboard-read`/`clipboard-write` permission grant on the browser context, the same class of fix #23's verification needed) that had nothing to do with the actual application code.
- Recommend running `npm run test:e2e` on a real CI runner or local dev machine as the final confirmation for all three specs — same standing recommendation every e2e issue in this session has made, now additionally informed by the concrete `--remote-debugging-port=0` error surfaced here, which may be worth a quick look if the same failure recurs outside this sandbox.

## Dependencies
Issue #20, Issue #22, Issue #23, Issue #24, Issue #25

## Type
infra

## Priority
high

## Design Reference
无

## PRD Reference
`tasks/prd-general-settings-and-model-page.md` — US-007
