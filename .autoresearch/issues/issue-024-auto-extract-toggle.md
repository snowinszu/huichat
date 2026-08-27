# "自动信息提取" 开关接入

## Description
把 #21 新建的"自动信息提取"开关接入消息插入后的后台信息提取流程：关闭后不再触发该 fire-and-forget 的 AI 调用。

## Acceptance Criteria
- [x] 开关默认开启（与当前行为一致：每条消息插入后台自动触发信息提取）— 沿用 #21 schema.ts 播种的默认值 `auto_extract_info = 1`
- [x] 关闭后，粘贴/添加消息不再触发后台信息提取调用，聊天对象与角色的"基本信息"字段不再被自动追加 — `register.ts` 的 `messageInsert` handler 在调用 `extractAndSaveInfo` 前加 `if (getAppPreference(db).autoExtractInfo)` 前置判断，关闭时整个 fire-and-forget 调用完全不发起
- [x] 开启后行为与当前一致 — 逻辑与关闭前完全一致，仅多了一层前置判断，消息本身的插入不受影响
- [x] 切换开关无需重启应用，下一条消息即按新状态生效 — `getAppPreference(db)` 每次 `messageInsert` 都重新查库，不缓存
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 本 issue 是纯后端 IPC handler 改动（`message:insert` 内部逻辑），无任何 UI 改动可供浏览器截图验证，同 #14 先例；已改用等价的真实数据库集成测试覆盖，见 Implementation Notes

## Implementation Notes
- One-line gate: `if (getAppPreference(db).autoExtractInfo) { extractAndSaveInfo(...).catch(...) }` around the existing fire-and-forget call in the `messageInsert` handler. No changes to `extractInfo.ts` itself — the toggle lives entirely at the call site, same layer #18 already put the "no current model card" guard at.
- Verified with a throwaway `.mts` script (top-level `await` needed, same reason prior issues' async verification scripts used `.mts` over plain `.ts`) that mirrors the `messageInsert` handler's exact logic against a real SQLite database, using a fake `callModel` to detect whether extraction actually ran. Caught my own test-setup bug along the way: the first run showed extraction being "attempted" but never updating the chat card's `otherInfo` — turned out I'd forgotten to create a current model card in the test fixture, so `extractAndSaveInfo`'s own `getCurrentModelCard` guard (from #18) was silently no-op'ing before ever reaching my fake `callModel`. Not a bug in this issue's change — confirmed by the fact that adding the missing model card fixture (matching the pattern #18's own verification script used) fixed it with zero changes to the actual gating code. 8/8 checks passed after the fix: preference defaults to on and extraction runs/updates the card; flipping it off stops extraction entirely (fake model never invoked) while the message itself still inserts normally and `otherInfo` stays untouched; flipping it back on resumes extraction on the very next message with no restart.
- No UI surface changes in this issue (backend-only, per its own scope), so no browser verification was applicable — same as #14's precedent for a pure data/backend issue in this feature series. `npm run build` also verified clean.

## Dependencies
Issue #21

## Type
fullstack

## Priority
medium

## Design Reference
无专属设计稿（该开关不在 `UI design/settings.html` 中，为本 PRD 新增建议项）

## PRD Reference
`tasks/prd-general-settings-and-model-page.md` — US-005
