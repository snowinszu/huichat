import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// One continuous journey (same rationale as #13/#19): later steps genuinely
// depend on earlier state — the toggles must be flipped before the actions
// they gate are exercised, and the models/settings split only means
// something if both pages are visited in the same run.
test('设置/模型页拆分 + 偏好开关：模型页仍可用 → 设置页无模型内容 → 三个开关真正生效', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-settings-preferences-'));
  let mock: MockLlmServerHandle | undefined;
  let electronApp: ElectronApplication | undefined;

  // Counted from inside the responder (this process, not the app's) so they
  // measure "was this specific kind of LLM call ever made" independent of
  // whatever else might be hitting the same mock endpoint.
  let translateRequests = 0;
  let extractionRequests = 0;

  try {
    mock = await startMockLlmServer((prompt) => {
      if (prompt.includes('将下面的文本翻译成中文')) {
        translateRequests++;
        return '你好啊，我的朋友';
      }
      // buildExtractPrompt's fixed opening line (electron/main/llm/extractInfo.ts) —
      // matching on it lets this responder tell an extraction call apart from
      // a translate or reply-generation call without needing three servers.
      if (prompt.includes('你在帮用户维护一份关于')) {
        extractionRequests++;
        return '不应被提取的虚假信息';
      }
      if (prompt.includes('候选回复')) {
        return JSON.stringify({
          replies: [
            { text: 'E2E候选回复一', translation: null },
            { text: 'E2E候选回复二', translation: null },
          ],
        });
      }
      return 'NONE';
    });

    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const appWindow: Page = await electronApp.firstWindow();
    await appWindow.waitForLoadState('domcontentloaded');

    // ---- AC1: 模型页仍可完成创建模型卡片 ----
    await appWindow.getByLabel('模型').click();
    await appWindow.getByRole('button', { name: '新建第一张模型卡片' }).click();
    await appWindow.getByLabel('卡片名称').fill('E2E 偏好测试模型');
    await appWindow.getByLabel('AI 提供方').selectOption('custom');
    await appWindow.getByLabel('API Endpoint').fill(mock.url);
    await appWindow.getByLabel('API Key').fill('sk-mock-pref-1234');
    await appWindow.getByLabel('模型名称').fill('mock-model');
    await appWindow.getByRole('button', { name: '保存卡片' }).click();
    await expect(appWindow.getByText('模型卡片已创建')).toBeVisible();
    await appWindow.getByLabel('返回').click();

    // ---- AC1: 设置页不出现任何模型卡片相关内容 ----
    await appWindow.getByLabel('设置').click();
    await expect(appWindow.getByText('翻译非中文消息')).toBeVisible();
    await expect(appWindow.getByText('E2E 偏好测试模型')).not.toBeVisible();
    await expect(appWindow.getByText('新建模型卡片')).not.toBeVisible();

    // ---- Flip the three toggles this test covers, in one settings visit ----
    await appWindow.getByRole('switch', { name: '翻译非中文消息' }).click(); // on -> off
    await appWindow.getByRole('switch', { name: '生成时自动添加到历史' }).click(); // off -> on
    await appWindow.getByRole('switch', { name: '自动信息提取' }).click(); // on -> off
    await expect(appWindow.getByRole('switch', { name: '翻译非中文消息' })).toHaveAttribute('aria-checked', 'false');
    await expect(appWindow.getByRole('switch', { name: '生成时自动添加到历史' })).toHaveAttribute('aria-checked', 'true');
    await expect(appWindow.getByRole('switch', { name: '自动信息提取' })).toHaveAttribute('aria-checked', 'false');
    await appWindow.getByLabel('返回').click();

    // ---- Set up a chat card carrying a known baseline otherInfo, so a
    // later extraction (if it wrongly ran) would be visible as a change ----
    await appWindow.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await appWindow.getByLabel('对方称呼').fill('E2E 偏好测试对象');
    await appWindow.getByLabel('对方基本信息').fill('初始资料，未被修改');
    await appWindow.getByRole('button', { name: '保存', exact: true }).click();
    await expect(appWindow.getByText('聊天对象已创建')).toBeVisible();
    await appWindow.getByText('E2E 偏好测试对象', { exact: true }).click();

    // ---- AC2 + AC4: paste a non-Chinese message with both 翻译 and
    // 自动信息提取 off — no translation block, no translate call, no
    // extraction call ----
    await appWindow.getByPlaceholder('粘贴对方发来的消息…').fill('Hello there, my friend!');
    await appWindow.getByRole('button', { name: '添加消息' }).click();
    await expect(appWindow.getByText('Hello there, my friend!')).toBeVisible();
    await expect(appWindow.getByText('你好啊，我的朋友')).not.toBeVisible();
    expect(translateRequests).toBe(0);
    expect(extractionRequests).toBe(0);

    // ---- AC3: 生成时自动添加到历史 on — "复制" also inserts into the thread ----
    await appWindow.getByText('真诚', { exact: true }).click();
    await appWindow.getByRole('button', { name: '生成回复' }).click();
    await expect(appWindow.getByText('E2E候选回复一')).toBeVisible();
    await appWindow.getByRole('button', { name: '复制', exact: true }).first().click();
    await expect(appWindow.getByText('已加入对话并复制')).toBeVisible();
    // The candidate text now appears twice: once in the candidate card
    // itself, once as a real message bubble in the thread above it.
    await expect(appWindow.getByText('E2E候选回复一')).toHaveCount(2);

    // ---- AC4 (continued): confirm no extraction ever touched the card's
    // otherInfo, via the home grid's card preview (which renders otherInfo
    // directly) — two messages have now been inserted (the pasted one and
    // the auto-added reply), either of which would have changed this had
    // the toggle not actually gated the background call ----
    await appWindow.getByLabel('返回').click();
    await expect(appWindow.getByText('初始资料，未被修改')).toBeVisible();
    expect(extractionRequests).toBe(0);

    // ---- Cleanup via the app's own delete flow ----
    await appWindow.getByLabel('删除', { exact: true }).click();
    await appWindow.getByRole('button', { name: '确认删除' }).click();
    await expect(appWindow.getByText('聊天对象已删除')).toBeVisible();
  } finally {
    // The one model card created here is the last remaining (and therefore
    // always current) one — same accepted, disclosed limitation as #19: it
    // can't be deleted through the app itself. The isolated temp userData
    // dir is what actually guarantees this run never touches — or leaves
    // behind — a real user's data.
    await electronApp?.close();
    await mock?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
