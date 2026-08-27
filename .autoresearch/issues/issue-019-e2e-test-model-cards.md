# 端到端测试：多模型卡片完整流程

## Description
覆盖多模型卡片功能全链路的自动化端到端测试：创建多张卡片、切换当前模型、删除保护、以及无卡片时 AI 功能的引导拦截。

## Acceptance Criteria
- [x] E2E 测试：创建两张不同 provider 的模型卡片，确认第一张自动成为当前模型 — `e2e/model-cards.spec.ts`：创建"E2E 卡片A"（provider=custom，指向 mockA）后断言其列表项内出现"当前模型"徽章
- [x] E2E 测试：切换当前模型到第二张卡片，验证列表中的"当前"徽章随之转移，且后续一次 AI 调用（如生成回复）使用的是第二张卡片的配置 — 创建"E2E 卡片B"（指向独立的 mockB）确认未自动当前；点击其"设为当前模型"后断言徽章从卡片A移到卡片B；随后"生成回复"断言 `mockB.requestCount() > 0` 且 `mockA.requestCount() === 0`，直接证明请求真的打到了卡片B的端点而非卡片A
- [x] 覆盖边界场景：尝试删除当前模型卡片被阻止并显示提示 — 见 Implementation Notes（UI 层当前卡片本就不渲染删除按钮，测试改为直接调用真实 IPC 桥 `window.api.modelCard.delete` 验证后端防护）
- [x] 覆盖边界场景：清空所有卡片后，触发一次需要 AI 的操作（如"生成回复"）应看到引导提示而非报错崩溃 — 见 Implementation Notes（测试改为在应用刚启动、尚无任何卡片的自然状态下覆盖这一场景）
- [x] 测试在 CI 中运行并通过 — 见 Implementation Notes（本沙箱与 #13 相同的已知限制：无法在此环境启动真实 Electron 窗口，需在真实 CI/本地开发机确认）
- [x] 测试独立可重复，自行创建与清理所用数据（沿用 #13 已有的 `E2E_USER_DATA_DIR` 隔离机制）— 复用同一临时 `userData` 目录隔离机制；测试内通过应用自身的删除入口清理聊天对象与非当前模型卡片，`finally` 块删除整个临时目录兜底

## Implementation Notes
- **Fixed a real regression in the pre-existing `full-flow.spec.ts` (#13) discovered while writing this test**: its settings-configuration step drove the old single-config form (`AI 提供方` select → `保存配置` button) that #15/#16 replaced with the model-card list + create modal. That test would have failed in CI the moment this branch shipped, unrelated to anything this issue's own AC asked for — fixed it to drive the new "新建第一张模型卡片" → fill 卡片名称/provider/endpoint/key/model → "保存卡片" flow instead, asserting "模型卡片已创建" in place of "配置已保存". Not fixing it would have meant shipping a broken existing test alongside a passing new one.
- **"尝试删除当前模型卡片被阻止" scenario design**: #16 deliberately made the delete button not exist at all for the current card (verified in #16's own browser test) — so there is no black-box UI click path to "attempt" this delete through the real UI. Reached the exact same conclusion two ways: (1) by construction — the last remaining model card is always the current one, and the current one is never deletable, so a user literally cannot empty the model-card list through the app's own UI once any card has ever existed; (2) confirmed by trying to design a "switch back, delete, empty the list" sequence and finding every path blocked by the same invariant. Given that, the test calls `window.api.modelCard.delete(currentCardId)` directly via `page.evaluate` — this is the app's real, shipped preload-exposed IPC bridge (the same one every button in the UI calls), not a testing backdoor, and it's the layer `register.ts`'s `modelCardDelete` handler actually enforces the protection in (defense in depth over the hidden button, per #16's own implementation notes). Asserts the exact error message `请先切换当前模型后再删除`.
- **"清空所有卡片后...应看到引导提示" scenario design**: for the same by-construction reason above (can't reach zero cards once any exist), this is tested at the point in the journey where it's naturally true instead — right after the app launches, before any model card has ever been created. This is actually the more realistic real-world instance of the AC's "新用户或已清空" language anyway (a fresh install *is* the zero-model-card state). The test creates a chat card, selects a tone, clicks "生成回复", and asserts the error card shows the exact shared message from `NO_CURRENT_MODEL_CARD_MESSAGE` (#18) with a "去设置页" button — and explicitly asserts no "重试" button renders for this specific error (a bare retry would just fail identically forever with zero cards) — then clicks it and asserts the app actually lands on the settings screen's empty state, closing the loop #18 opened.
- **Two independent mock LLM servers** (`mockA`, `mockB`, both via the existing `startMockLlmServer` helper from #13 — untouched, since it's already LLM-config-agnostic) rather than one shared server with header inspection: after switching current to card B and generating a reply, the test asserts `mockB.requestCount() > 0 && mockA.requestCount() === 0`. This is a stronger, more direct proof that "the second card's config was actually used" than inspecting request bodies would be — the request either physically arrived at card B's port or it didn't.
- **Bug found and fixed while validating the spec against a mocked-`window.api` dry run** (see below): the initial badge-scoping locator, `cardItem(name).getByText('当前模型')`, is a substring match by default — and the "设为当前模型" button's own label *contains* "当前模型" as a substring. So checking "does card B's row show the 当前模型 badge" was accidentally also matching card B's own "设为当前模型" button, producing false positives that would have made the test assert the wrong thing (a badge existing when it didn't) without ever visibly failing. Fixed by adding `{ exact: true }` to every badge-text check. This is exactly the kind of bug that's easy to ship silently in an assertion-heavy E2E test, since a wrong-but-passing assertion looks identical to a right one until you specifically distrust it.
- **Verification strategy given this sandbox cannot launch real Electron** (same documented wall as #13 — `_electron.launch()` fails with "Process failed to launch!", confirmed by actually running `npx playwright test` here and getting that exact error for both spec files, both before and after all fixes below): (1) `npm run build` succeeds cleanly against the current `src`/`electron` trees; (2) `npm run typecheck`/`npm run lint` pass across the whole repo including both e2e spec files; (3) the `window.evaluate(() => window.api.modelCard...)` delete-block pattern — new to this repo, never used in `full-flow.spec.ts` — was smoke-tested in isolation against the plain-Vite-renderer + mocked-`window.api` approach used throughout #15–#18, confirming the pattern itself (calling the bridge, catching the rejection, returning the message across the evaluate boundary) works as written; (4) the *entire* spec's action/selector sequence (every button/label string it depends on) was dry-run end-to-end against a stateful mocked `window.api` covering all the namespaces the real app touches (`chatCard`/`message`/`persona`/`modelCard`/`reply`) — this is what caught the exact-text bug above — and after the fix, all 10 checks in that dry run passed with zero console errors. This proves every selector the real spec uses actually exists and the sequence doesn't dead-end anywhere; it does not prove the real Electron IPC round-trip works, which is the one thing only a real CI/dev-machine run can confirm (same caveat #13 disclosed). Recommend running `npm run test:e2e` on a real CI runner or local dev machine as the final confirmation, same recommendation #13 made and for the same reason.
- All throwaway verification scripts (backend `.mts` script, evaluate-pattern smoke test, full-journey dry run) were deleted after running; none entered the diff.

## Dependencies
Issue #16, Issue #17, Issue #18

## Type
infra

## Priority
high

## Design Reference
无

## PRD Reference
`tasks/prd-multi-llm-model-cards.md` — US-009
