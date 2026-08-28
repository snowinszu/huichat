# 分组重命名与删除

## Description
在分组区块标题旁提供重命名/删除入口，删除分组时组内卡片自动回退为未分组。参见 [tasks/prd-chat-card-grouping.md](../../tasks/prd-chat-card-grouping.md) US-004、FR-7、FR-8。

## Acceptance Criteria
- [x] 每个自定义分组的区块标题旁提供「重命名」「删除」图标按钮（「未分组」区块不显示这两个按钮，因为它不是一个真实分组记录）
- [x] 点击「重命名」后标题原地切换为输入框，回车或失焦保存，为空时恢复原名称并提示错误
- [x] 点击「删除」弹出确认对话框；若该分组下有聊天对象，对话框需提示"组内 N 个聊天对象将变为未分组"（文案与措辞参照角色删除警示弹窗 [RolesScreen.tsx](../../src/screens/roles/RolesScreen.tsx) 中 `usageCount > 0` 的处理）
- [x] 确认删除后，该分组从数据库中移除，原属于它的聊天对象自动出现在「未分组」区块中（依赖 Issue #068 的 `ON DELETE SET NULL`）
- [x] Typecheck/lint 通过
- [x] Verify in a browser（e.g. via the `run` skill）

## Dependencies
Issue #068（分组数据层与仓储）, Issue #070（首页按分组分区展示，支持折叠/展开）

## Type
frontend

## Priority
medium
