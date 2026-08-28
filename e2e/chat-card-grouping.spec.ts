import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// One continuous scenario (mirrors persona-duplicate.spec.ts, message-delete.spec.ts)
// — collapsing/expanding and the eventual delete all operate on groups
// created earlier in the test, so these aren't independent cases. A second
// card/group ("朋友") stays around after "工作" is deleted specifically so
// the grouped view (and its literal "未分组" bucket) doesn't collapse back
// to the flat, no-groups layout — see chat-group-sections-ui's "全部未分组
// 时展示效果与当前实现一致" rule, which would otherwise hide "未分组" entirely.
test('聊天对象分组完整流程：创建分组 → 分配 → 折叠展开 → 删除回退未分组', async () => {
  test.setTimeout(120_000);

  // A fresh, uniquely-named userData dir per run — this test creates and
  // tears down its own chat cards and groups entirely inside it, so it
  // never depends on what any other test (or a previous run) left behind.
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-grouping-'));
  let electronApp: ElectronApplication | undefined;

  try {
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Setup: card A -> new group "工作", card B -> new group "朋友" ----
    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 分组测试A');
    await window.getByLabel('对方基本信息').fill('用于验证聊天对象分组功能');
    await window.getByRole('button', { name: '+ 新建分组' }).click();
    await window.getByLabel('分组名称').fill('工作');
    await window.getByRole('button', { name: '保存分组' }).click();
    await expect(window.getByText('分组已创建')).toBeVisible();
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();

    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 分组测试B');
    await window.getByLabel('对方基本信息').fill('用于验证聊天对象分组功能');
    await window.getByRole('button', { name: '+ 新建分组' }).click();
    await window.getByLabel('分组名称').fill('朋友');
    await window.getByRole('button', { name: '保存分组' }).click();
    await expect(window.getByText('分组已创建')).toBeVisible();
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();

    // ---- Happy path: the "工作" section exists and contains card A ----
    const workSection = window.locator('[class*="groupSection"]').filter({ hasText: '工作' }).first();
    await expect(workSection.getByText('E2E 分组测试A', { exact: true })).toBeVisible();

    // ---- Collapse "工作": card A hidden, card B (other group) unaffected ----
    await window.getByText('工作', { exact: true }).click();
    await expect(window.getByText('E2E 分组测试A', { exact: true })).not.toBeVisible();
    await expect(window.getByText('E2E 分组测试B', { exact: true })).toBeVisible();

    // ---- Expand again: card A visible ----
    await window.getByText('工作', { exact: true }).click();
    await expect(window.getByText('E2E 分组测试A', { exact: true })).toBeVisible();

    // ---- Edge path: deleting "工作" falls card A back to "未分组", not lost ----
    await window.getByRole('button', { name: '删除工作' }).click();
    await window.getByRole('button', { name: '确认删除' }).click();
    await expect(window.getByText('分组已删除')).toBeVisible();
    await expect(window.getByText('工作', { exact: true })).not.toBeVisible();

    const ungroupedSection = window.locator('[class*="groupSection"]').filter({ hasText: '未分组' }).first();
    await expect(ungroupedSection.getByText('E2E 分组测试A', { exact: true })).toBeVisible();
    // "朋友" is untouched by "工作"'s deletion.
    await expect(window.getByText('E2E 分组测试B', { exact: true })).toBeVisible();
  } finally {
    await electronApp?.close().catch(() => {});
  }
});
