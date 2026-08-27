# PRD: Electron 打包与安装包生成

## 1. Introduction/Overview

「会聊」目前只能通过 `npm run dev` 以开发模式启动，没有可以直接安装到用户电脑上的桌面应用安装包。本功能引入 [electron-builder](https://www.electron.build/)，把已有的 Electron 应用打包成：

- **Mac**：一个通用（universal，同时支持 Intel 和 Apple Silicon）的 `.dmg` 安装包
- **Windows**：一个 x64 的 NSIS 安装向导 `.exe`

并新增一条 npm 命令，一键完成"构建前端+主进程代码 → 打包成对应平台安装包"的完整流程。打个比方：现在项目更像是"食材已经切配好，但还没装盘上桌"——`npm run dev` 只是后厨试吃用的，普通用户没法直接"点外卖"。这个功能就是加一道"打包装盘"的工序，让开发者能产出一个双击就能安装、图标和名字都对的正式应用安装包。

## 2. Goals

- 新增 `npm run dist`（或等效命令）一键生成当前平台的安装包
- 支持在 Mac 上构建 Mac universal 版安装包（.dmg）
- 支持构建 Windows x64 版安装包（NSIS .exe）
- 正确处理 `better-sqlite3` 原生模块在不同平台/架构下的编译与打包（不能直接把开发机上编译好的 `.node` 文件塞进另一个平台的安装包里）
- 打包产物包含正确的应用名称、版本号，并预留图标文件位（图标由用户后续提供）
- 打包流程和产物目录不污染现有的 git 仓库（构建产物需被 gitignore）

## 3. User Stories

### US-001: 安装并配置 electron-builder 基础依赖
**Description:** As a developer, I want electron-builder added to the project with a base configuration so that the packaging tool is ready to be wired into build scripts.

**Acceptance Criteria:**
- [ ] `electron-builder` 作为 devDependency 安装（版本与现有 Electron 43 兼容）
- [ ] 新增 `electron-builder.yml`（或 `package.json` 内的 `build` 字段，二选一，采用独立配置文件 `electron-builder.yml`）作为打包配置文件
- [ ] 配置中指定 `appId`（如 `com.huichat.app`）、`productName`（"会聊"）、输出目录为 `release/`（复用已有 `.gitignore` 中的 `release` 忽略规则）
- [ ] 配置中指定 `files` 字段，只打包 `dist/`、`dist-electron/`、`package.json` 等运行所需文件，排除源码、`e2e/`、`tasks/` 等开发目录
- [ ] Typecheck/lint 通过

### US-002: 处理 better-sqlite3 原生模块的多平台打包
**Description:** As a developer, I want native module rebuilding correctly configured so that the packaged app's SQLite binding matches the target platform/architecture instead of the dev machine's.

**Acceptance Criteria:**
- [ ] 配置 electron-builder 的 `npmRebuild` / `nodeGypRebuild` 或显式在打包脚本中调用 `electron-rebuild`，确保针对目标平台+架构重新编译 `better-sqlite3`
- [ ] Mac universal 构建时，`better-sqlite3` 的 x64 与 arm64 两份原生二进制都被正确合并进产物（electron-builder universal 模式下原生模块需要分别为两个架构编译后合并）
- [ ] 明确记录/校验：在 macOS 主机上无法直接交叉编译出可用的 Windows 原生二进制，因此 Windows 安装包必须在 Windows 主机（或等效的跨平台构建环境）上执行打包命令生成，README 或脚本注释中说明这一限制
- [ ] 在目标平台上执行打包后，安装并启动生成的应用，确认数据库读写功能（如新建对话、发送消息）正常，无 `better-sqlite3` 相关的原生模块加载报错
- [ ] Typecheck/lint 通过

### US-003: 新增一键生成安装包的 npm 命令
**Description:** As a developer, I want a single npm command that builds the app and produces the platform installer so that I don't have to remember multiple manual steps.

**Acceptance Criteria:**
- [ ] `package.json` 新增 `"dist": "npm run build && electron-builder"` 脚本（当前平台自动匹配，Mac 主机产出 dmg，Windows 主机产出 nsis exe）
- [ ] 额外新增 `"dist:mac": "npm run build && electron-builder --mac --universal"` 与 `"dist:win": "npm run build && electron-builder --win --x64"`，便于显式指定目标平台
- [ ] 命令执行成功后，`release/` 目录下生成对应平台的安装包文件（`.dmg` 或 `.exe`），文件名包含应用名与版本号
- [ ] 命令失败时（如原生模块编译失败）能在终端看到明确的报错信息，而不是静默失败
- [ ] Typecheck/lint 通过

### US-004: 应用图标接入
**Description:** As a developer, I want the packaging config to reference icon files so that once the user supplies real icon assets, the installer and app automatically use the correct branding without further config changes.

**Acceptance Criteria:**
- [ ] 新增 `build/` 资源目录（electron-builder 约定目录），用于存放 `icon.icns`（Mac）与 `icon.ico`（Windows）
- [ ] `electron-builder.yml` 中正确引用上述图标路径（`mac.icon` / `win.icon`）
- [ ] 图标文件缺失时，打包命令仍能成功执行（electron-builder 会回退到默认图标），不会因为图标缺失而报错中断
- [ ] 待用户提供正式图标文件后，替换 `build/` 目录下对应文件即可生效，无需改动配置代码
- [ ] Typecheck/lint 通过

### US-005: 打包产物目录纳入忽略规则与文档说明
**Description:** As a developer, I want the packaging output excluded from git and documented so that the repo stays clean and teammates know how to produce installers.

**Acceptance Criteria:**
- [ ] 确认 `.gitignore` 中已包含打包输出目录（复用现有 `release` 条目，若实际输出目录不同则补充对应条目）
- [ ] 在项目说明文档（如 README 或 `tasks/` 下相关文档）中新增"如何生成安装包"的简要说明，包含 `npm run dist:mac`、`npm run dist:win` 的用途与平台限制（Windows 安装包需在 Windows 环境构建）
- [ ] Typecheck/lint 通过

### US-006: 端到端验证打包与安装流程
**Description:** As a QA engineer, I want an automated/documented end-to-end verification of the packaging flow so that we catch regressions in the build pipeline itself.

**Acceptance Criteria:**
- [ ] 在 Mac 环境下执行 `npm run dist:mac`，验证命令以退出码 0 结束，且 `release/` 下生成非空的 `.dmg` 文件
- [ ] 挂载生成的 `.dmg`，将应用拖入 Applications（或直接从挂载卷启动），确认应用能正常启动，主界面正常渲染，且核心功能（发送一条消息、写入本地数据库）工作正常
- [ ] 覆盖一个关键失败路径：故意在 `electron-builder.yml` 中指向一个不存在的入口文件（如错误的 `main` 路径），验证 `npm run dist:mac` 会以非 0 退出码失败并输出可读的错误信息，而不是生成一个损坏的安装包
- [ ] 由于 Windows 安装包无法在 Mac CI/环境中真正验证运行，该用例可作为"文档化的手动验证步骤"记录在 US-005 的文档中，而非强制自动化 CI 用例（标注为 `[Assumption]`：团队暂无 Windows CI runner）
- [ ] 测试步骤可重复执行，执行后清理 `release/` 目录下生成的临时产物

## 4. Functional Requirements

- FR-1: 系统必须新增 `electron-builder` 作为开发依赖，版本与当前 Electron 43 / Node >=22.12 兼容。
- FR-2: 系统必须提供独立的 `electron-builder.yml` 配置文件，定义 `appId`、`productName`、输出目录（`release/`）、打包文件范围（`files`）。
- FR-3: 系统必须在打包时针对目标平台/架构重新编译 `better-sqlite3` 原生模块，确保产物中的二进制与运行环境匹配。
- FR-4: 系统必须支持通过 `electron-builder --mac --universal` 生成同时支持 x64 与 arm64 的 Mac universal `.dmg` 安装包。
- FR-5: 系统必须支持通过 `electron-builder --win --x64` 生成 Windows x64 的 NSIS 安装向导 `.exe`。
- FR-6: 系统必须新增 npm 脚本 `dist`、`dist:mac`、`dist:win`，且执行前自动触发 `npm run build` 完成前端与主进程代码编译。
- FR-7: 系统必须预留 `build/icon.icns` 与 `build/icon.ico` 图标文件位，并在配置中正确引用，图标缺失时不阻断打包流程。
- FR-8: 系统必须确保打包输出目录被 `.gitignore` 忽略，不产生额外的仓库体积膨胀。
- FR-9: 系统必须在打包失败时（原生模块编译失败、入口文件缺失等）以非 0 退出码终止，并输出可定位问题的错误日志。

## 5. Non-Goals (Out of Scope)

- 不包含代码签名（code signing）与 Apple 公证（notarization）——本期不签名，安装包在其他电脑首次打开会被系统安全机制拦截，需用户手动允许，这是已知的临时限制
- 不包含自动更新（auto-update / Squirrel）机制
- 不包含 Linux 平台打包（.AppImage / .deb 等）
- 不包含 Windows arm64 架构支持
- 不包含 CI/CD 自动化发布流程（如 GitHub Actions 自动构建并发布 Release），本期仅要求本地一键命令可用
- 不包含图标素材本身的设计与制作，仅预留配置位置

## 6. Design Considerations (Optional)

- 无 UI 变更，纯构建工具链改动
- 图标资源命名遵循 electron-builder 约定：`build/icon.icns`（Mac）、`build/icon.ico`（Windows），待用户提供后直接放入对应路径即可生效

## 7. Technical Considerations

- **原生模块跨平台编译**：`better-sqlite3` 是原生 Node 模块，无法简单地把一个平台编译出的 `.node` 文件复制到另一个平台使用。electron-builder 的 `npmRebuild` 选项配合 `@electron/rebuild`（项目已有此依赖，见 `postinstall` 脚本）可以针对目标 Electron 版本重新编译，但**跨平台交叉编译（如在 Mac 上编译出 Windows 二进制）通常不可靠**，因此：
  - Mac universal 包需要在 Mac 主机上执行，且需要分别为 x64、arm64 编译后合并（electron-builder 在 `--universal` 模式下会自动处理，但需确认 `better-sqlite3` 的 prebuild 是否提供 arm64 版本，若无则需要本地编译环境支持 arm64 交叉编译）
  - Windows 安装包必须在 Windows 主机上执行打包命令生成，这是本 PRD 明确记录的限制，不在本期解决"从 Mac 打出可用 Windows 包"的问题
- **构建产物体积**：`node_modules` 中会包含 `@earendil-works/pi-ai` 等依赖及其间接依赖（例如各厂商 SDK），需要确认 `files` 配置是否需要做 `asarUnpack` 处理原生模块（`better-sqlite3` 的 `.node` 文件必须排除在 asar 打包之外，因为 Node 无法直接从 asar 归档中加载原生扩展）——这是打包时的一个已知坑，需要在 `electron-builder.yml` 中配置 `asarUnpack: ["**/*.node"]` 或针对 `better-sqlite3` 目录单独处理
- 复用现有 `postinstall` 中的 `@electron/rebuild` 依赖，避免重复引入原生模块编译工具链

## 8. Success Metrics

- 在 Mac 上执行 `npm run dist:mac` 能在 5 分钟内（不含依赖安装时间）生成可安装、可正常启动、数据库读写正常的 `.dmg`
- 在 Windows 上执行 `npm run dist:win` 能生成可安装、可正常启动、数据库读写正常的安装向导 `.exe`
- 打包失败时开发者能在 1 分钟内从错误日志定位到失败原因（原生模块 / 入口文件 / 配置错误等）

## 9. Open Questions

- Windows 平台打包目前只能在 Windows 主机上验证 — 团队是否需要额外准备一台 Windows 测试机或虚拟机来完成 US-006 中的手动验证步骤？`[Assumption]` 暂定为手动验证，待团队确认是否需要引入 Windows CI。
- `better-sqlite3` 在 Apple Silicon（arm64）上是否有官方 prebuilt 二进制，还是需要本地从源码编译？若需要源码编译，构建机需要预装 Xcode Command Line Tools，这一环境依赖是否需要写入文档？
