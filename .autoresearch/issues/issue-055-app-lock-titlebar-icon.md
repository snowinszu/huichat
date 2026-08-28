# 标题栏一键锁定图标

## Description
在标题栏/顶部导航栏新增一个锁形图标，仅当锁屏功能已开启时显示，点击后立即调用 Issue #54 提供的锁定方法将应用切换为锁定状态。图标风格与现有 `IconButton`/`IconArrowLeft` 等图标组件保持一致的尺寸和交互反馈。

## Acceptance Criteria
- [x] 仅当锁屏功能已开启（已设置密码）时，标题栏/顶部导航栏显示一个锁形图标
- [x] 未开启锁屏功能时，该图标不显示
- [x] 点击图标后应用立即进入锁定状态（触发 Issue #54 的全屏遮罩），无需二次确认
- [x] 图标带有 hover 提示文案"锁定应用"
- [x] Typecheck/lint passes
- [x] Verify in a browser (e.g., via the `run` skill)

## Dependencies
Issue #52, Issue #54

## Type
frontend

## Priority
medium

## Source
tasks/prd-app-lock-screen.md — US-003

## Verification Notes

这个应用没有单一共享的标题栏组件——六个屏幕（Home/Roles/Models/Settings/Chat/Stats）各自在自己的文件里写自己的 header markup，布局也不完全一样。与其在六个文件里各写一遍"查询锁屏是否开启 + 调 IPC 上锁"的逻辑，把它收进一个 `<LockButton />`（`src/components/ui/AppLock/LockButton.tsx`）：读 `useAppLock()` 的 `lockEnabled`，`false` 时直接 `return null`，`true` 时渲染一个 `IconButton`（`title="锁定应用"` 走原生 tooltip，满足 hover 提示 AC），点击调用 `engageLock`。六个屏幕各自只需要在自己 header 的最后一个元素之后加一行 `<LockButton />`。

**放置位置靠现有 flex 布局自然对齐，没有另外写定位 CSS：**
- Home：塞进已有的 `.actions` 图标组（在"设置"图标之后），跟着组内的 gap 走。
- Roles/Models/Settings：这三个 header 的 `.pageTitle` 早就是 `flex: 1`，直接放在最后一个元素之后就会被推到最右。
- Chat：`.goalTags` 早就是 `margin-left: auto`，放在它后面就贴着最右边。
- Stats：`.title` 原来没有 `flex: 1`（只有截断相关的几个属性），补了一个 `flex: 1`（跟 pageTitle 那一批保持同一套模式），再把 `<LockButton />` 放在它后面。

**"开关状态实时联动"是这个 Issue 里唯一有一点分量的设计决策**：AC 要求"未开启锁屏功能时该图标不显示"，且要在用户于设置页开/关锁屏后立刻生效，不能等下次重启或重新进入某个屏幕才刷新。如果每个 `LockButton` 实例各自查一次 `appLock.getStatus()`，Settings 页改了密码后其它已经挂载的屏幕不会收到通知。改成把 `lockEnabled` 提到 `AppLockContext`（`AppLockProvider` 挂载时查一次），并给 context 加一个 `setLockEnabled` setter；`SettingsScreen.tsx` 在 `appLock.setPassword`/`clearPassword` 成功后除了更新自己原有的本地 `lockStatus`（Issue #53 就有的，专门给设置页开关本身用），额外调一次 `setLockEnabled(true/false)`，所有屏幕的 `LockButton` 立刻同步。

Typecheck/lint 通过。`npm run build`（Node 22.20）+ `_electron.launch` 走了一遍真实验证：
1. 未设密码时，Home 和 Settings 的锁图标都不显示
2. 设置页开启锁屏成功后，**不切换屏幕、不重新挂载**，Settings 页自己的锁图标立刻出现（验证 context 联动，不是靠 remount 才生效）
3. 依次进入 Home / 我的角色 / 模型 三个屏幕，锁图标均正确显示，与相邻内容（设置齿轮图标、"新建角色"/"新建模型卡片"按钮）无重叠
4. 新建一个聊天对象进入 Chat 屏幕，锁图标出现在目标标签之后、不遮挡"设定本次短期目标"输入框
5. 在 Chat 屏幕点击锁图标，全屏遮罩正确出现，聊天内容完全不可见
6. 每一步截图人工确认视觉位置（Home/Chat 两张截图确认无重叠，锁定后截图确认遮罩生效）
