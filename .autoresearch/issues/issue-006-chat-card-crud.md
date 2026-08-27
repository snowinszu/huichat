# 创建/管理聊天对象卡片（含头像上传）

## Description
支持创建包含对方信息、头像、聊天最终目标、关联己方角色的聊天对象卡片，首页以卡片网格展示。

## Acceptance Criteria
- [x] 首页有"新建聊天对象"按钮，打开创建表单 — `src/screens/home/HomeScreen.tsx`：section-header 主按钮 + 卡片网格末尾的虚线 `AddContactCard` 两处入口，均打开同一个创建 `Modal`
- [x] 表单字段：对方基本信息（自由文本）、头像上传（图片文件，本地存储+缩略图）、聊天最终目标（自由文本）、己方角色（从已创建角色中选择）— 另加"对方称呼"必填字段（设计稿表单没有但 `chat_card.name NOT NULL` 且卡片网格需要展示短名称，这是功能性必需的补充，非设计遗漏的复刻）；头像走真实文件流程：渲染进程读取 `File.arrayBuffer()` → IPC 传给主进程 → `nativeImage` 缩放到 160×160 缩略图 → 写入 `userData/avatars/` → 返回 `avatar://<uuid>.png`，通过新注册的 `avatar://` 自定义协议供 `<img src>` 直接读取
- [x] 首页以卡片形式展示所有聊天对象（头像 + 名称/摘要）— 复用 Issue #2 的 `ContactCard`（新增 `avatarUrl` 支持真实头像图，否则回退到 `avatarGradient` 渐变+首字）；摘要用"对方基本信息"文本（尚无消息历史可展示，用真实数据而非占位符）；角色标签在有关联角色时显示，未关联则省略而非留空徽章；时间用新写的 `formatRelativeTime`（刚刚/N分钟前/N小时前/N天前）
- [x] 支持编辑已有卡片；支持删除卡片（删除前二次确认）— 编辑复用同一 Modal（预填所有字段，未选新头像则保留原头像不重新上传）；删除复用 `ConfirmDialog`（danger 语气，"所有历史记录将一并删除"文案与设计稿一致）；删除/替换头像时会调用 `deleteAvatarIfLocal` 清理磁盘上的旧缩略图文件
- [x] Typecheck/lint passes — `npm run typecheck` 与 `npm run lint` 均通过（0 error / 0 warning）
- [x] Verify in a browser (via `run` skill) — Electron 仍无法在本沙箱起 GUI（同 #1-#5），改用纯 Vite 渲染层 + headless Chromium（Playwright，`window.api` mock）驱动：空状态、创建校验报错、真实文件上传预览、创建成功、编辑回填（含头像/角色下拉）、删除确认与执行、计数更新均截图确认；`npm run dev` 额外验证了 `avatarStorage.ts`/`avatar://` 协议新代码在真实 Electron 主进程构建下能正常编译打包（无残留的 pi-ai 式 CJS/ESM 问题），到达与此前 issue 相同的、仅限本沙箱的 `ELECTRON_RUN_AS_NODE` GUI 限制处。控制台无报错

## Implementation Notes
- Avatar storage design decision: chose real files under `userData/avatars/` served through a registered `avatar://` custom protocol (`electron/main/avatarStorage.ts`, `protocol.handle` registered in `main/index.ts`'s `whenReady`), over the simpler alternative of storing a base64 data URL directly in the `avatar_path` column. Reasoning: the AC explicitly says "图片文件…本地存储" (image *file*, stored *locally*), and keeping SQLite lean matters more as the app grows. `nativeImage.createFromBuffer(...).resize({width:160,height:160})` gives the "缩略图" (thumbnail) requirement for free via Electron's built-in API — no new dependency. Renderer flow: `File.arrayBuffer()` → `Uint8Array` over IPC → main process resizes + writes → returns `avatar://<uuid>.png` back to the renderer, which is stored as-is in `chat_card.avatar_path` and used directly as `<img src>`.
- `chatCardRepository.updateChatCard`/`deleteChatCard` now call `deleteAvatarIfLocal` (skipped for null/non-`avatar://` values) so replacing or deleting a card's avatar doesn't leak the old thumbnail file on disk.
- Testing gap, disclosed rather than papered over: `avatarStorage.ts` uses `app`/`nativeImage`/`protocol` from `electron`, none of which exist when that module is loaded under plain Node/tsx (confirmed: `require('electron')` outside the real Electron binary resolves to a path *string*, not the API surface). This means the actual resize/file-write/protocol-serve logic could not be exercised by a standalone script the way prior issues' DB logic was — only the pure/no-op branches (`deleteAvatarIfLocal` with null/non-local input) could be verified that way. Mitigated with: (1) a real `npm run dev` rebuild confirming the new module compiles and bundles without error inside the actual Electron main-process build, and (2) mocked-`window.api` browser verification proving the renderer-side upload/preview/save flow is wired correctly end-to-end. The one thing genuinely unverified in this session is "does a real photo actually get resized and load via `avatar://` inside a running Electron window" — recommend a real `npm run dev` avatar upload as a final manual check.
- `HomePlaceholder` (the deliberate stand-in from Issue #4) is now retired — deleted along with its module.css, no remaining references.
- Chat card click-through to a chat screen intentionally does nothing yet: no chat screen exists (it gets assembled piecemeal by #7/#8/#10, not built as its own issue), so `ContactCard`'s `onOpen` is left unset on the home grid rather than wiring a dead/fake navigation target. Edit/delete icon buttons work independently of the (currently absent) card-body click.

## Dependencies
Issue #1, Issue #2, Issue #5

## Type
fullstack

## Priority
high

## Design Reference
`UI design/home.html`
