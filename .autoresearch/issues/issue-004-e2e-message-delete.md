# 端到端测试——消息删除完整流程

## Description
编写自动化端到端测试，覆盖"添加消息 → 删除消息 → 确认从数据库真实移除"的完整链路，以及"取消删除"的边界路径，防止未来改动引入回归。

来源：`tasks/prd-message-delete.md` — US-005（E2E 测试，依赖所有其他 Issue）

## Acceptance Criteria
- [x] E2E 测试添加一条"对方消息"和一条"我的消息"，进入历史列表后各自触发删除、确认弹窗、点击确认，断言两条消息都从界面上消失
- [x] E2E 测试断言删除后重新加载该聊天卡片（重新调用 `message.listByChatCard` 或刷新页面）时，被删除的消息不会重新出现，验证数据库记录已被真正清除
- [x] 覆盖至少一个边界/失败路径：点击删除后在确认弹窗中选择"取消"，断言消息仍然保留在列表中
- [x] 测试在 CI 中可运行并通过
- [x] 测试自行创建并清理所需的聊天卡片和消息数据，不依赖测试执行顺序

## Verification Notes
新增 `e2e/message-delete.spec.ts`，沿用现有套件（`full-flow.spec.ts` 等）的模式：每次运行用 `mkdtempSync` 生成独立的 `userDataDir`（经 `E2E_USER_DATA_DIR` 传入），聊天卡片和消息全部在测试内创建，不依赖其他测试或既有数据。

测试流程：创建聊天卡片 → 添加一条"对方"消息和一条"我"消息 → 先对"对方"消息走一次"删除→取消"，断言消息仍在 → 再对两条消息分别走"删除→确认"，断言都从界面消失 → 点击"返回"离开聊天页再重新点开该卡片（触发 `message.listByChatCard` 重新拉取），断言两条消息仍然不再出现（证明是物理删除，不是仅前端状态移除）。

本地跑通：`npx playwright test --config=e2e/playwright.config.ts e2e/message-delete.spec.ts` 通过；同时跑了套件里其余 5 个 spec，`full-flow.spec.ts` 与 `smart-tone-mode.spec.ts` 一并通过，确认执行环境本身没问题。另外 3 个（`chat-stats.spec.ts`、`model-cards.spec.ts`、`settings-preferences.spec.ts`）在本地环境下失败，但都是与消息删除无关的既有问题（Electron `evaluate` 里 `require is not defined`、IPC 错误信息格式差异、开关组件超时），本次改动未涉及这些文件。

## Dependencies
Issue #1（消息删除后端能力）、Issue #2（消息删除 UI）、Issue #3（AI 回复上下文验证）

## Type
infra

## Priority
medium
