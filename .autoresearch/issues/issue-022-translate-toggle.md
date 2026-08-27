# "翻译非中文消息" 开关接入

## Description
把 #21 新建的"翻译非中文消息"开关接入真实的粘贴消息翻译流程：关闭后完全跳过翻译，不再发起任何 LLM 调用。

## Acceptance Criteria
- [x] 开关默认开启（与当前行为一致：非中文消息自动翻译）— 沿用 #21 schema.ts 播种的默认值 `translate_non_chinese = 1`
- [x] 关闭后，粘贴非中文消息不再调用翻译、气泡下方不显示翻译区块，且不发起任何 LLM 请求（不调用 `window.api.message.translate`）— `ChatScreen.tsx` 的 `handleAddMessage` 把判断条件从单纯 `isNonChineseText(trimmed)` 改为 `preference.translateNonChinese && isNonChineseText(trimmed)`，关闭时整个 `if` 块（含 `window.api.message.translate` 调用）完全不执行
- [x] 开启后行为与当前一致：非中文消息自动附带中文翻译 — 逻辑与关闭前完全一致，仅多了一层前置判断
- [x] 切换开关无需重启应用，下一次粘贴消息即生效 — `ChatScreen` 在每次挂载时都重新 `fetch` 偏好（不跨屏缓存），从设置页改完开关后重新进入聊天页即读到最新值
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 见 Implementation Notes

## Implementation Notes
- Extracted `DEFAULT_APP_PREFERENCE` (`src/lib/appPreferenceDefaults.ts`) out of `SettingsScreen.tsx`, which previously had its own local copy of the same literal — this issue is the second consumer (`ChatScreen.tsx` now also needs an in-memory default before its own `appPreference.get()` resolves), so keeping two independent copies of "what the defaults are" risked them drifting apart. Both screens now import the one shared constant.
- `ChatScreen` fetches the whole `AppPreferenceRecord` (not just `translateNonChinese`) since that's the only shape the `appPreference.get()` IPC call returns — there's no partial-fetch API, and #23 (auto-add-to-history) will read a different field off the same already-fetched state rather than adding a second fetch.
- The preference fetch is deliberately un-cached and re-runs on every `ChatScreen` mount rather than being hoisted to a shared/global context — this app's simple single-view routing means only one screen is ever visible at a time, so "re-fetch on mount" is sufficient for "change it in Settings, it's live the next time you're in a chat" without needing cross-screen state synchronization machinery.
- Verified with a headless-Chromium dry run (Electron still can't launch a real GUI window in this sandbox) covering both toggle states against a stateful mocked `window.api`: with the preference on, a pasted English message got translated and the translation call fired exactly once; with it off, the exact same message was added with no translation block and the mocked `translate()` function was never invoked at all (asserted via a call counter, not just "no bubble visible" — proving the LLM call itself was skipped, not just its result hidden). One bug caught and fixed along the way: the first draft of the mock's `listByChatCard` returned a live reference to the same mutable array `insert` pushed into, which combined with `ChatScreen`'s own `setMessages((current) => [...current, inserted])` produced a duplicate-key React warning and a doubled message — a test-mock defect (fixed by returning a shallow copy), not a `ChatScreen.tsx` bug; confirmed by the fact that the real `handleAddMessage` code path was unchanged between the failing and passing runs. 5/5 checks passed after the fix, zero console errors. `npm run build` also verified clean. Driver script deleted after running, never entered the diff.

## Dependencies
Issue #21

## Type
fullstack

## Priority
medium

## Design Reference
无专属设计稿

## PRD Reference
`tasks/prd-general-settings-and-model-page.md` — US-003
