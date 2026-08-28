# PRD: 一键锁屏（应用密码锁）

## 1. Introduction/Overview

会聊是一个存储了大量私人 AI 对话记录的桌面应用，目前任何能接触到电脑的人打开应用就能看到全部聊天内容。这个功能给应用加一把"锁"：用户可以在设置页开启锁屏并设置一个本地密码，之后随时通过标题栏图标一键锁定应用；锁定后界面被全屏遮罩完全覆盖，必须输入正确密码才能回到原来的界面。

这是纯本地的应用内密码，不依赖任何云端账户体系——密码只是用来防止"临时离开电脑时被别人看到聊天内容"，不是用来加密数据库文件本身。

## 2. Goals

- 用户可以在设置页开启"锁屏"并设置一个密码，关闭时需验证当前密码
- 用户可以随时通过标题栏的一个图标一键锁定应用，无需进入设置页
- 锁定后，聊天内容、界面导航等一切应用信息完全不可见，只能看到密码输入框
- 密码正确时立即恢复到锁定前的界面和状态，无需重新加载应用
- 忘记密码时，用户能通过明确、有强警示的"重置应用数据"流程重新获得访问权，而不是被永久锁死

## 3. User Stories

### US-001: 设置页开启锁屏并设置密码
**Description:** As a user, I want to turn on the lock-screen feature and set a password from the settings page, so I can protect my chat data with a password of my choice.

**Acceptance Criteria:**
- [ ] 设置页新增"锁屏密码"开关，默认关闭
- [ ] 打开开关时弹出"设置密码"对话框，要求输入密码和确认密码两次，输入框使用密码掩码（●●●）
- [ ] 密码长度要求 4-20 位，两次输入不一致时显示红色提示"两次输入的密码不一致"，不允许提交
- [ ] 提交成功后开关变为开启状态，并 toast 提示"锁屏已开启"
- [ ] 密码以哈希形式持久化存储在本地（不存明文），重启应用后开关状态与密码依然有效
- [ ] 用户在对话框中点击取消，开关保持关闭、不保存任何密码
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-002: 关闭锁屏需验证当前密码
**Description:** As a user, I want to be required to confirm my current password before turning off the lock-screen feature, so someone else can't casually disable my protection.

**Acceptance Criteria:**
- [ ] 已开启锁屏时，关闭开关会弹出"输入当前密码以关闭锁屏"对话框
- [ ] 密码正确时开关变为关闭，本地存储的密码哈希被清除，toast 提示"锁屏已关闭"
- [ ] 密码错误时显示红色提示"密码错误"，开关保持开启状态
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-003: 标题栏一键锁定应用
**Description:** As a user, I want a lock icon in the title bar so I can lock the app with a single click at any time.

**Acceptance Criteria:**
- [ ] 仅当锁屏功能已开启（US-001 设置完密码）时，标题栏/顶部导航栏显示一个锁形图标
- [ ] 未开启锁屏功能时，该图标不显示
- [ ] 点击图标后应用立即进入锁定状态（见 US-004 的展示效果），无需二次确认
- [ ] 图标带有 hover 提示文案"锁定应用"
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-004: 锁定状态下全屏遮罩隐藏应用内容
**Description:** As a user, I want the entire app content to be hidden behind a full-screen overlay while locked, so no one glancing at my screen can see any chat content or app state.

**Acceptance Criteria:**
- [ ] 锁定后一个全屏遮罩层完全覆盖应用原有界面（聊天内容、导航、标题栏图标等均不可见），只显示应用图标/名称 + 密码输入框
- [ ] 遮罩层下应用原有的 React 状态（当前打开的聊天、草稿输入等）在锁定期间保留在内存中，不会被卸载或重置
- [ ] 锁定状态下无法通过键盘快捷键、右键菜单等方式绕过遮罩访问底层内容
- [ ] 应用最小化后再恢复，若之前处于锁定状态，恢复后依然显示遮罩（锁定状态不因窗口切换而丢失）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-005: 输入正确密码解锁
**Description:** As a user, I want to unlock the app by typing my password on the overlay, so I can get back to exactly where I left off.

**Acceptance Criteria:**
- [ ] 密码输入框支持回车提交，也提供"解锁"按钮
- [ ] 密码正确时遮罩立即消失，恢复到锁定前的界面和滚动位置/输入状态
- [ ] 密码错误时输入框震动/红色边框提示"密码错误"，输入框清空，焦点保留在输入框，遮罩不消失
- [ ] 密码错误不做失败次数限制或延迟（每次错误仅提示，不锁定或冷却）
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-006: 忘记密码时通过重置应用数据恢复访问
**Description:** As a user who forgot their password, I want a clearly-labeled way to regain access by resetting the app's local data, so I'm not permanently locked out even though there's no cloud recovery.

**Acceptance Criteria:**
- [ ] 锁屏输入框下方提供"忘记密码？"链接
- [ ] 点击后弹出警示对话框，明确说明"重置将永久删除本机全部聊天记录、角色和设置，且无法恢复"，并要求用户输入固定确认词（如"删除"）才能激活"确认重置"按钮
- [ ] 确认重置后清空本地数据库与偏好设置（含锁屏密码本身），应用回到未设置锁屏的初始状态，无需重启进程即可继续使用
- [ ] 用户中途关闭警示对话框或未输入确认词，不做任何数据变更，遮罩依然显示
- [ ] Typecheck/lint passes
- [ ] Verify in a browser (e.g., via the `run` skill)

