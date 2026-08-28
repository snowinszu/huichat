import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';

// Resolved from process.cwd() rather than import.meta.url/__dirname — this
// file is always run via `npm run test:e2e` from the repo root (see the
// script in package.json), and staying off import.meta avoids Playwright's
// TS loader tripping over ESM-only syntax in this project's CJS-default
// package.json.
const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// A single continuous scenario (not several isolated cases) because the AC
// describes one user journey end to end — persona/card/goals through to the
// failure state — where later steps genuinely depend on earlier ones (the
// card must exist before the chat screen does, the persona before the card).
test('完整聊天辅助流程：创建角色/卡片 → 粘贴翻译 → 生成/复制/重新生成 → 失败态 → 清理', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-'));
  let mock: MockLlmServerHandle | undefined;
  let electronApp: ElectronApplication | undefined;

  try {
    // Any prompt not explicitly matched below (e.g. the background
    // auto-info-extraction call, #12 — fires once every AUTO_EXTRACT_BATCH_SIZE
    // messages, not on every insert) gets "NONE" so it never mutates
    // card/persona state mid-test.
    mock = await startMockLlmServer(() => 'NONE');

    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Point the app at the mock LLM instead of a real provider, via a
    // model card (model management moved from the settings page to its own
    // "模型" page — first the single config form, then a model-card list
    // under Settings, and now a standalone page; the first card created
    // auto-becomes the current model, so no separate "set current" step is
    // needed here) ----
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

    // ---- AC1: 创建己方角色、创建引用该角色的聊天对象卡片，设置最终目标与短期目标 ----
    await window.getByLabel('我的角色').click();
    await window.getByRole('button', { name: '新建角色', exact: true }).click();
    await window.getByLabel('角色名称').fill('E2E 真实的我');
    await window.getByLabel('角色的基本信息').fill('话不多但真诚');
    await window.getByRole('button', { name: '保存角色' }).click();
    await expect(window.getByText('角色已创建')).toBeVisible();
    await window.getByLabel('返回').click();

    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 小雅');
    await window.getByLabel('对方基本信息').fill('25岁，设计师');
    await window.getByLabel('聊天最终目标').fill('发展成恋爱关系');
    await window.getByLabel('以哪个角色聊天').selectOption({ label: 'E2E 真实的我' });
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();

    await window.getByText('E2E 小雅', { exact: true }).click();
    const shortTermGoalInput = window.getByPlaceholder('设定本次短期目标…');
    await shortTermGoalInput.fill('约周五晚上见面');
    await shortTermGoalInput.blur();

    // ---- AC2: 粘贴一条非中文消息，断言翻译正确展示 ----
    mock.setResponder((prompt) => {
      if (prompt.includes('将下面的文本翻译成中文')) return '你好，最近怎么样？';
      return 'NONE';
    });
    await window.getByPlaceholder('粘贴对方发来的消息…').fill('Hey, how have you been?');
    await window.getByRole('button', { name: '添加消息' }).click();
    await expect(window.getByText('Hey, how have you been?')).toBeVisible();
    await expect(window.getByText('你好，最近怎么样？')).toBeVisible();

    // ---- AC3: 选择语气，生成 3 条不同候选回复，复制其中一条并断言剪贴板 ----
    mock.setResponder((prompt) => {
      if (prompt.includes('候选回复')) {
        return JSON.stringify({
          replies: [
            { text: '候选回复一', translation: null },
            { text: '候选回复二', translation: null },
            { text: '候选回复三', translation: null },
          ],
        });
      }
      return 'NONE';
    });
    await window.getByText('真诚', { exact: true }).click();
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('候选回复一')).toBeVisible();
    await expect(window.getByText('候选回复二')).toBeVisible();
    await expect(window.getByText('候选回复三')).toBeVisible();

    await window.getByRole('button', { name: '复制', exact: true }).first().click();
    // Reading via Electron's own `clipboard` module (main-process side, through
    // ElectronApplication.evaluate) sidesteps the renderer Clipboard API's
    // permission model entirely — the standard way to assert clipboard writes
    // in Playwright's Electron testing.
    const clipboardText = await electronApp.evaluate(({ clipboard }) => clipboard.readText());
    expect(clipboardText).toBe('候选回复一');

    // ---- AC4: "重新生成" — the dedicated button was later merged into
    // "生成回复" itself (see issue-011's revision notes: clicking it again
    // re-reads the current tone and produces a fresh batch). Assert the
    // displayed candidates actually change content.
    mock.setResponder((prompt) => {
      if (prompt.includes('候选回复')) {
        return JSON.stringify({
          replies: [
            { text: '重新生成一', translation: null },
            { text: '重新生成二', translation: null },
            { text: '重新生成三', translation: null },
          ],
        });
      }
      return 'NONE';
    });
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('重新生成一')).toBeVisible();
    await expect(window.getByText('候选回复一')).not.toBeVisible();

    // ---- AC5: LLM 调用失败（无效 API key）时显示错误状态而非崩溃 ----
    mock.setResponder(() => ({ error: true, status: 401, message: 'Invalid API key provided.' }));
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByRole('button', { name: '重试' })).toBeVisible();
    // Still responsive afterward, not crashed:
    await expect(window.getByText('E2E 小雅')).toBeVisible();
    await expect(window.getByText('真诚', { exact: true })).toBeVisible();

    // ---- AC6 (part 1): clean up the data this test created, via the app's
    // own delete flows — the isolated temp userData dir (removed in
    // `finally`) is the belt-and-suspenders guarantee, this is the
    // behavioral one.
    await window.getByLabel('返回').click();
    await window.getByLabel('删除', { exact: true }).click();
    await window.getByRole('button', { name: '确认删除' }).click();
    await expect(window.getByText('聊天对象已删除')).toBeVisible();

    await window.getByLabel('我的角色').click();
    await window.getByLabel('删除E2E 真实的我').click();
    await window.getByRole('button', { name: '确认删除' }).click();
    await expect(window.getByText('角色已删除')).toBeVisible();
  } finally {
    // ---- AC6 (part 2): temp userData dir means this run never touches —
    // or leaves behind — a real user's SQLite DB or avatar files.
    await electronApp?.close();
    await mock?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
