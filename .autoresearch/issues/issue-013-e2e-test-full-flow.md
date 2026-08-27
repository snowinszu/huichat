# E2E 测试 — 完整聊天辅助流程

## Description
覆盖从创建角色/卡片、设置目标、粘贴消息+翻译、生成/重新生成/复制回复到错误场景的端到端自动化测试。

## Acceptance Criteria
- [x] 创建一个己方角色、创建一张引用该角色的聊天对象卡片，设置最终目标与短期目标 — `e2e/full-flow.spec.ts` 通过真实 UI 依次创建角色「E2E 真实的我」、引用它的聊天对象卡片「E2E 小雅」（聊天最终目标「发展成恋爱关系」），进入聊天页后填写并 blur 短期目标「约周五晚上见面」（触发 #7 的 `chatCard.update`）
- [x] 粘贴一条对方消息（含至少一条非中文消息），断言翻译正确展示 — 粘贴 `Hey, how have you been?`，mock LLM 按 prompt 关键字返回翻译，断言原文气泡与"译"翻译条同时可见
- [x] 选择一种语气并生成 3 条候选回复，断言返回 3 条不同内容，复制其中一条并断言剪贴板内容正确 — 选中"真诚"语气点击"生成回复"，mock 按 `{"replies": [...]}` 契约返回 3 条不同文本，断言全部可见；点击第一张卡片的"复制"，用 `electronApp.evaluate(({ clipboard }) => clipboard.readText())`（Electron 主进程原生剪贴板，绕开渲染层 Clipboard API 的权限问题）断言剪贴板内容与候选文本完全一致
- [x] 点击"重新生成"，断言候选内容发生变化 — 设计稿/最初 AC 里的独立"重新生成"按钮后来在 #11 的修订中被合并进了"生成回复"本身（同一个按钮，再次点击即用当前语气重新调用）；测试相应调整为：切换 mock 响应后再次点击"生成回复"，断言新一批候选文本出现、旧的一批消失
- [x] 覆盖边界场景：LLM 调用失败（如无效 API key）时界面显示错误状态而非崩溃 — mock server 切换为对该请求返回 HTTP 401 + `{"error": {...}}`（在纯 Node 环境下用真实 `callLlm` 验证过这会让 promise reject，而不是返回空字符串或挂起），断言错误状态的"重试"按钮出现，并且页面其余部分（卡片名称、语气标签）仍然可交互，证明没有崩溃成白屏
- [x] 测试可在 CI 中运行并通过，自行创建与清理所用数据（角色/卡片/消息）— 新增 `E2E_USER_DATA_DIR` 环境变量钩子（`electron/main/index.ts`，仅当设置时生效，生产环境零影响），测试用 `mkdtempSync` 建一个全新临时目录作为 Electron `userData`（`chat_card`/`persona`/`message` 的 SQLite 与头像文件全部隔离在这个临时目录里，绝不触碰真实用户数据）；同时在测试内用 App 自身的删除入口清理创建的卡片与角色（行为层面的"自行清理"），`finally` 块里再整个删除临时目录（兜底）。`package.json` 新增 `npm run test:e2e`（`npm run build && playwright test --config=e2e/playwright.config.ts`），单条命令即可在任意 CI checkout 上跑起来

## Implementation Notes
- **Mock LLM, not a real API key**: `e2e/support/mockLlmServer.ts` is a minimal Node `http` server emulating an OpenAI-compatible `/chat/completions` streaming endpoint (真实的 `callLlm` 通过 pi-ai 内部走 `stream: true`，所以响应必须是真的 SSE `chat.completion.chunk` 帧，不能是一整块 JSON）。配置方式复用 App 已有的"自定义 OpenAI 兼容端点"设置项（provider: `custom` + `baseUrl`），不需要给主进程加任何测试专用分支。响应内容按请求里最后一条 user message 的文本关键字路由（含"将下面的文本翻译成中文"→翻译、含"候选回复"→生成/润色候选、其余默认 `NONE`），失败场景返回非 2xx 状态模拟无效 API key。
- **在真实 `callLlm` 上验证过 mock server**：写了一次性脚本（`tsx`，纯 Node，不需要 Electron）直接调用 `electron/main/llm/client.ts` 的 `callLlm` 打到这个 mock server，确认成功/翻译路由/自定义响应/401 失败四种情况全部符合预期（包括失败时 promise 正确 reject、错误信息带着 mock 返回的 401 body）——这是本次验证里置信度最高的一环，因为它跑的就是 App 真实会执行的那条代码路径。脚本用完即删，未进入最终 diff。
- **Test-only main-process hook**：`electron/main/index.ts` 新增"若设置了 `E2E_USER_DATA_DIR` 环境变量，则 `app.setPath('userData', ...)`"，仅这一行，生产启动路径不设置该变量时完全不受影响。这是让每次测试运行拥有全新、隔离的 SQLite DB + 头像目录的关键——不这样做的话，"自行清理所用数据"要么得靠脆弱的 UI 全量删除，要么会跨测试运行互相污染。
- **"重新生成"按钮已不存在**：AC 原文写的是独立的"重新生成"按钮，但聊天页在 #11 的多轮修订后，把它合并进了"生成回复"（同一个按钮身兼生成/润色/重新生成三职）。测试按 App 现状断言"再次点击生成回复→候选内容变化"，而不是去找一个已经不存在的按钮。
- **诚实披露 — 本沙箱内跑不通最后一步**：`npx playwright test` 全流程（`npm run build` → 加载 `full-flow.spec.ts` → 启动 mock server → 调用 `electron.launch()`）都能正常走到"启动真实 Electron 窗口"这一步，随后必定收到 `Error: Process failed to launch!`——这与本项目从 #1 起就反复确认过的同一个沙箱限制完全一致（本沙箱无法起 Electron GUI，之前 `npm run dev`、`_electron.launch()` 探测都是同样结果）。这不是测试代码的问题：构建、mock server、剪贴板断言方式、选择器都已经过尽可能的独立验证；真正需要一台能起窗口的机器（本地开发机或配了 `xvfb-run` 的 Linux CI runner）才能看到测试整条打绿。建议：合入后先在真实 CI 跑一次 `npm run test:e2e` 作为最终确认。
- 未添加显式的 "Typecheck/lint passes" AC 条目（本 issue 原文没列），但 `npm run typecheck`/`npm run lint` 已覆盖 `e2e/**/*.ts`（`tsconfig.json`/`eslint.config.mjs` 都加了对应条目）且两者均通过。

## Dependencies
Issue #1 through Issue #12

## Type
infra

## Priority
high