### US-007: 端到端测试锁屏完整流程
**Description:** As a QA engineer, I want an automated end-to-end test covering the full lock-screen journey so that we catch regressions across the entire stack.

**Acceptance Criteria:**
- [ ] E2E 测试：在设置页开启锁屏并设置密码 → 点击标题栏锁定图标 → 断言全屏遮罩出现且底层聊天内容不可见 → 输入正确密码解锁 → 断言恢复到锁定前的界面
- [ ] 覆盖边界场景：解锁时输入错误密码，断言遮罩不消失并显示错误提示
- [ ] 覆盖边界场景：走"忘记密码"重置流程，断言重置后应用回到无锁屏的初始状态
- [ ] 测试在 CI 中运行并通过
- [ ] 测试自行创建和清理所需的测试数据（密码、锁屏开关状态）

## 4. Functional Requirements

- FR-1: 系统必须在设置页提供"锁屏密码"开关，用于开启或关闭锁屏功能。
- FR-2: 系统必须在用户开启开关时要求设置密码（4-20 位），并要求二次输入确认一致。
- FR-3: 系统必须将密码以哈希形式（非明文）持久化到本地存储。
- FR-4: 系统必须在用户关闭锁屏开关时要求输入当前密码进行验证。
- FR-5: 系统必须在锁屏功能开启后，于标题栏/顶部导航栏展示一个锁定图标。
- FR-6: 系统必须在用户点击锁定图标时立即将应用切换为锁定状态。
- FR-7: 系统必须在锁定状态下用全屏遮罩完全覆盖应用原有界面内容。
- FR-8: 系统必须在锁定状态下保留应用原有的内存状态（不卸载、不刷新页面）。
- FR-9: 系统必须在锁定状态下持续到用户输入正确密码或完成"重置应用数据"流程为止，不因窗口最小化/切换而自动解除。
- FR-10: 系统必须在用户于遮罩输入正确密码时解除锁定，恢复到锁定前的界面。
- FR-11: 系统必须在用户输入错误密码时提示错误并保持锁定状态，不做失败次数限制。
- FR-12: 系统必须在遮罩上提供"忘记密码"入口，引导用户完成需二次确认的本地数据重置流程。
- FR-13: 系统必须在完成数据重置后清除已保存的密码并将锁屏功能恢复为关闭状态。

## 5. Non-Goals (Out of Scope)

- 不做数据库文件级别的加密（SQLite 文件本身不加密），密码仅用于阻止 UI 层的窥屏访问
- 不做云端账户体系、跨设备密码同步或云端密码找回
- 不支持通过安全问题、邮箱、短信等方式找回密码 —— 忘记密码只能通过清除本地数据恢复访问
- 不做失败次数限制、锁定冷却或暴力破解防护（本地单机场景，威胁模型不包含在线暴力破解）
- 不支持指纹/Face ID/系统级生物识别解锁
- 不支持应用启动时强制要求密码（锁定仅由用户主动点击图标触发，非自动锁定）
- 不支持空闲超时自动锁定、最小化自动锁定等自动触发机制

## 6. Design Considerations

- 遮罩层视觉与现有 UI 设计稿风格保持一致（参考 `UI design/` 目录与现有 Toggle/Input 组件）
- 密码输入框复用现有 `Input` 组件的掩码模式
- 标题栏锁定图标风格与现有 `IconButton`/`IconArrowLeft` 等图标组件保持一致的尺寸和交互反馈

## 7. Technical Considerations

- 复用现有 `AppPreferenceRecord` / IPC 模式（参考 `electron/shared/ipc-types.ts` 与 `SettingsScreen.tsx` 中 `window.api.appPreference` 的调用方式），新增锁屏相关的偏好字段和 IPC 方法
- 密码哈希建议使用 Node 内置 `crypto`（如 scrypt/pbkdf2 + salt），避免引入新依赖，且需在 Electron 主进程完成（渲染进程不直接持有密码明文的存储逻辑）
- 锁定状态应维护在主进程或一个不随渲染进程刷新而重置的位置，确保窗口最小化/恢复不丢失锁定状态
- "重置应用数据"复用/扩展现有数据库访问层（参考 `electron/main/db/personaRepository.ts` 所在的 repository 模式），需要清空所有表且清除偏好设置文件

## 8. Success Metrics

- 用户从点击锁定图标到遮罩完全生效的耗时 < 200ms（无感知延迟）
- 密码验证失败到错误提示展示的耗时 < 200ms
- 锁屏功能开启后，标题栏锁定图标的可见性达到 100%（无遗漏的界面入口能绕过遮罩查看内容）

## 9. Open Questions

- 遮罩上是否需要展示"重置应用数据"之外的辅助信息（如应用版本号、当前时间）？
- 密码输入框是否需要"显示密码"的明文切换按钮？
- 未来若引入多用户/多设备场景，是否需要重新评估本地哈希密码的存储位置（如迁移到系统级密钥库 keytar）？
