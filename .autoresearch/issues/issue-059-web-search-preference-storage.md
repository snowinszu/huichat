# 联网搜索设置项的存储与迁移

## Description
在 `app_preference` 单例表新增 `web_search_enabled`/`web_search_api_key` 两个字段，跟随现有 `debugPromptExport`/`debugExportDir`、锁屏密码那批字段的双轨模式：`schema.ts` 的 `CREATE TABLE IF NOT EXISTS` 里加列 + `migrations.ts` 新增一个 `ALTER TABLE ADD COLUMN` 迁移函数兼容已存在的旧安装库。这是后续所有联网搜索相关 Issue 的存储基础，复用现有 `app-preference:get`/`app-preference:update` IPC channel，不新增 channel。

## Acceptance Criteria
- [ ] `app_preference` 表（`electron/main/db/schema.ts`）新增 `web_search_enabled INTEGER NOT NULL DEFAULT 0` 与 `web_search_api_key TEXT` 两列，种子 `INSERT OR IGNORE` 同步更新
- [ ] 新增迁移函数（仿照 `migrateAppPreferenceDebugExportColumns`，见 `electron/main/db/migrations.ts`）为已存在的 `app_preference` 表补上这两列，并在 `electron/main/db/index.ts` 的初始化序列中调用
- [ ] `AppPreferenceRecord` / `UpdateAppPreferenceInput`（`electron/shared/ipc-types.ts`）新增 `webSearchEnabled: boolean`、`webSearchApiKey: string | null`
- [ ] `appPreferenceRepository.ts` 的 `toRecord`/`UPDATABLE_COLUMNS`/`COLUMN_PARAM_VALUE` 三处按现有模式补上新字段（`webSearchApiKey` 走字符串直传，不能套用布尔的 `? 1 : 0` 转换）
- [ ] `DEFAULT_APP_PREFERENCE`（`src/lib/appPreferenceDefaults.ts`）补上 `webSearchEnabled: false`、`webSearchApiKey: null`
- [ ] Typecheck/lint passes

## Dependencies
None

## Type
backend

## Priority
high

## Source
tasks/prd-web-search-reply.md — US-001
