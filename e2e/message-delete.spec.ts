import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// One continuous scenario (not several isolated `test()`s) mirrors the other
// specs in this suite (full-flow.spec.ts, chat-stats.spec.ts) — later steps
// genuinely depend on earlier ones (a message must exist before it can be
// deleted, the chat card must exist before its messages do).
test('消息删除完整流程：添加 → 取消删除保留 → 确认删除 → 重新加载验证已从数据库清除', async () => {
  test.setTimeout(120_000);

  // A fresh, uniquely-named userData dir per run — this test creates and
  // tears down its own chat card entirely inside it, so it never depends on
  // what any other test (or a previous run) left behind.
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-delete-'));
  let electronApp: ElectronApplication | undefined;

  try {
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Setup: a chat card with one "对方" message and one "我" message ----
    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 删除测试');
    await window.getByLabel('对方基本信息').fill('用于验证消息删除功能');
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();
    await window.getByText('E2E 删除测试', { exact: true }).click();

    const OTHER_TEXT = 'E2E 对方消息-可撤回';
    const SELF_TEXT = 'E2E 我的消息-可撤回';

    await window.getByPlaceholder('粘贴对方发来的消息…').fill(OTHER_TEXT);
    await window.getByRole('button', { name: '添加消息' }).click();
    await expect(window.getByText(OTHER_TEXT, { exact: true })).toBeVisible();

    await window.getByLabel('发送方').selectOption('self');
    await window.getByPlaceholder('输入我主动发起的消息…').fill(SELF_TEXT);
    await window.getByRole('button', { name: '添加消息' }).click();
    await expect(window.getByText(SELF_TEXT, { exact: true })).toBeVisible();

    const rows = window.locator('[class*="msgRow"]');
    const otherRow = rows.filter({ hasText: OTHER_TEXT });
    const selfRow = rows.filter({ hasText: SELF_TEXT });

    // ---- Edge path: open the confirm dialog, then cancel — message must survive ----
    await otherRow.hover();
    await otherRow.getByLabel('删除消息').click();
    await expect(window.getByText('删除这条消息')).toBeVisible();
    await window.getByRole('button', { name: '取消' }).click();
    await expect(window.getByText(OTHER_TEXT, { exact: true })).toBeVisible();

    // ---- Happy path: delete both messages for real ----
    await otherRow.hover();
    await otherRow.getByLabel('删除消息').click();
    await window.getByRole('button', { name: '确认删除' }).click();
    await expect(window.getByText(OTHER_TEXT, { exact: true })).not.toBeVisible();

    await selfRow.hover();
    await selfRow.getByLabel('删除消息').click();
    await window.getByRole('button', { name: '确认删除' }).click();
    await expect(window.getByText(SELF_TEXT, { exact: true })).not.toBeVisible();

    // ---- Verify the deletes were physical, not just a local state update:
    // leave the chat screen and come back, which re-fetches via
    // message.listByChatCard from scratch. ----
    await window.getByLabel('返回').click();
    await window.getByText('E2E 删除测试', { exact: true }).click();
    await expect(window.getByText('还没有消息，粘贴对方发来的第一条消息开始吧')).toBeVisible();
    await expect(window.getByText(OTHER_TEXT, { exact: true })).not.toBeVisible();
    await expect(window.getByText(SELF_TEXT, { exact: true })).not.toBeVisible();
  } finally {
    await electronApp?.close().catch(() => {});
  }
});
