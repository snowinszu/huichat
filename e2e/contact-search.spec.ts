import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// One continuous scenario (mirrors chat-card-grouping.spec.ts) — the
// no-match and clear-to-restore assertions all build on the same two
// contacts created at the top, so these aren't independent cases.
test('聊天对象搜索完整流程：过滤 → 展平分组 → 无匹配空状态 → 清空恢复', async () => {
  test.setTimeout(120_000);

  // A fresh, uniquely-named userData dir per run — this test creates and
  // tears down its own chat cards and groups entirely inside it, so it
  // never depends on what any other test (or a previous run) left behind.
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-search-'));
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
    await window.getByLabel('对方称呼').fill('E2E 搜索测试小雅');
    await window.getByLabel('对方基本信息').fill('用于验证聊天对象搜索功能');
    await window.getByRole('button', { name: '+ 新建分组' }).click();
    await window.getByLabel('分组名称').fill('工作');
    await window.getByRole('button', { name: '保存分组' }).click();
    await expect(window.getByText('分组已创建')).toBeVisible();
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();

    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 搜索测试阿远');
    await window.getByLabel('对方基本信息').fill('用于验证聊天对象搜索功能');
    await window.getByRole('button', { name: '+ 新建分组' }).click();
    await window.getByLabel('分组名称').fill('朋友');
    await window.getByRole('button', { name: '保存分组' }).click();
    await expect(window.getByText('分组已创建')).toBeVisible();
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();

    // ---- Happy path: typing a partial nickname filters and flattens groups ----
    await window.getByPlaceholder('搜索昵称').fill('小雅');
    await expect(window.getByText('E2E 搜索测试小雅', { exact: true })).toBeVisible();
    await expect(window.getByText('E2E 搜索测试阿远', { exact: true })).not.toBeVisible();
    await expect(window.getByText('工作', { exact: true })).not.toBeVisible();

    // ---- Edge path: a keyword that matches nothing shows the no-results empty state ----
    await window.getByPlaceholder('搜索昵称').fill('不存在的名字xyz');
    await expect(window.getByText('未找到匹配的聊天对象')).toBeVisible();
    await expect(window.getByText('还没有聊天对象')).not.toBeVisible();
    // The no-results empty state itself carries no create CTA (unlike the
    // "no contacts at all" empty state's "新建第一个聊天对象" button) — the
    // persistent header "新建聊天对象" button is a separate, unrelated control.
    await expect(window.getByRole('button', { name: '新建第一个聊天对象' })).not.toBeVisible();

    // ---- Clearing the search restores the grouped view ----
    await window.getByRole('button', { name: '清空搜索' }).click();
    await expect(window.getByPlaceholder('搜索昵称')).toHaveValue('');
    await expect(window.getByText('工作', { exact: true })).toBeVisible();
    await expect(window.getByText('E2E 搜索测试小雅', { exact: true })).toBeVisible();
    await expect(window.getByText('E2E 搜索测试阿远', { exact: true })).toBeVisible();
  } finally {
    await electronApp?.close().catch(() => {});
  }
});
