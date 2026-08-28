# 忘记密码时通过重置应用数据恢复访问

## Description
在遮罩上提供"忘记密码？"入口，引导用户完成需二次确认的本地数据重置流程。复用/扩展现有数据库访问层（参考 `electron/main/db/personaRepository.ts` 所在的 repository 模式），重置需清空所有表并清除偏好设置文件（含锁屏密码本身）。

## Acceptance Criteria
- [x] 锁屏输入框下方提供"忘记密码？"链接
- [x] 点击后弹出警示对话框，明确说明"重置将永久删除本机全部聊天记录、角色和设置，且无法恢复"，并要求用户输入固定确认词（如"删除"）才能激活"确认重置"按钮
- [x] 确认重置后清空本地数据库与偏好设置（含锁屏密码本身），应用回到未设置锁屏的初始状态，无需重启进程即可继续使用
- [x] 用户中途关闭警示对话框或未输入确认词，不做任何数据变更，遮罩依然显示
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
Issue #52, Issue #54

## Type
fullstack

## Priority
medium

## Source
tasks/prd-app-lock-screen.md — US-006

## Verification Notes

新增 `electron/main/db/resetRepository.ts` 的 `resetAppData(db)`：一个事务里 `DELETE FROM` 五张用户数据表（message/chat_card/persona/llm_model_card/settings），再删掉 `app_preference` 单例行并按 schema.ts 里 fresh-install 的同一套默认值重新插入一行（不显式写 `lock_password_hash`/`lock_password_salt`，SQLite 对没列出的可空列自动填 NULL，等于顺带清掉锁屏密码）。新增 IPC `app-lock:reset-data`，handler 里调用它之后紧接着 `setAppLocked(false)`——这条路径不需要密码，也不做二次校验，因为能走到这一步本身就是 UI 层"忘记密码"确认流程已经通过的结果。

**渲染进程这边最后决定用整页 `window.location.reload()` 收尾，而不是简单地把 `locked`/`lockEnabled` 状态清成 false**：Issue #54 的设计是锁定期间把底层内容做成 `inert` 但保留在内存里（为了正常解锁场景下"回到锁定前原地状态"），但重置数据这条路径把数据库整个清空了——如果只是解除锁定而不刷新，Home 页缓存的聊天卡片列表、可能还开着的 Chat 页消息记录等全部还停留在重置前的内存快照里，会出现界面上还显示着数据库里已经不存在的聊天对象这种不一致状态。改成重置成功后 `window.location.reload()`：只重新加载渲染进程页面，Electron 主进程（以及它的数据库连接）完全不受影响，不是"重启应用"，但足够让所有屏幕重新按空数据库挂载一遍，避免脏状态。这个决定记录在 `AppLockProvider.tsx` 的 `resetAppData` 函数注释里。

`ForgotPasswordDialog.tsx`（复用 `Modal` + 现成的 `Button`/`Input`，警示文案用一个仿 `ConfirmDialog` 配色的 `.warning` 色块，没有另外抽组件）要求输入框精确匹配确认词"删除"（大小写/多余字符都不行）才会让"确认重置"按钮从 `disabled` 变可用；取消或直接关闭对话框只清本地表单 state，不碰任何 IPC。

Typecheck/lint 通过。`npm run build`（Node 22.20）+ `_electron.launch` 走了完整验证：
1. 建一张聊天卡片留作"应该被清掉"的证据，设置密码并锁定
2. 打开"忘记密码"对话框：输入框为空时"确认重置"是 disabled；填一个错误的词（"错误的词"）依然 disabled
3. 点"取消"关闭对话框——遮罩仍然锁定，没有触发任何重置
4. 重新打开对话框，填入正确确认词"删除"——"确认重置"变为可点击；点击后等待 reload 完成
5. reload 后：遮罩消失（未锁定）、标题栏锁图标消失（`lockEnabled` 已重置为 false）、之前建的"待重置对象"聊天卡片确认已不存在，首页回到全新的空状态
6. 截图确认视觉与全新安装的首页一致，没有任何残留数据或界面痕迹
