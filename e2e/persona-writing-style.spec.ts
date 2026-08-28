import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

const REPLIES_JSON = JSON.stringify({
  replies: [
    { text: '候选回复一', translation: null },
    { text: '候选回复二', translation: null },
    { text: '候选回复三', translation: null },
  ],
});

// One continuous scenario (mirrors full-flow.spec.ts's use of the mock LLM
// server) — the "no style" edge case reuses the same model card and mock
// server set up for the happy path, so these aren't independent tests.
test('角色文字风格完整流程：填写并回显 → 实际写入生成回复 prompt → 未填写时不出现小节', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-persona-style-'));
  let mock: MockLlmServerHandle | undefined;
  let electronApp: ElectronApplication | undefined;

  try {
    mock = await startMockLlmServer(() => 'NONE');

    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Point the app at the mock LLM via a model card ----
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

    // ---- US-001/002 happy path: create a persona with a writing style, and confirm it echoes back on reopen ----
    const STYLE_TEXT = '每句话结尾加个哈哈';
    await window.getByLabel('我的角色').click();
    await window.getByRole('button', { name: '新建角色', exact: true }).click();
    await window.getByLabel('角色名称').fill('E2E 有风格的我');
    await window.getByLabel('角色的基本信息').fill('话不多但真诚');
    await window.getByLabel('文字风格').fill(STYLE_TEXT);
    await window.getByRole('button', { name: '保存角色' }).click();
    await expect(window.getByText('角色已创建')).toBeVisible();

    await window.getByRole('button', { name: '编辑E2E 有风格的我' }).click();
    await expect(window.getByLabel('文字风格')).toHaveValue(STYLE_TEXT);
    await window.getByRole('button', { name: '取消', exact: true }).click();

    // ---- A second persona with no style, for the edge-case assertion below ----
    await window.getByRole('button', { name: '新建角色', exact: true }).click();
    await window.getByLabel('角色名称').fill('E2E 无风格的我');
    await window.getByLabel('角色的基本信息').fill('话不多但真诚');
    await window.getByRole('button', { name: '保存角色' }).click();
    await expect(window.getByText('角色已创建')).toBeVisible();
    await window.getByLabel('返回').click();

    // ---- Chat card using the styled persona ----
    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 小雅');
    await window.getByLabel('对方基本信息').fill('25岁，设计师');
    await window.getByLabel('以哪个角色聊天').selectOption({ label: 'E2E 有风格的我' });
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();

    // ---- Chat card using the style-less persona ----
    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 阿远');
    await window.getByLabel('对方基本信息').fill('30岁，工程师');
    await window.getByLabel('以哪个角色聊天').selectOption({ label: 'E2E 无风格的我' });
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();

    // ---- Happy path: generating a reply for the styled persona's chat card sends a prompt containing the style text ----
    let capturedPrompt = '';
    mock.setResponder((prompt) => {
      if (prompt.includes('候选回复')) {
        capturedPrompt = prompt;
        return REPLIES_JSON;
      }
      return 'NONE';
    });
    await window.getByText('E2E 小雅', { exact: true }).click();
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('候选回复一')).toBeVisible();
    expect(capturedPrompt).toContain('【说话习惯】');
    expect(capturedPrompt).toContain(STYLE_TEXT);
    await window.getByLabel('返回').click();

    // ---- Edge path: the style-less persona's prompt has no 【说话习惯】 section at all ----
    capturedPrompt = '';
    await window.getByText('E2E 阿远', { exact: true }).click();
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('候选回复一')).toBeVisible();
    expect(capturedPrompt).not.toContain('【说话习惯】');
  } finally {
    await electronApp?.close().catch(() => {});
    await mock?.close().catch(() => {});
  }
});
