# PRD: 提示词调试导出

## 1. Introduction/Overview

调试提示词（prompt）目前只能靠猜测——用户没法直接看到应用实际发给 LLM 的完整文本，也看不到 LLM 原样返回了什么。本功能在"设置"页新增一个调试开关：打开后，应用每次和 LLM 交互（生成回复、润色、翻译、目标评估、自动信息提取、模型连接测试……只要调用了 LLM），都会把这次交互的完整提示词和响应文本，写成一个独立文件保存到用户指定的目录里，方便事后逐条查看、对比不同场景下模型实际收到的上下文。

## 2. Goals

- 用户可以在设置页打开/关闭"导出 LLM 交互调试日志"开关。
- 用户可以通过系统原生目录选择器指定导出目录，选择结果持久化保存。
- 开关打开后，应用内所有经过 `callLlm` 的调用（无论最终是成功还是失败）都会各自生成一个独立文件，写入所选目录。
- 每个导出文件包含：调用时间、触发该次调用的功能来源、所用的 provider/model、完整 prompt 文本、完整响应文本（或错误信息）。
- 导出逻辑本身出错（如目录不存在、无写入权限）不能影响原有功能（生成回复、翻译等）的正常使用。

## 3. User Stories

### US-001: 偏好数据新增调试导出字段
**Description:** As a developer, 我需要在 `app_preference` 中新增两个字段（是否开启调试导出、导出目录路径），以便设置页和导出逻辑都能读写这份状态。

**Acceptance Criteria:**
- [ ] `app_preference` 表新增 `debug_prompt_export`（0/1，默认 0）和 `debug_export_dir`（TEXT，可为 NULL，默认 NULL）两列
- [ ] `AppPreferenceRecord` 新增 `debugPromptExport: boolean` 和 `debugExportDir: string | null`
- [ ] `UpdateAppPreferenceInput` 支持同时更新这两个字段（各自可选）
- [ ] `appPreferenceRepository.ts` 的 `getAppPreference` / `updateAppPreference` 正确读写这两列，其余现有字段行为不受影响
- [ ] Typecheck/lint 通过

### US-002: 目录选择器 IPC
**Description:** As a user, 我想通过系统原生的目录选择对话框来指定导出目录，而不是手动输入路径。

**Acceptance Criteria:**
- [ ] 新增 IPC 通道（如 `debug-export:choose-directory`），主进程用 Electron 的 `dialog.showOpenDialog({ properties: ['openDirectory'] })` 弹出系统目录选择器
- [ ] 用户选中目录后，通道返回所选的绝对路径字符串
- [ ] 用户在系统对话框中点击取消时，通道返回 `null`，且不修改已保存的 `debugExportDir`
- [ ] preload 暴露对应方法（如 `window.api.debugExport.chooseDirectory(): Promise<string | null>`）
- [ ] Typecheck/lint 通过

### US-003: 设置页调试导出开关与目录展示
**Description:** As a user, 我想在设置页看到一个"导出提示词调试日志"开关和当前选择的目录，并能随时更改目录或关闭功能。

**Acceptance Criteria:**
- [ ] 设置页新增一个开关"导出提示词调试日志"，样式与现有"翻译非中文消息"等开关一致
- [ ] 开关旁展示当前已选择的导出目录路径；未选择时显示"未设置目录"之类的占位提示
- [ ] 提供"选择目录" / "更改目录"按钮，点击后调用 US-002 的 IPC，选中后立即保存并刷新展示的路径
- [ ] 若用户在未选择任何目录的情况下尝试打开开关，弹出提示引导其先选择目录（开关本次操作不生效，或自动触发目录选择流程），不会保存"已开启但目录为空"的无效状态
- [ ] 关闭开关不清除已保存的目录路径，方便下次重新打开时无需重新选择
- [ ] Typecheck/lint 通过
- [ ] Verify in a browser（e.g., via the `run` skill）

### US-004: 导出每次 LLM 交互到独立文件
**Description:** As a user，我想在开关打开后，应用每次真正调用 LLM 时都自动把这次交互写成一个文件，保存到我指定的目录，这样我可以事后逐条查看实际发送和收到的内容。

**Acceptance Criteria:**
- [ ] `callLlm`（`electron/main/llm/client.ts`）的所有调用方（生成回复、润色草稿、翻译消息、目标评估、自动信息提取、模型连接测试）在偏好开启且目录已设置时，均会触发一次导出，不遗漏任何一个功能入口
- [ ] 每次交互生成一个独立文件，文件名包含时间戳和来源标识（如 `2026-08-27T143512_reply-generate.txt`），不会互相覆盖
- [ ] 文件内容包含：调用时间（可读格式）、触发来源（如"生成回复"/"润色"/"翻译"/"目标评估"/"自动信息提取"/"模型连接测试"）、所用 provider 与 model 名称、完整 prompt 文本、完整响应文本
- [ ] 文件内容不包含 API Key 或其他鉴权凭据
- [ ] 若本次 LLM 调用最终失败（抛出异常），导出文件改为记录错误信息，而不是静默跳过导出
- [ ] 偏好关闭时，不产生任何导出文件，原有 LLM 调用行为完全不变
- [ ] 导出目录不存在、不可写等异常情况下，写入操作静默失败（记录到主进程日志即可），绝不能导致原本的生成回复/润色/翻译等功能报错或中断
- [ ] Typecheck/lint 通过

### US-005: 端到端测试——提示词调试导出完整流程
**Description:** As a QA engineer, 我想要一个自动化端到端测试覆盖"开启调试导出 → 选择目录 → 触发一次 LLM 交互 → 目录中出现对应文件且内容正确"的完整链路，防止未来改动引入回归。

