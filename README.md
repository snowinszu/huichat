# 会聊

AI 聊天辅助助手（Electron 桌面应用）。

## 开发

```bash
npm install
npm run dev
```

## 生成安装包

使用 [electron-builder](https://www.electron.build/) 打包，产物输出到 `release/` 目录（已在 `.gitignore` 中忽略）。

| 命令 | 用途 |
| --- | --- |
| `npm run dist` | 打包当前主机所在平台（Mac 主机产出 dmg，Windows 主机产出 nsis 安装向导） |
| `npm run dist:mac` | 显式打包 Mac universal（同时支持 Intel 与 Apple Silicon）版 `.dmg` 安装包，**只能在 Mac 主机上运行** |
| `npm run dist:win` | 显式打包 Windows x64 版 NSIS 安装向导 `.exe`，**只能在 Windows 主机上运行** |

### 平台限制：为什么不能从 Mac 打出 Windows 包（或反过来）

项目依赖 `better-sqlite3`，这是一个原生 Node 模块（原生模块的意思是它包含了针对特定操作系统 + CPU 架构编译出的二进制文件，不是纯 JavaScript）。打包时 electron-builder 会针对目标平台/架构重新编译这个原生模块，而这个编译过程依赖当前主机的系统工具链（比如 Mac 上编译 Windows 版二进制通常是不可靠或不可行的）。因此：

- `npm run dist:mac` 必须在 macOS 主机上执行
- `npm run dist:win` 必须在 Windows 主机上执行

本地没有配置 Windows 交叉编译，需要在本机生成 Windows 安装包时请在一台 Windows 电脑（或虚拟机）上克隆本仓库并执行 `npm run dist:win`。如果只是想拿到一个正式的 Windows 安装包，不需要本机操作——见下方「发布新版本」，GitHub Actions 会在云端 Windows 主机上自动构建。

### 系统版本要求

由 Electron 43（Chromium）自身决定，与本项目的打包配置无关：

- **Mac**：macOS 12（Monterey）及以上。低于此版本安装时会直接被系统拒绝，提示"该应用程序要求 macOS 12.0 或更高版本"。
- **Windows**：Windows 10 及以上（Electron 23 起不再支持 Windows 7/8/8.1）。

如果需要支持更老的系统，只能通过降级 Electron 大版本实现，这是一次有风险的大改动（可能影响 `better-sqlite3`、`vite-plugin-electron` 等依赖的兼容性），不是配置层面能调整的。

### 关于代码签名

当前未配置 Apple 开发者证书或 Windows 签名证书（见 PRD 非目标）。生成的 `.dmg`/`.exe` 是未签名的，其他电脑首次打开时可能会被系统安全机制（Gatekeeper / Windows SmartScreen）拦截，需要用户手动允许运行。

### 验证安装包

**Mac（`npm run dist:mac` 后）：**

1. 双击 `release/会聊-<version>-universal.dmg` 挂载，或用 `hdiutil attach release/会聊-<version>-universal.dmg`
2. 把挂载卷里的 `会聊.app` 拖到 Applications（或直接从挂载卷双击启动）
3. 首次启动会被 Gatekeeper 拦截（因为未签名，见上一节）——右键点"打开"确认允许运行
4. 确认主界面正常渲染，创建一张模型卡片或发一条消息，确认数据写入正常（无原生模块加载报错）

**Windows（`npm run dist:win` 后，本机手动验证步骤——通过 GitHub Actions 发布的安装包同样适用这套验证方式）：**

1. 在 Windows 主机上运行 `npm run dist:win`，确认命令以退出码 0 结束，`release/` 下生成 `会聊 Setup <version>.exe`
2. 双击运行安装向导，走完安装流程
3. 首次启动可能被 Windows SmartScreen 拦截（因为未签名）——点"更多信息" → "仍要运行"
4. 确认主界面正常渲染，创建一张模型卡片或发一条消息，确认数据写入正常（无原生模块加载报错）

## 发布新版本

正式发布走 GitHub Actions 自动构建，不需要本机手动执行 `dist:mac` / `dist:win`。

1. **更新版本号**：修改 `package.json` 中的 `version` 字段（如 `1.0.0`），提交并推送到 `main`
   ```bash
   git add package.json
   git commit -m "Bump version to 1.0.0"
   git push origin main
   ```
2. **打 tag 并推送**：tag 名称必须是 `v` + 版本号，与 `package.json` 的 `version` 保持一致（两者目前没有自动校验，需要手动对齐）
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   - 正式版用 `v1.0.0` 这种不带 `-` 的 tag，发布为正式 Release
   - 预发布/测试版用 `v1.0.0-rc1`、`v1.0.0-beta` 这种带 `-` 后缀的 tag，会自动标记为 pre-release
3. **等待自动构建**：推送 tag 后触发 `.github/workflows/release.yml`——依次跑 typecheck/lint 检查，再并行构建 macOS `.dmg` 与 Windows 安装包，全部成功后自动创建 GitHub Release 并附加两个安装包。进度见 [Actions](https://github.com/snowinszu/huichat/actions)，完成后去 [Releases](https://github.com/snowinszu/huichat/releases) 下载。

日常 push 到 `main` 或提交 PR 只会触发 `.github/workflows/ci.yml` 的 typecheck + lint 检查，不会打包、不会发布。
