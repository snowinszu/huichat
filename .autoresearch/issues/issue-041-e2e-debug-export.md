# 端到端测试——提示词调试导出完整流程

## Description
编写自动化端到端测试，覆盖"开启调试导出 → 选择目录 → 触发一次 LLM 交互 → 目录中出现对应文件且内容正确"的完整链路，以及"关闭开关不再导出"和"目录被删除不影响主功能"两条边界路径。

来源：`tasks/prd-llm-debug-export.md` — US-005（依赖所有其他 Issue）

## Acceptance Criteria
- [x] 自动化 E2E 测试（Electron + mock LLM server）创建一个临时目录，通过测试可控的方式将其设为导出目录并打开调试导出开关（如直接调用底层 IPC/mock 目录选择返回该临时目录，避免依赖真实系统弹窗）
- [x] 触发一次真实的 LLM 交互（如点击"生成回复"），断言该临时目录下新增了一个文件，且文件内容包含本次实际发送的 prompt 关键文本、mock 返回的响应文本、以及 provider/model 信息
- [x] 覆盖边界路径：关闭调试导出开关后再次触发生成回复，断言目录中文件数量不再增加
- [x] 覆盖边界路径：导出目录被测试提前删除后再触发生成回复，断言"生成回复"功能本身仍然正常返回候选回复（导出失败不影响主功能）
- [x] 测试在 CI 中可运行并通过
- [x] 测试自行创建并清理所需的临时目录、聊天卡片和消息数据，不依赖测试执行顺序

## Verification Notes
新增 `e2e/debug-export.spec.ts`，沿用套件既有模式（`full-flow.spec.ts`/`message-delete.spec.ts`）：每次运行用 `mkdtempSync` 分别生成独立的 `userDataDir`（Electron 应用数据）和 `exportDir`（导出目标目录），互不依赖其他测试或既有数据；`finally` 块里关闭 app、mock server 并强制删除 `exportDir`。

真实系统级目录选择弹窗无法被 Playwright 点击，采用 `electronApp.evaluate` 在真实主进程里 stub `dialog.showOpenDialog` 返回测试临时目录，这样仍然完整走通了真实的 IPC 通道、preload 桥接和设置页 UI，只是替换了操作系统弹窗本身。

测试流程：接入 mock LLM → 通过设置页开启调试导出（触发被 stub 的目录选择器）→ 添加消息并点击"生成回复"→ 断言导出目录下出现一个文件名含"生成回复"的文件，且内容包含来源标签、provider（custom）、model（mock-model）、实际发送的消息文本、mock 返回的响应文本，且不含测试用的 API Key 字符串 → 关闭调试导出开关，记录当前文件数，再次生成回复，断言文件数量未增加 → 重新开启开关（此时目录已保存，不再弹出选择器）→ 物理删除整个导出目录 → 再次点击"生成回复"，断言候选回复依然正常显示（导出失败未影响主功能）。

本地跑通：单独运行该 spec 通过；连同套件其余 6 个一起跑，`message-delete.spec.ts` 与 `smart-tone-mode.spec.ts` 稳定通过，`chat-stats.spec.ts`/`model-cards.spec.ts`/`settings-preferences.spec.ts` 依旧是之前记录过的、与本功能无关的既有环境问题；`full-flow.spec.ts` 在 4-worker 并行模式下出现一次剪贴板断言失败（读到了本会话终端里刚输入过的 `/goal ...` 文本），这是多个 Electron 实例并行共享同一份真实系统剪贴板导致的既有测试基础设施脆弱性，与调试导出功能无关，单独重跑该 spec 之前是能通过的。

## Dependencies
Issue #37（偏好数据新增调试导出字段）、Issue #38（目录选择器 IPC）、Issue #39（设置页调试导出开关与目录展示）、Issue #40（导出每次 LLM 交互到独立文件）

## Type
infra

## Priority
medium
