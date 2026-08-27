# AI 调用功能统一接入当前模型

## Description
把应用内所有发起 LLM 调用的功能（生成回复、重新生成、翻译、自动信息提取、内容润色）从旧的单行 `settings` 表切换为读取"当前模型"卡片的配置；没有任何模型卡片时，相关入口需给出引导提示而不是发起注定失败的请求。

## Acceptance Criteria
- [x] 生成回复、重新生成、翻译、自动信息提取、内容润色等功能改为读取当前模型卡片的配置发起 LLM 调用，不再依赖旧 `settings` 表（替换 `extractInfo.ts`、`register.ts` 等现有 `getSettings()` 调用点为等价的当前模型卡片读取方法）— `register.ts` 的 `loadChatContext`（供 `replyGenerate`/`replyPolish` 复用）与 `messageTranslate` handler 均改为 `getCurrentModelCard()`；`extractInfo.ts` 同样改为 `getCurrentModelCard()`。旧 `settings` 表/`settingsRepository.ts`/`settings:get`/`settings:save` channel 按 PRD 决定保留但不再被任何 AI 调用路径读取（仅 `settingsGet`/`settingsSave` 这两个遗留 handler 自身还在用它们，未删除）
- [x] 不存在任何模型卡片（新用户或已清空）时，上述功能的触发入口应提示"请先在设置页创建并选择模型"，并引导跳转设置页 — 新增共享常量 `electron/shared/errors.ts` 的 `NO_CURRENT_MODEL_CARD_MESSAGE`，主进程抛出、渲染进程匹配；`ChatScreen.tsx` 新增 `onNavigateToSettings` prop（`App.tsx` 接线到 `setView('settings')`），生成/润色失败且错误信息命中该常量时，错误卡片显示"去设置页"按钮取代"重试"
- [x] 无卡片场景下不发起注定失败的 LLM 请求，也不产生未处理异常/白屏 — `loadChatContext`/`messageTranslate` 在拿到 `undefined` 时提前 `throw`，从不构造/发起 `callLlm` 调用；`extractAndSaveInfo`（fire-and-forget 后台提取）在无当前卡片时直接 `return`，同样从不调用 LLM，且从不向上抛出（外层 `.catch` 只用于兜底真正的调用失败，不会被这条路径触发）
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 见 Implementation Notes

## Implementation Notes
- Every `getSettings()` call site in the AI-calling path was swapped 1:1 for `getCurrentModelCard()` — field names are identical between `SettingsRecord` and `ModelCardRecord` (`provider`/`apiKey`/`model`/`baseUrl`), so the `callLlm({...})` config-building code at each call site needed no structural changes, only the source of the object. `register.ts`'s `settingsGet`/`settingsSave` handlers themselves were deliberately left untouched (still call `getSettings`/`saveSettings`) — the PRD's own Non-Goals say the legacy table/channels stay as unmigrated dead weight, not that they get deleted.
- Introduced `electron/shared/errors.ts` exporting one constant, `NO_CURRENT_MODEL_CARD_MESSAGE`, rather than hardcoding the Chinese string independently in both `register.ts` (where it's thrown) and `ChatScreen.tsx` (where it's matched) — this is the same main/renderer sharing pattern `electron/shared/ipc-types.ts` already established, and avoids the two sides silently drifting if the wording is ever tweaked on one side only.
- The renderer's match on this message uses `genError?.includes(NO_CURRENT_MODEL_CARD_MESSAGE)`, not `===`. This was a deliberate correctness call, not sloppiness: `ipcMain.handle` → `ipcRenderer.invoke` crosses a real Electron IPC boundary in production, which historically hasn't guaranteed the renderer's reconstructed `Error.message` is byte-identical to what main threw (wrapping/prefixing has varied across Electron versions) — and this sandbox can't launch real Electron to empirically confirm the exact behavior on the installed v43. `.includes()` is correct regardless of any such wrapping, whereas `===` would have been a plausible-looking bug that only breaks in the one environment (real Electron) this session couldn't test.
- "引导跳转设置页" needed an actual navigation path, not just a clearer error string — `ChatScreen` had no way to reach Settings before this issue, so `onNavigateToSettings: () => void` was added to `ChatScreenProps` and wired in `App.tsx` (`() => setView('settings')`), mirroring the same prop `HomeScreen` already had. Scoped to only the 生成回复/润色 error path (the one place a user-triggered action visibly dead-ends): the translate-on-paste failure already degrades gracefully (message still gets added, just without translation, per its existing non-blocking design) and the fire-and-forget info-extraction has no user-facing entry point to attach a button to, so neither needed this treatment.
- Verified the backend wiring with a throwaway `tsx` script (as `.mts` — this one needed top-level `await` for `extractAndSaveInfo`, and this repo's plain `.ts` throwaway scripts run under tsx's CJS transform which rejects top-level await) against a real SQLite file: confirmed `loadChatContext`-equivalent logic throws exactly `NO_CURRENT_MODEL_CARD_MESSAGE` with no model card present, confirmed `extractAndSaveInfo` calls its injected `callModel` zero times (and leaves the chat card's `otherInfo` untouched) when no card exists, then created+set a current model card and confirmed both paths now succeed with fields (`provider`/`apiKey`/`model`/`baseUrl`) flowing through unchanged from the model card into the constructed LLM config — 11/11 checks passed.
- **Verified in a browser**: same `ELECTRON_STARTUP_PREVENT=1 npm run dev` + Playwright/headless-Chromium approach as #15–#17. This was the first issue in the series to drive the *full* app shell rather than jumping straight to one screen — `window.api.chatCard.list/get` were mocked with one fake card so the real home screen click-through into the real chat screen could be exercised, `window.api.modelCard.list` returned `[]`, and `window.api.reply.generate/polish` were mocked to reject with the exact shared message (mirroring what the real IPC handler now throws). 5/5 checks passed: clicking the home card lands on the chat screen; selecting a tone and clicking "生成回复" shows the error card with the exact shared message; the error card shows a "去设置页" button and *not* "重试" for this specific error; clicking it navigates to the settings screen, landing on its empty state. Screenshots confirm both the error-card button swap and the post-navigation settings screen. Zero console errors throughout. Driver scripts deleted after running, never entered the diff.

## Dependencies
Issue #14, Issue #16

## Type
fullstack

## Priority
high

## Design Reference
无专属设计稿，无卡片时的引导提示参考 `UI design/chat.html` 中现有错误态/空态提示的视觉风格

## PRD Reference
`tasks/prd-multi-llm-model-cards.md` — US-008
