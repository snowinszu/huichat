# 创建/编辑/删除模型卡片

## Description
在模型卡片列表基础上，支持创建、编辑、删除模型卡片：创建首张卡片时自动设为当前模型；删除受保护，不能删除当前模型卡片。

## Acceptance Criteria
- [x] "新建模型卡片"按钮打开创建表单，字段：卡片名称（必填文本）、provider（下拉，复用现有 `PROVIDER_ORDER`/`PROVIDER_META`）、API key（掩码输入，show/hide 切换）、model（输入框 + 按 provider 变化的推荐模型 chip）— `SettingsScreen.tsx` 的 `openCreate`/`Modal`，字段复用 `RolesScreen`/原设置表单的 `Input`/`Select`/`PasswordInput` 组件
- [x] 选择"自定义端点"provider 时额外显示 Endpoint 字段 — `provider === 'custom'` 时条件渲染 Endpoint `Input`，与原单表单逻辑一致
- [x] 卡片名称为空、API key 为空/格式非法、自定义端点缺失或格式非法时阻止保存，并显示行内错误提示（复用现有 `validateApiKey`/`validateModel`/`validateBaseUrl`）— 新增 `validateName`（本地小函数，同 `RolesScreen` 角色名称校验的写法），其余三项直接复用 `providerMeta.ts` 现有函数
- [x] 创建的是应用内第一张模型卡片时，自动将其设为当前模型 — `register.ts` 的 `modelCardCreate` handler：`listModelCards().length === 0` 时插入后立即调用 `setCurrentModelCard`
- [x] 保存后卡片出现在列表中，持久化到数据库，重启应用后仍存在 — `handleSave` 调用 `window.api.modelCard.create/update` 后 `refresh()`；SQLite 持久化沿用 #14 的表结构
- [x] 每张卡片提供"编辑"入口，打开预填当前值的表单（复用创建表单与校验规则），保存后立即更新列表展示与持久化；若编辑的是当前模型卡片，保存后仍保持"当前"标记不变 — `openEdit` 预填五个字段；`updateModelCard` 从不触碰 `is_current` 列（#14 已有的不变量），编辑当前卡片验证过徽章保持不变
- [x] 每张非当前卡片提供"删除"入口，删除前弹出二次确认对话框，确认后卡片从列表和数据库中移除 — 列表项仅在 `!card.isCurrent` 时渲染删除 `IconButton`；确认用复用的 `ConfirmDialog`（danger 语气）
- [x] 尝试删除"当前模型"卡片时，操作被阻止，并提示"请先切换当前模型后再删除"— 双层防护：UI 层当前卡片根本不渲染删除入口（上一条已覆盖），且 `register.ts` 的 `modelCardDelete` handler 也会在 `getCurrentModelCard().id === id` 时直接 `throw new Error('请先切换当前模型后再删除')`，防止绕过 UI 直接调用 IPC 删除当前卡片
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均 0 error/0 warning
- [x] Verify in a browser (e.g., via the `run` skill) — 见 Implementation Notes

## Implementation Notes
- Wired `modelCardCreate`/`modelCardUpdate`/`modelCardDelete` into `register.ts` (the channel constants and repository functions were already reserved by #14) plus the matching `create`/`update`/`delete` preload bridge methods. The `modelCardSetCurrent` channel is still intentionally unwired — that's #17's job — but this issue's `create` handler does call the repository's `setCurrentModelCard` function directly (not through its own IPC channel) to implement "first card auto-becomes current," which is a different concern from #17's user-facing "manually switch" action.
- Delete protection is deliberately two layers, not one: the current card's delete icon is never rendered (`!card.isCurrent` gate in the list), *and* the `modelCardDelete` IPC handler independently re-checks `getCurrentModelCard()` before deleting and throws with the exact AC-specified message. The second layer exists because the IPC channel is reachable directly (bypassing the UI entirely), so hiding the button alone isn't real protection — verified this matters by calling the handler logic directly with a current card's id in the backend test script below and confirming it throws rather than silently succeeding.
- `providerMeta.ts` was not touched in this issue — `PROVIDER_ORDER`/`PROVIDER_META`/`validateApiKey`/`validateModel`/`validateBaseUrl`/`maskApiKey` (the last one added in #15) were reused as-is. Only a new local `validateName` was added to `SettingsScreen.tsx`, matching the same one-liner style `RolesScreen.tsx` uses for its own name validation.
- Verified the two business rules with a throwaway `tsx` script (Node 22.20.0, same pattern as #14/#15) against a real SQLite file, with local functions that mirror `register.ts`'s `modelCardCreate`/`modelCardDelete` handler bodies exactly (not the repository functions directly, since the auto-current and delete-protection rules live in the handler layer, not the repository) — 17/17 checks passed: first card auto-current, second card not auto-current, editing the current card preserves its `is_current` flag, deleting the current card throws with the exact AC message and leaves it undeleted/still-current, deleting a non-current card succeeds, and a card becomes deletable again once it's no longer current. Script deleted after running.
- **Verified in a browser**: same `ELECTRON_STARTUP_PREVENT=1 npm run dev` + Playwright/headless-Chromium approach as #15 (Electron can't launch a real GUI window in this sandbox). This time `window.api.modelCard` was mocked as a small *stateful* in-memory store (not fixed fixtures) implementing the same create/update/delete semantics as the real backend, so the UI's actual request/response wiring was exercised end-to-end rather than just its rendering of static data. 13/13 checks passed: empty-submit shows both "请填写卡片名称" and "请填写 API Key" inline errors; creating the first card auto-shows exactly one "当前模型" badge; creating a second (Anthropic) card leaves the badge count at exactly one; exactly one delete button is visible in the DOM and it belongs to the non-current card (`aria-label="删除Anthropic-个人号"`); both cards have edit buttons; editing the current card's model to `gpt-4o-mini` updates the list and the badge survives the edit; deleting the non-current card via its button + confirm dialog removes it while the current card remains. Screenshots confirm the current card shows only an edit icon (no delete icon) while the non-current card shows both. Zero console errors throughout. Driver script deleted after running, never entered the diff.

## Dependencies
Issue #14, Issue #15

## Type
fullstack

## Priority
high

## Design Reference
无专属设计稿，表单交互参考 `UI design/settings.html` 现有的 provider/API Key/model 表单，卡片增删改交互参考 `UI design/roles.html`/`UI design/home.html` 中角色与聊天对象卡片的创建/编辑/删除模式

## PRD Reference
`tasks/prd-multi-llm-model-cards.md` — US-003, US-004, US-005
