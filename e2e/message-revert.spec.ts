import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// One continuous scenario (mirrors message-delete.spec.ts) — the final
// reload-and-verify step genuinely depends on the revert that came before it.
test('消息回退完整流程：添加多条消息 → 确认数量 → 回退删除之后消息 → 重新加载验证已从数据库清除', async () => {
  test.setTimeout(120_000);

  // A fresh, uniquely-named userData dir per run — this test creates and
  // tears down its own chat card entirely inside it, so it never depends on
  // what any other test (or a previous run) left behind.
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-revert-'));
  let electronApp: ElectronApplication | undefined;

  try {
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Setup: a chat card with four messages ----
    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 回退测试');
    await window.getByLabel('对方基本信息').fill('用于验证消息回退功能');
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();
    await window.getByText('E2E 回退测试', { exact: true }).click();

    const MESSAGES = ['E2E 消息一', 'E2E 消息二', 'E2E 消息三', 'E2E 消息四'];
    for (const text of MESSAGES) {
      await window.getByPlaceholder('粘贴对方发来的消息…').fill(text);
      await window.getByRole('button', { name: '添加消息' }).click();
      await expect(window.getByText(text, { exact: true })).toBeVisible();
    }

    const rows = window.locator('[class*="msgRow"]');

    // ---- Edge path: the last message has no "回退" button ----
    await expect(rows.last().getByLabel('回退')).toHaveCount(0);

    // ---- Happy path: revert on the 2nd message shows the correct trailing count ----
    const secondRow = rows.filter({ hasText: 'E2E 消息二' });
    await secondRow.hover();
    await secondRow.getByLabel('回退').click();
    await expect(window.getByText('将删除此消息之后的 2 条消息，此操作无法撤销。确认回退吗？')).toBeVisible();
    await window.getByRole('button', { name: '确认回退' }).click();
    await expect(window.getByText('已回退，删除了 2 条消息')).toBeVisible();

    await expect(window.getByText('E2E 消息一', { exact: true })).toBeVisible();
    await expect(window.getByText('E2E 消息二', { exact: true })).toBeVisible();
    await expect(window.getByText('E2E 消息三', { exact: true })).not.toBeVisible();
    await expect(window.getByText('E2E 消息四', { exact: true })).not.toBeVisible();

    // ---- Verify the deletes were physical, not just a local state update ----
    await window.getByLabel('返回').click();
    await window.getByText('E2E 回退测试', { exact: true }).click();
    await expect(window.getByText('E2E 消息一', { exact: true })).toBeVisible();
    await expect(window.getByText('E2E 消息二', { exact: true })).toBeVisible();
    await expect(window.getByText('E2E 消息三', { exact: true })).not.toBeVisible();
    await expect(window.getByText('E2E 消息四', { exact: true })).not.toBeVisible();
  } finally {
    await electronApp?.close().catch(() => {});
  }
});
