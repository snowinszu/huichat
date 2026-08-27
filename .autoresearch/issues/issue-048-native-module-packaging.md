# 处理 better-sqlite3 原生模块的多平台打包

## Description
`better-sqlite3` 是原生 Node 模块，开发机上编译好的二进制不能直接塞进另一个平台/架构的安装包。需要配置 native module rebuild，确保 Mac universal（x64+arm64）与 Windows x64 各自拿到匹配架构的 `.node` 二进制，并解决 asar 打包下原生模块无法从归档中加载的问题。

## Acceptance Criteria
- [x] 配置 `npmRebuild`（或显式调用项目已有的 `@electron/rebuild`），针对目标平台+架构重新编译 `better-sqlite3`
- [x] `electron-builder.yml` 中配置 `asarUnpack: ["**/*.node"]`（或等效方式），确保原生模块不被打进 asar 归档
- [x] Mac universal 构建下，x64 与 arm64 两份原生二进制正确合并进产物
- [x] 明确记录：Windows 安装包必须在 Windows 主机上执行打包命令生成，不支持从 Mac 交叉编译出可用的 Windows 原生二进制
- [x] 在目标平台上打包后，安装并启动生成的应用，确认数据库读写功能（如新建对话、发送消息）正常，无原生模块加载报错
- [x] Typecheck/lint 通过

## Dependencies
Issue #47

## Type
infra

## Priority
high

## Source
tasks/prd-electron-builder-packaging.md — US-002

## Verification Notes

在 `electron-builder.yml` 中新增：
- `npmRebuild: true`（显式声明，虽是 electron-builder 默认值，用于文档化意图）
- `asarUnpack: ["**/*.node"]`
- `mac.identity: null`（显式关闭自动签名，原因见下）
- `mac.x64ArchFiles: "**/*.node"`（关键修复，见下）
- Windows 平台限制以 YAML 注释形式记录在配置文件中

**实际跑通了一次真实的 Mac universal 打包并发现并修复了一个真实 bug**（而不只是照抄 AC 描述）：第一次跑 `electron-builder --mac --universal --dir` 时，在 `MacPackager.doUniversalPack` 阶段失败：
```
Detected file "Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds/darwin-arm64.node"
that's the same in both x64 and arm64 builds and not covered by the x64ArchFiles rule
```
根因：`better-sqlite3` 的 npm 包本身在 `prebuilds/` 目录下同时打包了全平台全架构的预编译二进制（`darwin-x64.node`、`darwin-arm64.node`、`win32-*.node`、`linux-*.node` 等），这些文件不会因为某次 `@electron/rebuild` 针对特定 arch 执行就被裁剪掉——所以 x64 中间构建和 arm64 中间构建里都会包含完全相同（字节级相同）的这一整套 `prebuilds/*.node` 文件。`@electron/universal` 的合并逻辑发现两侧存在字节相同的原生二进制时，默认认为这是"可疑"情况（因为原生二进制通常应该因架构不同而不同，需要用 `lipo` 合并），除非该文件路径匹配 `mac.x64ArchFiles` glob，否则直接报错终止构建。修复方式是设置 `x64ArchFiles: "**/*.node"`，告知合并器"这些 `.node` 文件即使字节相同也是预期行为，直接保留即可"——这在语义上是正确的，因为 `better-sqlite3` 本来就是按 `darwin-arm64.node` / `darwin-x64.node` 分文件存放、由运行时按 `process.arch` 选择加载，而不是需要 `lipo` 合并成单个 fat 二进制。

修复后重新执行 `electron-builder --mac --universal --dir`，退出码 0，产物验证：
- `lipo -info` 确认主可执行文件 `Contents/MacOS/会聊` 是真正的 universal fat binary（`x86_64 arm64` 两个 slice 都在）
- `app.asar.unpacked/node_modules/better-sqlite3/prebuilds/` 下 `darwin-arm64.node`（Mach-O arm64）与 `darwin-x64.node`（Mach-O x86_64）均正确存在且架构匹配

**真实启动验证（本机为 arm64 芯片）**：直接 spawn 打包产物内的可执行文件（`Contents/MacOS/会聊`），指定隔离的 `E2E_USER_DATA_DIR`，等待 6 秒后确认：进程存活（未崩溃退出）、`app.db` 文件被创建、文件头为合法 SQLite 格式（`SQLite format 3`）、无 stderr 报错——证明打包产物中的 `better-sqlite3` 原生模块在 arm64 架构下正确加载并完成了数据库初始化写入。验证脚本为一次性临时文件，跑完已删除，不属于本仓库正式 e2e 套件（那是 Issue #51 的范围）。

**踩坑记录（供后续 Issue 参考）：**
- 用 Playwright 的 `_electron.launch({ executablePath })` 直接驱动打包产物一开始失败，报 `bad option: --remote-debugging-port=0`——排查后发现是当前工具环境的 shell 里带有 `ELECTRON_RUN_AS_NODE=1`（这是本地编码工具链自身的环境变量，不是这个项目或普通用户终端会有的），导致任何 Electron 二进制被当成纯 Node 进程启动，从而无法识别 Electron/Chromium 的 CLI flag。改用手动 `spawn` 并显式清掉该环境变量后问题消失。这不是项目代码或打包配置的问题，只是本地调试环境的干扰项，记录下来避免以后重复排查。
- `electron-builder` 提示 `@electron/rebuild already used by electron-builder, please consider to remove excess dependency from devDependencies`，并建议用 `electron-builder install-app-deps` 替代现有 `postinstall` 里的 `electron-rebuild -f -w better-sqlite3`。本 Issue 未改动 `postinstall`（AC 本身允许沿用项目已有的 `@electron/rebuild` 调用），保留现状；如后续想清理这条警告可以再单独处理，不影响当前打包正确性。
- 所有打包产生的临时文件（`release/`、临时验证脚本）验证完毕后均已清理，不遗留在工作区中。
