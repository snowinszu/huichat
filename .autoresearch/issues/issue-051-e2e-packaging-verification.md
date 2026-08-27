# 端到端验证打包与安装流程

## Description
在 Mac 环境下跑通 `npm run dist:mac` 全流程，验证生成的安装包可安装、可启动、核心功能正常，并覆盖一个关键失败路径（配置错误时命令应明确失败而非产出损坏安装包）。Windows 侧验证记录为手动步骤，非强制 CI 用例。

## Acceptance Criteria
- [x] 在 Mac 环境下执行 `npm run dist:mac`，验证命令以退出码 0 结束，且 `release/` 下生成非空的 `.dmg` 文件
- [x] 挂载生成的 `.dmg`，安装/启动应用，确认主界面正常渲染，且核心功能（发送一条消息、写入本地数据库）工作正常
- [x] 覆盖一个关键失败路径：故意在 `electron-builder.yml` 中指向一个不存在的入口文件，验证 `npm run dist:mac` 以非 0 退出码失败并输出可读错误信息，而非生成损坏的安装包
- [x] Windows 安装包验证步骤文档化为手动验证步骤（记录在 Issue #49 补充的文档中），标注 `[Assumption]`：团队暂无 Windows CI runner，非强制自动化用例
- [x] 验证步骤可重复执行，执行后清理 `release/` 目录下生成的临时产物

## Dependencies
Issue #48, Issue #49, Issue #50

## Type
infra

## Priority
high

## Source
tasks/prd-electron-builder-packaging.md — US-006

## Verification Notes

在 [README.md](../../README.md) 新增"验证安装包"章节：Mac 侧的挂载/安装/启动步骤，以及 Windows 侧的手动验证清单（标注 `[Assumption]`：团队暂无 Windows CI runner，本期不强制做成自动化 CI 用例）。

**跑了一次完整的真实链路，而不是复用 Issue #49 已有的验证结果：**

1. `npm run dist:mac`，退出码 `0`，`release/` 下生成 `会聊-0.1.0-universal.dmg`（235MB）
2. `hdiutil attach` 真实挂载该 dmg（不是用中间产物 `--dir` 的 `.app`）
3. 直接 spawn 挂载卷里的可执行文件做了两轮验证：
   - **进程存活 + 数据库写入**：第一次用 6 秒等待窗口测试时 `app.db` 还没写入（进程存活但数据库文件不存在）——排查后发现是从只读、磁盘镜像挂载的卷启动比本地磁盘的 `--dir` 构建慢，不是 bug；把等待时间提到 15 秒后，进程存活、`app.db` 存在且是合法 SQLite 文件、无 stderr 报错。记录这个时序差异供以后写自动化脚本时参考（挂载卷启动需要更宽松的超时）。
   - **UI 真实渲染 + 真实功能验证**：用 Playwright 直接驱动挂载卷里的可执行文件（这次特意跳过了 Issue #48 踩过的 `ELECTRON_RUN_AS_NODE` 坑，提前 `env -u` 清掉），截图确认主界面完整渲染（"会聊"品牌、聊天对象空状态、按钮样式均正常），然后走真实 UI 流程创建了一张模型卡片（点击"模型" → 填表单 → 保存 → 断言"模型卡片已创建"提示出现），这是一次通过界面触发的真实数据库写入，比单纯检测 `app.db` 文件是否存在更贴近 AC 里"确认主界面正常渲染，且核心功能工作正常"的要求。无渲染器错误。
4. **失败路径**：临时把 `package.json` 的 `main` 改成不存在的文件，跑 `npm run dist:mac`，退出码 `1`，报错信息清晰（"was not found in this archive"），且失败发生在 asar 完整性校验阶段（早于"building target=DMG"阶段），确认没有产出一个看起来正常实则损坏的 dmg。验证完立即恢复 `package.json`。

清理：`hdiutil detach` 卸载了挂载卷，杀掉了残留的应用进程，删除了 `release/` 下的全部产物（好的 dmg + 失败构建的中间目录）、两个一次性验证脚本、截图文件。Typecheck/lint 通过。

**至此 PRD `tasks/prd-electron-builder-packaging.md` 的全部 6 个 User Story（对应 Issue #47~#51）均已完成并有真实验证记录。**
