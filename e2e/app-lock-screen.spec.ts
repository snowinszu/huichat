import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// One continuous journey (same rationale as #13/#19/#33): later steps
// genuinely depend on earlier state — you can't test disabling the lock
// before it's enabled, or unlocking before it's locked.
test('锁屏完整流程：设置密码 → 一键锁定 → 遮罩隐藏内容 → 正确密码解锁 → 错误密码路径 → 忘记密码重置', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-app-lock-'));
  let electronApp: ElectronApplication | undefined;

  try {
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Baseline: no password set yet, no lock icon anywhere ----
    await expect(window.getByRole('button', { name: '锁定应用' })).not.toBeVisible();

    // ---- US-001/US-002: enable the lock from Settings ----
    await window.getByLabel('设置').click();
    await expect(window.getByRole('button', { name: '锁定应用' })).not.toBeVisible();
    await window.getByRole('switch', { name: '锁屏密码' }).click();
    // Mismatched passwords: inline error, dialog stays open, nothing saved.
    await window.getByLabel(/^密码/).fill('1234');
    await window.getByLabel('确认密码').fill('0000');
    await window.getByRole('button', { name: '开启锁屏' }).click();
    await expect(window.getByText('两次输入的密码不一致')).toBeVisible();
    await window.getByLabel('确认密码').fill('1234');
    await window.getByRole('button', { name: '开启锁屏' }).click();
    await expect(window.getByText('锁屏已开启')).toBeVisible();
    // The icon appears immediately, without leaving/re-entering the screen.
    await expect(window.getByRole('button', { name: '锁定应用' })).toBeVisible();
    await window.getByLabel('返回').click();

    // ---- Create a chat card and type a draft, then lock from *inside* that
    // screen (not after navigating away) — this is what actually exercises
    // "state preserved, not unmounted": engageLock() only flips a boolean in
    // AppLockProvider, it never touches AppShell's own `view` state, so
    // locking here should never navigate anywhere ----
    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 锁屏测试对象');
    await window.getByLabel('对方基本信息').fill('用于验证锁定期间状态不丢失');
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();
    await window.getByText('E2E 锁屏测试对象', { exact: true }).click();
    await window.getByPlaceholder('粘贴对方发来的消息…').fill('这是锁定前未提交的草稿');

    // ---- US-003/US-004: engage the lock, overlay hides everything ----
    await window.getByRole('button', { name: '锁定应用' }).click();
    const overlay = window.getByRole('dialog', { name: '应用已锁定' });
    await expect(overlay).toBeVisible();
    // The underlying content isn't `display:none` (it's painted over by the
    // opaque, higher-z-index overlay instead — see LockOverlay.module.css),
    // so `toBeVisible()` can't tell "occluded" from "gone". What actually
    // matters per the AC — can't be reached via keyboard/click — is exactly
    // what `inert` guarantees, so that's what gets asserted here.
    expect(await window.evaluate(() => document.querySelector('[inert]') !== null)).toBe(true);

    // ---- US-005: wrong password stays locked, shows an error, keeps focus ----
    const overlayInput = overlay.locator('input');
    await overlayInput.fill('9999');
    await window.getByRole('button', { name: '解锁', exact: true }).click();
    await expect(overlay).toBeVisible();
    await expect(window.getByText('密码错误')).toBeVisible();
    await expect(overlayInput).toHaveValue('');
    await expect(overlayInput).toBeFocused();

    // ---- US-005 (continued): correct password (via Enter) unlocks and
    // restores exactly the chat screen with its draft untouched — no
    // navigation happened, so this proves the tree was never unmounted ----
    await overlayInput.fill('1234');
    await overlayInput.press('Enter');
    await expect(overlay).not.toBeVisible();
    await expect(window.getByText('E2E 锁屏测试对象')).toBeVisible();
    await expect(window.getByPlaceholder('粘贴对方发来的消息…')).toHaveValue('这是锁定前未提交的草稿');

    // ---- US-006: forgot-password reset flow ----
    await window.getByRole('button', { name: '锁定应用' }).click();
    await expect(overlay).toBeVisible();
    await window.getByText('忘记密码？').click();
    await expect(window.getByRole('button', { name: '确认重置' })).toBeDisabled();
    await window.getByLabel('请输入"删除"以确认').fill('删除');
    await expect(window.getByRole('button', { name: '确认重置' })).toBeEnabled();
    await window.getByRole('button', { name: '确认重置' }).click();
    await window.waitForLoadState('domcontentloaded');

    // Back to a genuinely fresh state: unlocked, no lock icon, no chat card.
    await expect(window.getByRole('dialog', { name: '应用已锁定' })).not.toBeVisible();
    await expect(window.getByRole('button', { name: '锁定应用' })).not.toBeVisible();
    await expect(window.getByText('E2E 锁屏测试对象')).not.toBeVisible();
    await expect(window.getByText('还没有聊天对象')).toBeVisible();
  } finally {
    await electronApp?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
