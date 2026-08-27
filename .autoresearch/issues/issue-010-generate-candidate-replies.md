# 生成三条候选回复 + 语气选择 + 重新生成 + 一键复制

## Description
用户选定单一语气后，AI 结合卡片全部上下文生成 3 条候选回复；支持重新生成与逐条一键复制到剪贴板。

## Acceptance Criteria
- [x] 语气选择器（单选），至少含：礼貌、幽默、暧昧、真诚、撒娇、高冷、简洁直接、安慰共情；须先选定唯一语气才能生成 — `src/screens/chat/ChatScreen.tsx` 底部面板新增 `TONE_OPTIONS`（恰好这 8 项，与 AC/设计稿一致），用早前 issue 就建好但一直没被用到的 `ToneChip` 组件渲染成单选行（点击即切换 `selectedTone`，非多选），"生成回复" `Button` 在 `!selectedTone` 时 `disabled`
- [x] 点击"生成回复"经由 pi 调用 LLM，带入卡片上下文（对方信息/己方角色/最终目标/短期目标/历史消息）与选定语气，返回 3 条内容不同、语气统一的候选回复 — 新增 IPC `reply:generate`（`electron/shared/ipc-types.ts` + `preload/index.ts` + `electron/main/ipc/register.ts`），主进程处理器读取 `chatCard`/`persona`（若关联）/`message` 历史 + `settings`，交给新增的 `electron/main/llm/generateReplies.ts::buildReplyPrompt` 拼成一段结构化中文 prompt（对方信息/我的角色设定/聊天最终目标/本次短期目标/聊天记录/语气要求），复用已有的 `callLlm`（pi-ai，未改动）发起请求，要求模型严格输出 `{"replies":[...]}` JSON；`parseReplies` 优先解析 JSON，解析失败时退化为按行解析（去掉行首编号），保证即使模型没有完全遵守格式也能拿到 3 条候选而不是硬报错
- [x] 3 条候选并排/列表展示，生成中显示 loading，失败显示错误状态+重试按钮 — `genState: 'idle'|'loading'|'error'|'done'` 驱动 UI：loading 时渲染 3 张 shimmer 骨架卡（`.skeletonCard`/`.skelLine`，与设计稿 `chat.html` 的 `.skeleton-cards` 动画一致），done 时用已有的 `ReplyCard` 组件三栏 grid 并排展示，error 时渲染带 `IconAlertCircle` 的红色错误条 + "重试"按钮（复用同一个 `handleGenerate`）
- [x] "重新生成"按钮用相同上下文/语气重新发起生成，新结果替换当前展示的 3 条（不影响已持久化历史）；请求进行中按钮禁用防重复提交 — "重新生成"和"生成回复"是同一个 `handleGenerate` 处理函数（不重复造轮子，语气/卡片 id 不变，天然复现同一上下文），成功后 `setReplies(result)` 直接替换 state（候选回复本就从未写入过 `message` 表，无持久化历史可影响）；`genState==='loading'` 时"生成回复"走 `Button` 的 `loading` prop 自动置灰禁用，"重新生成"仅在 `genState==='done'` 时才渲染（loading/error 状态下不存在），天然防止重复点击
- [x] 每条候选回复上有复制按钮，点击将纯文本写入系统剪贴板并显示成功提示（toast/勾选图标）— `handleCopyReply` 调 `navigator.clipboard.writeText`，成功后 `ReplyCard` 内建的勾选图标状态（`copied` prop，早前 issue 就做好但一直没用到）显示"已复制" 2 秒；剪贴板写入失败（极端情况，如权限被拒）时降级为 toast 报错，不会让用户以为复制成功了
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — 沙箱限制同 #6/#7/#8/#9，复用同一套"不含 `vite-plugin-electron` 的临时渲染层配置 + headless Chromium（Playwright，另加 `clipboard-read`/`clipboard-write` 权限）+ 内存 mock `window.api`"验证路径：语气未选时按钮禁用、选定语气后可点击、生成中骨架屏可见、生成完成后 3 张候选卡 + 语气标题正确、点击复制后勾选图标出现且系统剪贴板确实写入了对应文本、"重新生成"用同一语气/卡片再次调用并整体替换了 3 条候选（mock 记录了 4 次调用，参数全部一致）、失败态的错误条+重试按钮正确出现、重试后恢复成功，全程截图确认且控制台无报错

## Post-close revisions
- **UI 位置/交互后来在 #11 的过程中被多次调整**：生成结果区域从与 #11 的"润色"共用同一批 state，重新生成按钮已被移除（"生成回复"按钮本身兼任重新生成——再次点击即用当前语气/草稿框状态重新调用），"生成回复"按钮的位置也从独立一行移到了语气标签行的右侧。功能性的"重新生成"能力仍然存在，只是不再有一个专门叫"重新生成"的按钮。详见 `issue-011-content-polish.md` 的 Implementation Notes（第三～五次修订）。
- **新增：候选回复会匹配对方消息的语言并附中文翻译**（用户在查看 #12 期间提出的直接指令，不属于本 issue 原始 AC，但增强的正是这里的生成流程，故记录于此）。`electron/main/llm/promptContext.ts` 新增 `lastOtherMessage()`，`generateReplies.ts`（及 #11 的 `polishDraft.ts`）据此判断"对方"最近一条消息是否为非中文（复用 #8 引入、现搬到 `electron/shared/language.ts` 的 `isNonChineseText` 启发式，主进程和渲染进程共用同一份实现）；非中文时 prompt 会要求模型用同一语言写回复，并额外提供中文翻译，JSON 契约从 `{"replies": ["..."]}` 变为 `{"replies": [{"text": "...", "translation": "..."或 null}]}`。`ReplyCandidate` 类型加入 `electron/shared/ipc-types.ts`，`reply:generate`/`reply:polish` 的返回类型相应从 `string[]` 改为 `ReplyCandidate[]`。`ReplyCard` 组件新增 `translation` 属性，复用 `chat.html` 设计稿里的 `.reply-translation`/`.reply-translation-tag` 视觉（早前实现候选回复时未采用，这次才真正用上）；复制按钮只复制 `candidate.text`（要发送的内容），"加入对话"则把 `text` 和 `translation` 一起写入 `message` 表，让对话线程里也能看到这条自己消息对应的中文翻译（复用已有的 `message.translation` 渲染逻辑，未做任何改动即天然支持）。

## Dependencies
Issue #1, Issue #2, Issue #4, Issue #6, Issue #7, Issue #8

## Type
fullstack

## Priority
high

## Design Reference
`UI design/chat.html`
