# PRD: GitHub Actions 自动构建与发布（Windows + Mac）

## 1. Introduction/Overview

在 [prd-electron-builder-packaging.md](prd-electron-builder-packaging.md) 中，「会聊」已经具备了本地一键打包能力（`npm run dist:mac` / `npm run dist:win`），但那份 PRD 明确把"CI/CD 自动化发布流程"列为不做的事，并留下一个悬而未决的问题：**Windows 安装包只能在 Windows 主机上打出来，团队并没有 Windows 测试机**。

这次要解决的就是这个问题。打个比方：现在的状态像是"厨房只有一口铁锅"——做中餐（Mac 包）没问题，但做西餐（Windows 包）需要另一口锅，团队厨房里没有。GitHub Actions 相当于"云端共享厨房"：只要把菜谱（构建脚本）交给它，它就能同时借到一口 Mac 灶台和一口 Windows 灶台，两道菜同时开火，做完直接打包送到"取餐柜"（GitHub Release）里，任何人凭链接就能取货，不再依赖开发者手头有没有对应的电脑。

具体做法：在仓库（`https://github.com/snowinszu/huichat`）里新增 GitHub Actions workflow。日常 push 到 `main` 分支时只做"快速安检"（typecheck + lint），确保代码没有明显问题；当开发者推送一个形如 `v1.0.0` 的版本 tag 时，才真正触发"开火做菜"——在 macOS 和 Windows 两台云端机器上并行构建安装包，全部成功后自动创建一个 GitHub Release，把 `.dmg` 和 Windows 安装包挂上去。

## 2. Goals

- push 到 `main` 分支（含 PR）时自动跑 typecheck + lint，快速发现代码问题
- 推送 `v*` 格式的 tag 时，自动在 macOS 和 Windows 云端 runner 上并行构建安装包，无需本地拥有对应平台的电脑
- 构建产物自动发布为 GitHub Release，附带 `.dmg`（Mac universal）与 Windows x64 安装包
- 打包前的质量检查（typecheck/lint）失败时，必须阻止后续打包与发布，不产出"带病"的安装包
- 复用现有 `electron-builder.yml` 配置（不签名、`asarUnpack` 处理原生模块等），CI 只负责调度，不重复定义打包逻辑
- 补齐本地目录与 GitHub 远程仓库的关联，让 workflow 具备可运行的前提条件

## 3. User Stories

### US-001: 初始化本地 Git 仓库并关联 GitHub 远程
**Description:** As a developer, I want the local project connected to `https://github.com/snowinszu/huichat` so that pushes and tags can actually trigger GitHub Actions.

**Acceptance Criteria:**
- [ ] 本地目录完成 `git init`，`git remote -v` 显示 `origin` 指向 `https://github.com/snowinszu/huichat`
- [ ] `.gitignore` 已覆盖 `node_modules`、`dist`、`dist-electron`、`release` 等构建产物目录（复用现有配置，无需新增）
- [ ] 首次提交推送到远程 `main` 分支成功，GitHub 仓库页面能看到完整源码
- [ ] Typecheck/lint 通过

### US-002: 新增 push/PR 质量检查 workflow
**Description:** As a developer, I want every push to `main` (and every PR targeting `main`) to automatically run typecheck and lint so that obvious mistakes are caught before merging.

**Acceptance Criteria:**
- [ ] 新增 `.github/workflows/ci.yml`，触发条件为 `push` 到 `main` 分支与 `pull_request` 目标为 `main` 分支
- [ ] Workflow 使用 `.nvmrc` 中指定的 Node 版本（22.20.0）
- [ ] 依赖安装使用 `npm ci --ignore-scripts`（跳过 `postinstall` 的原生模块编译，因为 typecheck/lint 不需要可运行的 `better-sqlite3` 二进制，且 Linux runner 未配置原生编译工具链）
- [ ] 依次执行 `npm run typecheck` 与 `npm run lint`，任一失败则整个 workflow 标记为失败
- [ ] 在 GitHub 仓库的 Actions 页面能看到该 workflow 的运行记录与结果状态

### US-003: 新增 tag 触发的跨平台构建 workflow
**Description:** As a developer, I want pushing a version tag to automatically build both macOS and Windows installers in parallel on GitHub's cloud runners so that I don't need a physical Windows machine.

