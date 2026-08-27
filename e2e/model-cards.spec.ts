import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// A models-page list item, scoped by the card name inside it — lets
// assertions ("does this specific card show the 当前模型 badge / a 删除
// button?") target one card without accidentally matching the other.
function cardItem(appWindow: Page, cardName: string) {
  return appWindow.locator(`text=${cardName}`).locator('xpath=ancestor::*[contains(@class,"item")]');
}

// One continuous journey (not isolated cases), same rationale as
// full-flow.spec.ts (#13): later steps genuinely depend on earlier state —
// the "no card yet" guidance can only be observed before any card exists,
// switching current only means something once two cards exist, etc.
test('多模型卡片：无卡片引导 → 创建/自动当前 → 切换当前 → 删除保护 → 清理', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-model-cards-'));
  let mockA: MockLlmServerHandle | undefined;
  let mockB: MockLlmServerHandle | undefined;
  let electronApp: ElectronApplication | undefined;

  try {
    mockA = await startMockLlmServer(() => 'NONE');
    mockB = await startMockLlmServer(() => 'NONE');

    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const appWindow: Page = await electronApp.firstWindow();
    await appWindow.waitForLoadState('domcontentloaded');

    // ---- Set up a chat card to generate replies against (no model card
    // needs to exist yet — chat card creation itself never calls the LLM) ----
    await appWindow.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await appWindow.getByLabel('对方称呼').fill('E2E 模型卡片测试对象');
    await appWindow.getByLabel('对方基本信息').fill('用于验证模型卡片切换');
    await appWindow.getByRole('button', { name: '保存', exact: true }).click();
    await expect(appWindow.getByText('聊天对象已创建')).toBeVisible();
    await appWindow.getByText('E2E 模型卡片测试对象', { exact: true }).click();

    // ---- Edge case: zero model cards exist yet — "生成回复" must show
    // guidance (not crash), and clicking it must actually reach the models page ----
    await appWindow.getByText('真诚', { exact: true }).click();
    await appWindow.getByRole('button', { name: '生成回复' }).click();
    await expect(appWindow.getByText('请先在模型页创建并选择模型')).toBeVisible();
    await expect(appWindow.getByRole('button', { name: '重试' })).not.toBeVisible();
    await appWindow.getByRole('button', { name: '去模型页' }).click();
    await expect(appWindow.getByText('还没有模型卡片')).toBeVisible();

    // ---- Create the first model card — must auto-become current ----
    await appWindow.getByRole('button', { name: '新建第一张模型卡片' }).click();
    await appWindow.getByLabel('卡片名称').fill('E2E 卡片A');
    await appWindow.getByLabel('AI 提供方').selectOption('custom');
    await appWindow.getByLabel('API Endpoint').fill(mockA.url);
    await appWindow.getByLabel('API Key').fill('sk-mock-card-a-1234');
    await appWindow.getByLabel('模型名称').fill('mock-model');
    await appWindow.getByRole('button', { name: '保存卡片' }).click();
    await expect(appWindow.getByText('模型卡片已创建')).toBeVisible();
    await expect(cardItem(appWindow, 'E2E 卡片A').getByText('当前模型', { exact: true })).toBeVisible();

    // ---- Create a second model card — must NOT auto-become current ----
    await appWindow.getByRole('button', { name: '新建模型卡片' }).click();
    await appWindow.getByLabel('卡片名称').fill('E2E 卡片B');
    await appWindow.getByLabel('AI 提供方').selectOption('custom');
    await appWindow.getByLabel('API Endpoint').fill(mockB.url);
    await appWindow.getByLabel('API Key').fill('sk-mock-card-b-5678');
    await appWindow.getByLabel('模型名称').fill('mock-model');
    await appWindow.getByRole('button', { name: '保存卡片' }).click();
    await expect(appWindow.getByText('模型卡片已创建')).toBeVisible();
    await expect(cardItem(appWindow, 'E2E 卡片B').getByText('当前模型', { exact: true })).not.toBeVisible();
    await expect(cardItem(appWindow, 'E2E 卡片A').getByText('当前模型', { exact: true })).toBeVisible();

    // ---- Switch current to card B — the badge must move, not duplicate ----
    await cardItem(appWindow, 'E2E 卡片B').getByRole('button', { name: '设为当前模型' }).click();
    await expect(appWindow.getByText('已切换当前模型为「E2E 卡片B」')).toBeVisible();
    await expect(cardItem(appWindow, 'E2E 卡片B').getByText('当前模型', { exact: true })).toBeVisible();
    await expect(cardItem(appWindow, 'E2E 卡片A').getByText('当前模型', { exact: true })).not.toBeVisible();

    // ---- Generating a reply now must actually hit card B's endpoint, not card A's ----
    mockB.setResponder((prompt) => {
      if (prompt.includes('候选回复')) {
        return JSON.stringify({
          replies: [
            { text: '卡片B回复一', translation: null },
            { text: '卡片B回复二', translation: null },
            { text: '卡片B回复三', translation: null },
          ],
        });
      }
      return 'NONE';
    });
    await appWindow.getByLabel('返回').click();
    await appWindow.getByText('E2E 模型卡片测试对象', { exact: true }).click();
    await appWindow.getByText('真诚', { exact: true }).click();
    await appWindow.getByRole('button', { name: '生成回复' }).click();
    await expect(appWindow.getByText('卡片B回复一')).toBeVisible();
    expect(mockB.requestCount()).toBeGreaterThan(0);
    expect(mockA.requestCount()).toBe(0);

    // ---- Deleting the current card must be blocked. The UI deliberately
    // never renders a delete button for the current card (verified in #16),
    // so exercising "an attempt is blocked" as a black-box scenario means
    // calling the same window.api.modelCard bridge the UI itself calls —
    // this is the app's real, shipped renderer↔main IPC surface, not a
    // testing backdoor, and it's the layer the actual protection lives in
    // (defense in depth, not just a hidden button).
    await appWindow.getByLabel('返回').click();
    await appWindow.getByLabel('模型').click();
    const blockedDeleteMessage = await appWindow.evaluate(async () => {
      const cards = await window.api.modelCard.list();
      const current = cards.find((c) => c.isCurrent);
      if (!current) return 'no current card found';
      try {
        await window.api.modelCard.delete(current.id);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    expect(blockedDeleteMessage).toBe('请先切换当前模型后再删除');
    await expect(appWindow.getByText('E2E 卡片B')).toBeVisible();

    // ---- Cleanup via the app's own delete flows where possible ----
    await appWindow.getByLabel('删除E2E 卡片A').click();
    await appWindow.getByRole('button', { name: '确认删除' }).click();
    await expect(appWindow.getByText('模型卡片已删除')).toBeVisible();

    await appWindow.getByLabel('返回').click();
    await appWindow.getByLabel('删除', { exact: true }).click();
    await appWindow.getByRole('button', { name: '确认删除' }).click();
    await expect(appWindow.getByText('聊天对象已删除')).toBeVisible();
  } finally {
    // The remaining model card (E2E 卡片B) can't be deleted through the app
    // itself — it's the last one left, and the last card is always current,
    // and the current card is never deletable by design. The isolated temp
    // userData dir is what actually guarantees this never touches — or
    // leaves behind — a real user's data, same belt-and-suspenders as #13.
    await electronApp?.close();
    await mockA?.close();
    await mockB?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
