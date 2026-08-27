# 导出每次 LLM 交互到独立文件

## Description
在 `callLlm`（`electron/main/llm/client.ts`）的所有调用方——生成回复、润色草稿、翻译消息、目标评估、自动信息提取、模型连接测试——接入导出逻辑。调试导出开关开启且目录已设置时，每次调用都生成一个独立文件；写入失败必须是静默的，绝不能影响原有功能的正常返回。

来源：`tasks/prd-llm-debug-export.md` — US-004

## Acceptance Criteria
- [x] `callLlm` 的所有调用方（生成回复、润色草稿、翻译消息、目标评估、自动信息提取、模型连接测试）在偏好开启且目录已设置时，均会触发一次导出，不遗漏任何一个功能入口
- [x] 每次交互生成一个独立文件，文件名包含时间戳和来源标识（如 `2026-08-27T143512_reply-generate.txt`），不会互相覆盖
- [x] 文件内容包含：调用时间（可读格式）、触发来源（如"生成回复"/"润色"/"翻译"/"目标评估"/"自动信息提取"/"模型连接测试"）、所用 provider 与 model 名称、完整 prompt 文本、完整响应文本
- [x] 文件内容不包含 API Key 或其他鉴权凭据
- [x] 若本次 LLM 调用最终失败（抛出异常），导出文件改为记录错误信息，而不是静默跳过导出
- [x] 偏好关闭时，不产生任何导出文件，原有 LLM 调用行为完全不变
- [x] 导出目录不存在、不可写等异常情况下，写入操作静默失败（记录到主进程日志即可），绝不能导致原本的生成回复/润色/翻译等功能报错或中断
- [x] Typecheck/lint 通过

## Verification Notes
新增 `electron/main/debugExport.ts`：`exportDebugInteraction(context, payload)` 是唯一的写文件入口，纯 fire-and-forget（内部 `fs.writeFile(...).catch(...)` 吞掉所有错误，函数本身不返回 Promise，调用方不需要也不能 await 它）。文件名格式 `{yyyyMMddTHHmmss}-{6位随机hex}_{来源}.txt`，随机后缀避免同一秒内多次调用互相覆盖。

`callLlm`（`electron/main/llm/client.ts`）新增可选第三参数 `debugExport?: DebugExportContext`，用 try/catch 包住整个调用过程：成功时导出 response，失败时（包括 `resolveModel` 阶段就抛出的错误，比如目录/模型解析失败）导出 error 信息后原样 rethrow，调用方感知到的行为和异常内容完全不变。这样只需要在这一个函数里实现一次导出逻辑，而不是在六个调用方各自重复。

六个调用方全部接入：
- `register.ts` 里的 `messageTranslate`（翻译消息）、`llmTestConnection`（模型连接测试）、`chatStatsEvaluateGoal`（目标评估）、`replyGenerate`（生成回复）、`replyPolish`（润色）——统一通过新增的 `debugExportContextFor(db, source)` 辅助函数读取当前偏好并打包成 `{ source, enabled, dir }`
- `extractInfo.ts` 的 `extractAndSaveInfo`（自动信息提取，对方信息和"我"的角色简介两条分支）——因为该函数已经持有 `db`，直接在内部读取偏好后传给 `callModel`

用真实 Electron + mock LLM server 端到端验证：开启调试导出并指向一个真实临时目录，触发一次"生成回复"，确认目录下同时出现"自动信息提取"和"生成回复"两个独立文件（证明多入口互不遗漏、互不覆盖）；读取"生成回复"文件内容，确认包含来源标签、provider/model、完整 prompt（含实际消息文本）、完整响应文本，且不包含测试用的 API Key 字符串。随后把整个导出目录物理删除、再次点击"生成回复"，确认功能本身依然正常返回候选回复——导出失败没有影响主流程。

## Dependencies
Issue #37（偏好数据新增调试导出字段）

## Type
backend

## Priority
high