**Acceptance Criteria:**
- [ ] 新增 `.github/workflows/release.yml`，触发条件为推送匹配 `v*.*.*` 格式的 tag（如 `v1.0.0`、`v1.0.0-rc1`）
- [ ] Workflow 第一个 job 为 `verify`：在 `ubuntu-latest` 上执行与 US-002 相同的 typecheck + lint 检查
- [ ] 第二个 job 为 `build`，声明 `needs: verify`，`verify` 失败时 `build` 不会启动
- [ ] `build` job 使用矩阵（matrix）策略同时在 `macos-latest` 与 `windows-latest` 上运行，两者并行执行、互不阻塞
- [ ] macOS runner 上执行 `npm ci`（完整安装，含 `postinstall` 原生模块编译）后运行 `npm run dist:mac`，产出 `release/*.dmg`
- [ ] Windows runner 上执行 `npm ci` 后运行 `npm run dist:win`，产出 `release/*.exe`
- [ ] 任一平台构建失败时，该 workflow run 整体标记为失败，且失败日志可在 Actions 页面直接查看（不静默失败）

### US-004: 自动创建 GitHub Release 并附加安装包
**Description:** As a user of this project, I want a GitHub Release automatically created with the version's installers attached so that I can download a ready-to-run app without asking the developer to build it manually.

**Acceptance Criteria:**
- [ ] `build` job 成功后，自动创建（或更新，若同名 Release 已存在）一个 GitHub Release，`tag_name` 与 `release name` 等于推送的 tag（如 `v1.0.0`）
- [ ] Release 中附加两个资产文件：macOS 的 `.dmg` 与 Windows 的安装向导 `.exe`
- [ ] tag 名称包含 `-`（如 `v1.0.0-rc1`）时，Release 自动标记为 "pre-release"；不含 `-` 的正式版本号（如 `v1.0.0`）标记为正式 Release
- [ ] Release 说明使用 GitHub 默认的基于提交记录自动生成的 Release Notes
- [ ] 在 GitHub 仓库的 Releases 页面能看到新发布的 Release，两个安装包均可点击直接下载

### US-005: 端到端验证完整的 tag → 构建 → 发布 流程
**Description:** As a QA engineer/maintainer, I want to verify the complete pipeline end-to-end so that we're confident pushing a real release tag will always produce a working, downloadable Release.

**Acceptance Criteria:**
- [ ] 推送一个真实的测试 tag（如 `v0.1.0-rc1`）到远程仓库，触发 `release.yml`
- [ ] 在 GitHub Actions 页面确认 `verify`、`build (macos-latest)`、`build (windows-latest)` 三个 job 均以成功状态结束
- [ ] 在 GitHub Releases 页面确认生成了对应 tag 的 Release，且标记为 pre-release（因 tag 含 `-rc1`），并附带 `.dmg` 与 `.exe` 两个文件，文件大小均非 0
- [ ] 覆盖一个关键失败路径：故意在测试分支中引入一个 lint 错误后推送同格式的测试 tag，确认 `verify` job 失败、`build` job 被跳过（未执行）、且没有产生新的 Release
- [ ] 测试完成后清理产物：删除测试 tag（本地与远程）及对应的测试 Release，不在正式 Release 列表中留下垃圾数据
- [ ] Workflow 运行记录（成功与失败两种）均可在 Actions 页面复现查看，作为该 CI/CD 流程本身可回归验证的凭证

## 4. Functional Requirements

- FR-1: 系统必须在 `push` 到 `main` 分支和 `pull_request` 目标为 `main` 分支时，自动运行 `npm run typecheck`。
- FR-2: 系统必须在同一触发条件下运行 `npm run lint`。
- FR-3: 系统必须在推送匹配 `v*.*.*` 格式的 tag 时触发独立的 release workflow。
- FR-4: release workflow 必须在打包 job 启动前先执行 typecheck + lint 检查，检查失败时不得执行打包 job。
- FR-5: 系统必须在 `macos-latest` runner 上执行 `npm run dist:mac`，产出 Mac universal `.dmg` 安装包。
- FR-6: 系统必须在 `windows-latest` runner 上执行 `npm run dist:win`，产出 Windows x64 安装包。
- FR-7: macOS 与 Windows 的构建 job 必须以矩阵并行方式运行，不得串行等待。
- FR-8: 系统必须使用 `.nvmrc` 中声明的 Node 版本（22.20.0）执行所有 workflow。
- FR-9: 系统必须在 typecheck/lint-only 的 job 中跳过 `postinstall` 触发的原生模块编译（使用 `npm ci --ignore-scripts`），避免在未配置原生编译工具链的 runner 上失败。
- FR-10: 打包成功后，系统必须自动创建一个 tag 名称对应的 GitHub Release，并将生成的 `.dmg` 与 Windows 安装包作为 Release 资产上传。
- FR-11: 系统必须在 tag 名称包含预发布标识（如 `-rc`、`-beta`）时，将对应 Release 标记为 pre-release。
- FR-12: release workflow 所使用的 `GITHUB_TOKEN` 权限必须显式声明 `contents: write`，以支持创建 Release 与上传资产。

