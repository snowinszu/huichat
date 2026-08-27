# 语气选择器新增「智能模式」选项，默认选中且与其它语气互斥

## Description
在语气选择器（[ChatScreen.tsx](../../src/screens/chat/ChatScreen.tsx)）中新增「智能模式」chip，作为第一个选项且默认选中。定义一个不与自由文本冲突的内部标识常量（如 `SMART_TONE_ID`）用于区分「智能模式」与用户自定义语气，供后续 Issue #028、#029 复用。

## Acceptance Criteria
- [x] 语气选择器新增「智能模式」chip，渲染顺序固定为第一位（早于礼貌/幽默等 8 个预设及自定义语气）
- [x] 进入聊天卡片对话界面时，`selectedTone` 默认值为智能模式标识，而非 `null`
- [x] 「智能模式」与其它语气 chip（预设 8 种 + 自定义）互斥单选：选中其它语气会取消智能模式选中，反之亦然
- [x] 「生成回复」「润色」按钮在默认状态（智能模式已选中）下即可点击，无需用户先手动选语气
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
None

## Type
frontend

## Priority
high

## Design Reference
无（复用现有 `ToneChip` 组件样式）

## PRD Reference
`tasks/prd-smart-tone-mode.md` — US-001
