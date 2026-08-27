# 创建/管理己方角色 Profile

## Description
支持用户创建多个"己方角色"档案，供聊天对象卡片引用。

## Acceptance Criteria
- [x] 角色列表页展示所有已创建角色（名称 + 摘要）— `src/screens/roles/RolesScreen.tsx`，每项含头像（`avatarGradient` 按 id 生成确定性渐变 + 姓名首字）、名称、基本信息摘要、使用情况徽章（"被 N 个聊天对象使用" / "暂未使用"）；空状态有独立插画+文案+新建按钮
- [x] 支持创建/编辑/删除角色，字段包括角色名称、基本信息（自由文本）— 复用 `Modal` 组件承载创建/编辑表单（名称必填 + 校验、基本信息 Textarea），复用 `ConfirmDialog` 承载删除确认；新增 `electron/main/db/personaRepository.ts`（create/get/update/delete + `listPersonasWithUsage` 联表统计）与对应 IPC（`persona:*`）+ preload 桥接
- [x] 删除一个已被卡片引用的角色时，弹出确认提示说明影响 — `usageCount > 0` 时走 `ConfirmDialog tone="warning"`（黄色警示头、说明"这些聊天对象将失去角色关联"、显示引用数徽章），`usageCount === 0` 时走普通 `tone="danger"` 简单确认；两种情况删除都会真正执行（不是"仅警告不让删"），因为 schema 里 `chat_card.persona_id` 已改为 `ON DELETE SET NULL`（原为 `NOT NULL` + 无级联，会在 `PRAGMA foreign_keys=ON` 下直接抛外键异常，本 issue 顺带修正）
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning；过程中命中一次 `react-hooks/set-state-in-effect`，已改为与 `SettingsScreen` 一致的内联 `.then()` 模式修复）
- [x] Verify in a browser (via `run` skill) — Electron 仍无法在本沙箱起 GUI（同 #1-#4），改用纯 Vite 渲染层 + headless Chromium（Playwright）驱动；这次额外在页面里注入了一个内存版 `window.api.persona` mock（而不只是验证"无 bridge 时优雅降级"），从而能截图验证真实的创建/校验报错/编辑回填/两种删除确认弹窗的完整交互，而不只是空状态。控制台无报错

## Implementation Notes
- `ChatCardRecord.personaId` (and `CreateChatCardInput`/`UpdateChatCardInput`) widened from `number` to `number | null` to match the new `ON DELETE SET NULL` schema behavior. Issue #6 (chat-card CRUD) should treat "no persona selected/linked" as a real, expected state rather than an error.
- Added the "我的角色" icon button to `HomePlaceholder`'s titlebar — this is the nav slot flagged as deferred in Issue #4's notes ("add [roles icon] in issue #5 when roles screen is built"). `App.tsx`'s view union grew to `'home' | 'roles' | 'settings'`.
- Verified the persona repository (including the `ON DELETE SET NULL` cascade specifically) with a standalone `tsx` script against a throwaway SQLite file, same pattern as #3/#4: 13/13 checks passed — usage counts, immediate-persistence of edits, and confirming a referenced persona's delete nulls out `chat_card.persona_id` on every referencing card without deleting the cards themselves. Script deleted after the run.
- One test-methodology note for whoever picks up #6/#7: the first pass at browser verification hit a flaky Playwright multi-step script (a stray selector click desynced from the actual page state) that looked like a product bug — deleting the referenced persona seemed to skip the warning dialog. Re-running each delete path in isolation proved the component was correct all along; screenshots of both delete paths (plain and warning) confirm this. Worth remembering: an unexpected screenshot in a chained script is not proof of a bug — isolate the step before concluding the code is wrong.

## Dependencies
Issue #1, Issue #2

## Type
fullstack

## Priority
high

## Design Reference
`UI design/roles.html`
