# 角色卡片复制按钮与交互

## Description
在 [RolesScreen.tsx](../../src/screens/roles/RolesScreen.tsx) 的角色卡片操作区新增「复制」按钮，点击后即时创建副本并停留在列表（不打开弹窗）。参见 [tasks/prd-persona-duplicate.md](../../tasks/prd-persona-duplicate.md) US-002、US-003、FR-1、FR-4、FR-5、FR-6。

## Acceptance Criteria
- [x] 操作区在「编辑」和「删除」按钮之间新增复用 `IconCopy`（[icons.tsx](../../src/components/ui/icons.tsx)）的复制图标按钮，`aria-label` 为「复制${persona.name}」
- [x] 点击调用 `window.api.persona.duplicate(id)`，成功后调用 `refresh()` 刷新列表并展示 toast「角色已复制」（success 类型）
- [x] 复制进行中该卡片的复制按钮显示 loading/禁用状态，防止重复点击产生多个副本
- [x] 失败时展示错误 toast（`error_ instanceof Error ? error_.message : '复制失败'`），列表保持不变
- [x] 新副本的 `usageCount` 应为 0（因为副本不复制任何 `chat_card` 关联，来自 Issue #065 的后端实现）
- [x] Typecheck/lint 通过
- [x] Verify in a browser（e.g. via the `run` skill）

## Dependencies
Issue #065（后端支持复制角色）

## Type
frontend

## Priority
high
