# 偏好数据新增调试导出字段

## Description
在 `app_preference` 表新增两个字段：是否开启调试导出（`debug_prompt_export`）和导出目录路径（`debug_export_dir`），并扩展对应的 TypeScript 类型和仓储读写方法，为后续目录选择器和导出逻辑提供持久化基础。

来源：`tasks/prd-llm-debug-export.md` — US-001

## Acceptance Criteria
- [x] `app_preference` 表新增 `debug_prompt_export`（0/1，默认 0）和 `debug_export_dir`（TEXT，可为 NULL，默认 NULL）两列
- [x] `AppPreferenceRecord` 新增 `debugPromptExport: boolean` 和 `debugExportDir: string | null`
- [x] `UpdateAppPreferenceInput` 支持同时更新这两个字段（各自可选）
- [x] `appPreferenceRepository.ts` 的 `getAppPreference` / `updateAppPreference` 正确读写这两列，其余现有字段行为不受影响
- [x] Typecheck/lint 通过

## Verification Notes
`schema.ts` 的 `CREATE TABLE IF NOT EXISTS app_preference` 新增两列并同步更新了 `INSERT OR IGNORE` 种子值；`appPreferenceRepository.ts` 的 `updateAppPreference` 原先对所有字段一律做 `value ? 1 : 0` 的布尔转换，`debugExportDir` 是字符串/null 而非布尔值，因此改为按列名分派转换函数（`COLUMN_PARAM_VALUE`），避免把目录路径错误地转成 0/1。同时更新了渲染进程侧的 `DEFAULT_APP_PREFERENCE`（`src/lib/appPreferenceDefaults.ts`）保持类型一致。

用一个内存 SQLite 实例直接跑了 schema SQL 和更新逻辑验证：新种子行正确为 `debug_prompt_export=0, debug_export_dir=NULL`；`update({ debugPromptExport: true, debugExportDir: '/tmp/...' })`、`update({ debugExportDir: null })`（显式清空）、`update({ debugPromptExport: false })`（关闭开关不影响已存目录）三种场景结果均符合预期。

## Dependencies
None

## Type
backend

## Priority
high
