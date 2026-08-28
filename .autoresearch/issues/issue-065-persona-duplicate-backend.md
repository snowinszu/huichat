# 后端支持复制角色（含自动命名去重）

## Description
新增 `duplicatePersona(db, id)`，加上 IPC channel 与 preload 桥接，让前端有单次调用即可完成角色复制。参见 [tasks/prd-persona-duplicate.md](../../tasks/prd-persona-duplicate.md) US-001、US-004、FR-2、FR-3。

## Acceptance Criteria
- [x] `duplicatePersona(db, id)`（[personaRepository.ts](../../electron/main/db/personaRepository.ts)）读取源角色，计算去重后名称（`XX副本`，冲突则依次尝试 `XX副本2`/`XX副本3`…直到唯一），调用 `createPersona` 插入新记录并返回
- [x] 源角色 id 不存在时抛出错误（与 `updatePersona` 的 not-found 处理方式一致）
- [x] `bio` 原样复制；新记录拥有独立的 `id`/`createdAt`/`updatedAt`，不写入任何指向源角色的关联字段
- [x] 新增 `IPC_CHANNELS.personaDuplicate`（[ipc-types.ts](../../electron/shared/ipc-types.ts)），在 [register.ts](../../electron/main/ipc/register.ts) 中注册 handler
- [x] [preload/index.ts](../../electron/preload/index.ts) 暴露 `window.api.persona.duplicate(id): Promise<PersonaRecord>`
- [x] Typecheck/lint 通过

## Dependencies
None

## Type
backend

## Priority
high
