# 锁屏密码后端能力：设置/验证/清除密码哈希

## Description
在 Electron 主进程新增锁屏密码的持久化与校验能力：设置密码（哈希存储）、验证密码、清除密码、查询锁屏是否已开启。复用现有 `AppPreferenceRecord` / IPC 模式（参考 `electron/shared/ipc-types.ts` 与 `SettingsScreen.tsx` 中 `window.api.appPreference` 的调用方式）新增锁屏相关字段和 IPC 方法。密码哈希使用 Node 内置 `crypto`（scrypt/pbkdf2 + salt），不引入新依赖，且哈希、比对逻辑只在主进程完成，渲染进程不持有密码明文的存储逻辑。

## Acceptance Criteria
- [x] 新增 IPC 方法：设置密码（生成 salt + 哈希后持久化）、验证密码（比对哈希）、清除密码（关闭锁屏时调用）、查询锁屏是否已开启
- [x] 密码使用 scrypt 或 pbkdf2 + 随机 salt 哈希后存储，本地存储中不出现密码明文
- [x] 设置密码时校验长度为 4-20 位，不满足时 IPC 返回明确错误，不写入存储
- [x] 重启应用后已设置的密码哈希与锁屏开关状态仍然有效（持久化到本地数据库/偏好文件）
- [x] Typecheck/lint passes

## Dependencies
None

## Type
backend

## Priority
high

## Source
tasks/prd-app-lock-screen.md — US-001, US-002（后端部分）

## Verification Notes

新增 `electron/main/db/appLockRepository.ts`：`getAppLockStatus`（`lock_password_hash` 是否非空）、`setAppLockPassword`（每次生成新 16 字节随机 salt，scrypt 派生 64 字节密钥，十六进制存储）、`verifyAppLockPassword`（`crypto.timingSafeEqual` 比对，长度不一致时直接返回 false 而不是抛错）、`clearAppLockPassword`。

密码哈希/盐值复用 `app_preference` 单例表的两个新列 `lock_password_hash`/`lock_password_salt`，跟随现有 `debugPromptExport`/`historySummary` 那批列一样，走 schema.ts 新增列 + `migrations.ts` 新增 `migrateAppPreferenceLockColumns`（`ALTER TABLE ADD COLUMN`，对已存在的旧安装库做兼容）的双轨做法，在 `db/index.ts` 里注册。

IPC 层新增 4 个 channel（`app-lock:get-status`/`set-password`/`verify-password`/`clear-password`），密码长度校验（4-20 位）放在 `register.ts` 的 handler 里而不是 repository，与"关闭锁屏需要先验证当前密码"（`clearAppLockPassword` 前调用 `verifyAppLockPassword`，不对则抛 `密码错误`）保持在同一层。`preload/index.ts` 新增 `window.api.appLock` 命名空间暴露这 4 个方法。

Typecheck/lint 通过。这一项是纯后端能力，UI 验证随 Issue #53 一起做的。