## 5. Non-Goals (Out of Scope)

- 不包含代码签名与 macOS 公证（notarization）——沿用 `electron-builder.yml` 现有的 `identity: null` 配置，产出未签名安装包，用户首次打开需手动允许（macOS Gatekeeper / Windows SmartScreen 会有安全提示，这是已知且接受的限制）
- 不包含自动版本号递增——`package.json` 中的 `version` 与 tag 号需要开发者手动保持一致，本期不做自动校验或自动 bump
- 不包含 Linux 构建目标
- 不包含 Playwright e2e 测试接入 CI 流程（现有 `e2e/` 测试保持仅本地/手动运行）
- 不包含自定义 Release Notes / CHANGELOG 生成，使用 GitHub 默认的基于提交生成的说明
- 不包含自动更新（auto-update）机制的接入，Release 只负责提供可下载的安装包
- 不包含对已存在的旧 Release 进行批量补建或迁移

## 6. Design Considerations (Optional)

无 UI 变更，纯 CI/CD 工具链改动。

## 7. Technical Considerations

- **仓库当前尚未初始化 git**：本地目录还不是 git 仓库，也未关联 `https://github.com/snowinszu/huichat` 这个远程地址，US-001 是后续所有 workflow 能运行的前提条件，需要最先完成。
- **原生模块与 CI runner 的匹配**：`electron-builder.yml` 中的 `npmRebuild: true` 已经处理了"针对目标平台/架构重新编译 `better-sqlite3`"的逻辑（详见 [prd-electron-builder-packaging.md](prd-electron-builder-packaging.md)），CI 侧不需要额外配置，只需保证 `build` job 跑在对应平台的 runner 上（`macos-latest` / `windows-latest`），让 `npm ci` 的 `postinstall` 和 electron-builder 的打包过程都在原生环境里执行。
- **typecheck/lint job 跳过原生编译**：`postinstall` 脚本会触发 `electron-rebuild -f -w better-sqlite3`，这一步在没有编译工具链的 `ubuntu-latest` 上大概率会失败，而 typecheck/lint 并不需要一个可运行的原生二进制，因此该 job 用 `npm ci --ignore-scripts` 安装依赖即可。
- **发布 Release 所需权限**：默认的 `GITHUB_TOKEN` 需要在 workflow 中声明 `permissions: contents: write`，否则创建 Release / 上传资产会因权限不足而失败。
- **建议使用的 Action**：`actions/checkout`、`actions/setup-node`（`node-version-file: .nvmrc`）、以及一个支持"创建 Release + 一次上传多个资产"的社区 action（如 `softprops/action-gh-release`），避免手写多步 REST API 调用。
- **产物路径**：`electron-builder.yml` 中 `directories.output` 为 `release/`，两个平台的构建产物文件名已包含 `productName`（会聊）与 `package.json` 中的 `version`，上传 Release 资产时直接引用 `release/*.dmg` 与 `release/*.exe` 通配路径即可。

## 8. Success Metrics

- 推送一个 `vX.Y.Z` tag 后，15 分钟内在 GitHub Releases 页面自动出现包含 `.dmg` 与 Windows 安装包的 Release，全程无需人工介入
- typecheck/lint 检查未通过时，100% 阻止对应的打包与发布流程，不产出"带病"安装包
- 首次实现"无需物理 Windows 主机即可产出 Windows 安装包"，解决 [prd-electron-builder-packaging.md](prd-electron-builder-packaging.md) 遗留的 Open Question

## 9. Open Questions

- `snowinszu/huichat` 这个远程仓库目前是空仓库，还是已经有内容（如 README）？如果远程已有历史，US-001 的首次推送可能需要处理合并冲突，而不是单纯的 `git push`。`[Assumption]`：暂按"空仓库、直接推送"处理，如有历史需在实现时确认。
- 是否需要保留手动触发选项（`workflow_dispatch`），方便在不打 tag 的情况下临时触发一次完整构建用于调试？`[Assumption]`：暂不加，等实际使用中发现需要再补充。
- Release 中的资产文件名是否需要额外规范化（如去掉架构后缀、统一大小写），还是直接使用 electron-builder 默认生成的文件名即可？`[Assumption]`：直接使用默认文件名。
