# 自动提取并记录双方信息

## Description
每次新增消息后，自动通过 LLM 提取消息中提到的新事实，追加到卡片对应信息字段中，供后续生成使用。

## Acceptance Criteria
- [x] 每次新增一条对方或己方消息后，触发一次信息提取（经由 LLM），识别新事实（如姓名、日期、偏好等）— `electron/main/ipc/register.ts` 的 `message:insert` handler 在 `insertMessage` 后，以 fire-and-forget 方式调用新增的 `electron/main/llm/extractInfo.ts::extractAndSaveInfo(db, message)`（不 `await`，只 `.catch` 记录日志），覆盖所有插入消息的入口（粘贴消息 #8、图片/表情标注 #9、"加入对话" #10/#11），无需在每个渲染层调用点重复接入；`role === 'annotation'` 或空 `content` 的消息直接跳过，不触发提取（标注的语义信息在 `annotationText`，不是这里要抓取的自由文本）
- [x] 提取到的信息追加保存到该卡片的对方信息/己方角色信息中，用户可在卡片详情中查看和编辑 — `role: 'other'` 的消息把提取结果追加到 `chat_card.other_info`（`updateChatCard`，#6 已有）；`role: 'self'` 的消息追加到该卡片关联角色的 `persona.bio`（`updatePersona`，#5 已有，未关联角色则直接跳过——没有落脚点）；查看/编辑复用 #6 首页卡片编辑 Modal 和 #5 角色编辑 Modal 已有的表单字段，未新增 UI，因为它们本来就是读写这两个字段的
- [x] 提取失败（如 LLM 调用出错）不阻塞正常聊天流程，仅静默记录错误日志 — `extractAndSaveInfo` 是 `async` 但从不被 `await`，`message:insert` 的 handler 同步返回插入的消息记录；失败通过 `.catch((error) => console.error('[info-extraction] failed for message', message.id, error))` 兜住，不会以任何形式向渲染层抛出或弹出 toast
- [x] 已提取信息会作为上下文用于后续回复生成 — 无需额外接线：#10/#11 的 `buildContextSection`（`electron/main/llm/promptContext.ts`）在每次生成/润色时都会用 `getChatCard`/`getPersona` 重新读取最新的 `otherInfo`/`persona.bio`，提取结果落库后下一次生成天然可见
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — 这是纯主进程功能，触发点在真实 `message:insert` IPC handler 内部，之前几个 issue 用的"渲染层 mock `window.api` + headless Chromium"验证路径完全绕过了主进程，测不到这里；改为用 `tsx` 直接对着真实 schema 建一个内存 SQLite（`electron/main/db/schema.ts` 的 `SCHEMA_SQL`），跑真实的 repository 函数（`createChatCard`/`createPersona`/`insertMessage`/`getChatCard`/`getPersona`），用一个桩函数替换掉网络请求那一层：`role: 'other'` 消息提取后正确追加到 `chat_card.other_info`、`role: 'self'` 消息追加到关联 `persona.bio`、`role: 'annotation'` 消息完全不触发调用、模型返回 `NONE` 时不写库、模型抛错时 promise 正确 reject（验证 `register.ts` 里的 `.catch` 确实是必要的，不是摆设）、未关联角色的卡片收到己方消息时不触发调用（没地方存）；另外用同一脚本验证了 `buildExtractPrompt`/`parseExtractedFacts`/`appendFact` 三个纯函数的边界情况。`npm run typecheck`/`npm run lint` 通过，验证脚本运行后已删除，未进入最终 diff

## Implementation Notes
- `extractAndSaveInfo(db, message, callModel = callLlm)` takes an optional third parameter defaulting to the real `callLlm` — every production call site (`register.ts`) omits it, so behavior is unchanged; it exists purely so the verification script above could inject a stub instead of hitting the network, without resorting to fragile ESM-namespace monkey-patching. This is the one deliberate deviation from this codebase's existing convention (every other LLM-calling function — translate, generate, polish — calls `callLlm` directly with no injection point) and is scoped to this single function.
- Facts are appended with a "；" separator (`appendFact`), never replacing existing `otherInfo`/`bio` text — matches the AC's "追加保存" wording. There's no dedup beyond what the prompt itself is asked to do ("且这些事实不在已记录的信息里") — the model is trusted to avoid restating what's already on file rather than the code re-checking substring overlap, since a hand-rolled dedup heuristic would be more fragile than just asking well.
- `role: 'self'` extraction requires a linked persona (`card.personaId`) — a card with no persona has no `bio` field to write to, so those messages are silently skipped rather than, say, extracting into a stray unlinked record.

## Dependencies
Issue #1, Issue #4, Issue #6, Issue #8

## Type
backend

## Priority
medium
