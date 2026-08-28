# 文字风格写入 AI 角色设定 prompt

## Description
让文字风格实际影响生成回复/润色草稿，而不仅仅是展示用的备注。参见 [tasks/prd-persona-writing-style.md](../../tasks/prd-persona-writing-style.md) US-004、FR-5、FR-6。

## Acceptance Criteria
- [x] [promptContext.ts](../../electron/main/llm/promptContext.ts) 的 `buildContextSection` 在【我的角色设定】部分之外，当 `persona.style` 非空时额外输出一个【说话习惯】小节，包含该文字风格内容
- [x] `persona.style` 为空时不额外输出这个小节（不出现空标题）
- [x] 生成候选回复（`reply:generate`）和润色草稿（`reply:polish`）两条链路都使用了包含该小节的 prompt
- [x] Typecheck/lint 通过

## Dependencies
Issue #076（角色数据层支持文字风格字段）

## Type
backend

## Priority
high
