import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// One continuous scenario (mirrors message-delete.spec.ts, full-flow.spec.ts)
// — the second-duplicate step genuinely depends on the first having already
// created "测试角色副本", so this isn't several independent cases.
test('角色复制完整流程：创建角色 → 复制 → 副本独立且命名去重', async () => {
  test.setTimeout(120_000);

  // A fresh, uniquely-named userData dir per run — this test creates and
  // tears down its own persona entirely inside it, so it never depends on
  // what any other test (or a previous run) left behind.
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-persona-duplicate-'));
  let electronApp: ElectronApplication | undefined;

  try {
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Setup: one persona to duplicate ----
    await window.getByLabel('我的角色').click();
    await window.getByRole('button', { name: '新建角色', exact: true }).click();
    await window.getByLabel('角色名称').fill('测试角色');
    await window.getByLabel('角色的基本信息').fill('用于验证角色复制功能');
    await window.getByRole('button', { name: '保存角色' }).click();
    await expect(window.getByText('角色已创建')).toBeVisible();

    // ---- Happy path: duplicate once, assert the copy and the original both exist ----
    await window.getByRole('button', { name: '复制测试角色', exact: true }).click();
    await expect(window.getByText('角色已复制')).toBeVisible();

    const copyCard = window.locator('[class*="item"]').filter({ hasText: '测试角色副本' }).filter({ hasNotText: '副本2' });
    await expect(copyCard.getByText('测试角色副本', { exact: true })).toBeVisible();
    await expect(copyCard.getByText('用于验证角色复制功能', { exact: true })).toBeVisible();
    await expect(copyCard.getByText('暂未使用')).toBeVisible();

    // Original is untouched — same name, same bio, still present.
    await expect(window.getByText('测试角色', { exact: true })).toBeVisible();
    await expect(window.locator('[class*="item"]')).toHaveCount(2);

    // ---- Edge path: duplicating the original again must dedupe the name ----
    await window.getByRole('button', { name: '复制测试角色', exact: true }).click();
    await expect(window.getByText('角色已复制')).toBeVisible();
    await expect(window.getByText('测试角色副本2', { exact: true })).toBeVisible();
    await expect(window.locator('[class*="item"]')).toHaveCount(3);

    // The first copy must be untouched by the second duplication.
    await expect(window.getByText('测试角色副本', { exact: true })).toBeVisible();
  } finally {
    await electronApp?.close().catch(() => {});
  }
});