**Acceptance Criteria:**
- [ ] 自动化 E2E 测试（Electron + mock LLM server）创建一个临时目录，通过测试可控的方式将其设为导出目录并打开调试导出开关（如直接调用底层 IPC/mock 目录选择返回该临时目录，避免依赖真实系统弹窗）
- [ ] 触发一次真实的 LLM 交互（如点击"生成回复"），断言该临时目录下新增了一个文件，且文件内容包含本次实际发送的 prompt 关键文本、mock 返回的响应文本、以及 provider/model 信息
- [ ] �covers 边界路径：关闭调试导出开关后再次触发生成回复，断言目录中文件数量不再增加
- [ ] 覆盖边界路径：导出目录被测试提前删除后再触发生成回复，断言"生成回复"功能本身仍然正常返回候选回复（导出失败不影响主功能）
- [ ] 测试在 CI 中可运行并通过
- [ ] 测试自行创建并清理所需的临时目录、聊天卡片和消息数据，不依赖测试执行顺序

## 4. Functional Requirements

- FR-1: 系统必须在 `app_preference` 中持久化"是否开启调试导出"（`debugPromptExport`）和"导出目录路径"（`debugExportDir`）。
- FR-2: 系统必须提供一个 IPC 通道，调用 Electron 原生目录选择对话框并返回用户选择的绝对路径。
- FR-3: 系统必须在设置页展示调试导出开关、当前导出目录，并提供更改目录的入口。
- FR-4: 当用户尝试在未设置目录时打开调试导出开关，系统必须阻止保存"已开启但无目录"的状态，并引导用户先选择目录。
- FR-5: 系统必须在调试导出开启且目录已设置时，为每一次 `callLlm` 调用生成一个独立的导出文件。
- FR-6: 每个导出文件必须包含调用时间、触发来源、provider、model、完整 prompt 文本和完整响应文本（或错误信息）。
- FR-7: 导出文件内容必须不包含 API Key 等鉴权凭据。
- FR-8: 系统必须保证导出写入失败时不影响原有 LLM 功能（生成回复、润色、翻译等）的正常返回结果。
- FR-9: 系统必须在调试导出关闭时，不产生任何导出文件，且不改变原有 LLM 调用的行为。

## 5. Non-Goals (Out of Scope)

- 不做导出文件的应用内查看器/管理界面（用户自行用系统文件管理器或文本编辑器查看）。
- 不做导出文件的自动清理/过期删除机制，磁盘空间管理由用户自己负责。
- 不做导出内容的搜索、筛选或统计分析功能。
- 不对已导出的历史文件做加密或额外的访问权限控制。
- 不改变现有 LLM 调用的实际请求内容或行为，本功能只做"旁路记录"，不介入请求本身。

## 6. Design Considerations

- 复用现有 `Toggle` 组件样式，与"翻译非中文消息"等开关保持一致的视觉语言。
- "选择目录"入口可参考现有按钮样式（`Button` 组件），目录路径展示可用等宽或截断+tooltip 的方式处理过长路径。
- Mobile First：设置页在窄屏下，开关、路径展示、按钮应纵向堆叠，不出现横向溢出。

## 7. Technical Considerations

- 核心改动文件：
  - `electron/shared/ipc-types.ts`：扩展 `AppPreferenceRecord` / `UpdateAppPreferenceInput`，新增目录选择的 IPC 通道常量。
  - `electron/main/db/appPreferenceRepository.ts` 及数据库 schema：新增两列。
  - `electron/main/ipc/register.ts`：注册目录选择 IPC handler（`dialog.showOpenDialog`）。
  - `electron/preload/index.ts`：暴露 `debugExport.chooseDirectory`。
  - `electron/main/llm/client.ts`：`callLlm` 是所有 LLM 调用的唯一入口，是接入导出逻辑最自然的位置；需要新增一个参数（如 `source` 标签）让各调用方标明"生成回复"/"润色"/"翻译"等来源。
  - 新增一个独立模块（如 `electron/main/debugExport.ts`）负责："是否应该导出"的判断、文件命名、写文件、异常吞掉不外抛。
  - `src/screens/settings/SettingsScreen.tsx`：新增开关与目录选择 UI。
- 导出逻辑必须是 fire-and-forget/尽力而为：写文件失败只记录到主进程 `console.error`，绝不能让 `callLlm` 的 `Promise` 因为导出失败而 reject。
- 目录选择使用真实系统对话框，E2E 测试环境中不便触发系统级 UI，测试需要绕开真实对话框（如直接通过测试可控的方式设定 `debugExportDir` 偏好值），核心验证目标是"导出文件确实落盘且内容正确"而不是"系统对话框弹出正确"。

## 8. Success Metrics

- 用户从"怀疑某次回复的提示词有问题"到"找到对应的导出文件并确认实际发送内容"，全程不需要额外的代码修改或重新编译。
- 打开调试导出开关后，100% 的 LLM 交互（无论成功失败）都能在指定目录找到对应文件，不遗漏。
- 调试导出功能异常（如目录被删除）不会导致任何一次已知的 LLM 相关功能（生成回复/润色/翻译/目标评估/自动信息提取/连接测试）报错率上升。

## 9. Open Questions

- 导出文件是否需要在文件名或内容中标注对应的聊天卡片/联系人名称，便于用户在多个聊天对象间调试时区分？（当前假设：仅按时间+来源命名，不含聊天对象信息，用户可通过修改时间和内容里的上下文自行辨认）
- 是否需要限制单个导出目录的文件总数或总大小，避免长期使用后堆积过多文件？（当前假设：不限制，交由 Non-Goals 中"用户自行负责磁盘空间"处理）
