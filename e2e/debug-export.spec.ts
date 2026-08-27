import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// One continuous scenario, same shape as full-flow.spec.ts / message-delete.spec.ts —
// each step's assertions build on state the previous step left behind
// (enabling export before generating, disabling before the "no new files"
// check, deleting the directory before the "still works" check).
test('提示词调试导出完整流程：开启导出 → 落盘文件 → 关闭后不再导出 → 目录被删不影响生成', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-debugexport-'));
  const exportDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-debugexport-out-'));
  let mock: MockLlmServerHandle | undefined;
  let electronApp: ElectronApplication | undefined;

  try {
    mock = await startMockLlmServer((prompt) => {
      if (prompt.includes('候选回复')) {
        return JSON.stringify({ replies: [{ text: 'E2E 候选回复', translation: null }] });
      }
      return 'NONE';
    });

    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Point the app at the mock LLM ----
    await window.getByLabel('模型').click();
    await window.getByRole('button', { name: '新建第一张模型卡片' }).click();
    await window.getByLabel('卡片名称').fill('E2E 模型卡片');
    await window.getByLabel('AI 提供方').selectOption('custom');
    await window.getByLabel('API Endpoint').fill(mock.url);
    await window.getByLabel('API Key').fill('sk-mock-1234567890');
    await window.getByLabel('模型名称').fill('mock-model');
    await window.getByRole('button', { name: '保存卡片' }).click();
    await expect(window.getByText('模型卡片已创建')).toBeVisible();
    await window.getByLabel('返回').click();

    // ---- Enable debug export: a real native directory dialog can't be
    // driven by Playwright, so the main process's dialog.showOpenDialog is
    // stubbed to return our real temp dir — this still exercises the actual
    // IPC channel, preload bridge, and settings UI, only the OS chrome
    // itself is swapped out. ----
    await electronApp.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
    }, exportDir);
    await window.getByLabel('设置').click();
    await window.getByRole('switch', { name: '导出提示词调试日志' }).click();
    await expect(window.getByText(exportDir, { exact: true })).toBeVisible();
    await window.getByLabel('返回').click();

    // ---- Trigger a real LLM interaction and check a file actually landed ----
    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('调试导出测试');
    await window.getByLabel('对方基本信息').fill('用于验证调试导出功能');
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await window.getByText('调试导出测试', { exact: true }).click();
    await window.getByPlaceholder('粘贴对方发来的消息…').fill('E2E 触发调试导出的消息');
    await window.getByRole('button', { name: '添加消息' }).click();
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('E2E 候选回复')).toBeVisible();

    const filesAfterEnabled = readdirSync(exportDir);
    const replyGenerateFile = filesAfterEnabled.find((name) => name.includes('生成回复'));
    expect(replyGenerateFile).toBeDefined();

    const content = readFileSync(path.join(exportDir, replyGenerateFile!), 'utf8');
    expect(content).toContain('生成回复');
    expect(content).toContain('custom');
    expect(content).toContain('mock-model');
    expect(content).toContain('E2E 触发调试导出的消息');
    expect(content).toContain('E2E 候选回复');
    expect(content).not.toContain('sk-mock-1234567890');

    // ---- Edge path: turning the toggle off must stop producing files ----
    await window.getByLabel('返回').click();
    await window.getByLabel('设置').click();
    await window.getByRole('switch', { name: '导出提示词调试日志' }).click();
    await expect(window.getByRole('switch', { name: '导出提示词调试日志' })).toHaveAttribute('aria-checked', 'false');
    await window.getByLabel('返回').click();

    const fileCountBeforeDisabledGenerate = readdirSync(exportDir).length;
    await window.getByText('调试导出测试', { exact: true }).click();
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('E2E 候选回复')).toBeVisible();
    expect(readdirSync(exportDir).length).toBe(fileCountBeforeDisabledGenerate);

    // ---- Edge path: directory physically removed must not break the actual feature ----
    await window.getByLabel('返回').click();
    await window.getByLabel('设置').click();
    await window.getByRole('switch', { name: '导出提示词调试日志' }).click(); // re-enable, directory already saved
    await expect(window.getByRole('switch', { name: '导出提示词调试日志' })).toHaveAttribute('aria-checked', 'true');
    await window.getByLabel('返回').click();

    rmSync(exportDir, { recursive: true, force: true });
    await window.getByText('调试导出测试', { exact: true }).click();
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('E2E 候选回复')).toBeVisible();
  } finally {
    await electronApp?.close().catch(() => {});
    await mock?.close().catch(() => {});
    rmSync(exportDir, { recursive: true, force: true });
  }
});
