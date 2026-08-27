import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// 330 CJK characters — deliberately does not contain the SUMMARY_MARKER
// text below, since the auto-extract-info feature echoes raw message
// content back into its own prompt and a naive marker could false-positive
// on it.
const LONG_MESSAGE = '呢'.repeat(330);
const SUMMARY_MARKER = '维护一份关于当前聊天记录的历史摘要';

// The outer Playwright page is named `appWindow` (not `window`) specifically
// so that `.evaluate(() => window.api...)` callbacks below unambiguously
// refer to the real browser global — naming it `window` would shadow that
// reference with this outer Page-typed variable under TypeScript's normal
// lexical scoping, even though at runtime Playwright re-serializes the
// callback into the page's own context regardless.
//
// One continuous scenario, matching the shape of this suite's other specs
// (full-flow.spec.ts, message-delete.spec.ts) — later steps build on state
// earlier ones left behind (a chat card must accumulate real history before
// summarization has anything to do).
test('历史摘要与截断完整流程：积累触发摘要 → 生成回复改用摘要+近100条 → 未达阈值不摘要 → 摘要失败不影响生成回复', async () => {
  test.setTimeout(180_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-history-summary-'));
  let mock: MockLlmServerHandle | undefined;
  let electronApp: ElectronApplication | undefined;

  try {
    mock = await startMockLlmServer(() => 'NONE');

    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const appWindow: Page = await electronApp.firstWindow();
    await appWindow.waitForLoadState('domcontentloaded');

    await appWindow.getByLabel('模型').click();
    await appWindow.getByRole('button', { name: '新建第一张模型卡片' }).click();
    await appWindow.getByLabel('卡片名称').fill('E2E 模型卡片');
    await appWindow.getByLabel('AI 提供方').selectOption('custom');
    await appWindow.getByLabel('API Endpoint').fill(mock.url);
    await appWindow.getByLabel('API Key').fill('sk-mock-1234567890');
    await appWindow.getByLabel('模型名称').fill('mock-model');
    await appWindow.getByRole('button', { name: '保存卡片' }).click();
    await expect(appWindow.getByText('模型卡片已创建')).toBeVisible();
    await appWindow.getByLabel('返回').click();

    // ---- Happy path: accumulate enough history to cross both the 100-message
    // retention window and the summarization token threshold ----
    let lastPrompt = '';
    mock.setResponder((prompt) => {
      if (prompt.includes(SUMMARY_MARKER)) return '摘要：早期聊了一段无关紧要的长话题。';
      if (prompt.includes('候选回复')) {
        lastPrompt = prompt;
        return JSON.stringify({ replies: [{ text: 'E2E候选回复', translation: null }] });
      }
      return 'NONE';
    });

    const chatCardId = await appWindow.evaluate(async () => {
      const card = await window.api.chatCard.create({ name: 'E2E 历史摘要', otherInfo: '', longTermGoal: '', shortTermGoal: '', personaId: null });
      return card.id;
    });

    // 11 long messages (~330 tokens each) followed by enough short filler to
    // push them outside the 100-message retention window and cross the
    // ~3000-token summarization threshold.
    await appWindow.evaluate(
      async ({ id, longMessage }) => {
        for (let i = 0; i < 11; i++) {
          await window.api.message.insert({ chatCardId: id, role: 'other', content: `${longMessage}(${i})` });
        }
        for (let i = 0; i < 99; i++) {
          await window.api.message.insert({ chatCardId: id, role: 'other', content: `填充${i}` });
        }
      },
      { id: chatCardId, longMessage: LONG_MESSAGE },
    );
    // A few more one-at-a-time inserts to make sure the token estimate has
    // crossed the trigger threshold by the time we check.
    await appWindow.evaluate(async (id) => {
      for (let i = 0; i < 10; i++) {
        await window.api.message.insert({ chatCardId: id, role: 'other', content: `补充${i}` });
      }
    }, chatCardId);
    await appWindow.waitForTimeout(500);

    const cardAfterSummaryOrUndefined = await appWindow.evaluate(async (id) => window.api.chatCard.get(id), chatCardId);
    expect(cardAfterSummaryOrUndefined).toBeDefined();
    const cardAfterSummary = cardAfterSummaryOrUndefined!;
    expect(cardAfterSummary.historySummary).not.toBe('');
    expect(cardAfterSummary.summarizedThroughMessageId).not.toBeNull();

    const messages = await appWindow.evaluate(async (id) => window.api.message.listByChatCard(id), chatCardId);
    const longMessageIds = messages.slice(0, 11).map((m) => m.id);
    expect(longMessageIds).toContain(cardAfterSummary.summarizedThroughMessageId);

    // Trigger 生成回复 and inspect the actual prompt sent: must include the
    // summary, must include the most recent (window-covered) message, must
    // NOT include the earliest raw message (now folded into the summary).
    await appWindow.evaluate(async (id) => window.api.reply.generate({ chatCardId: id, tone: '真诚' }), chatCardId);
    expect(lastPrompt).toContain('【更早的对话摘要】');
    expect(lastPrompt).toContain(cardAfterSummary.historySummary);
    expect(lastPrompt).not.toContain(`${LONG_MESSAGE}(0)`);
    expect(lastPrompt).toContain('补充9');

    // ---- Edge path: over 100 messages but never enough estimated tokens to
    // cross the summarization threshold — no summary should ever be produced,
    // and the reply-generation prompt still gets truncated to the most recent
    // 100 messages (see issue #45) even with no summary text to show for it ----
    const smallChatCardId = await appWindow.evaluate(async () => {
      const card = await window.api.chatCard.create({ name: 'E2E 未达阈值', otherInfo: '', longTermGoal: '', shortTermGoal: '', personaId: null });
      return card.id;
    });
    await appWindow.evaluate(async (id) => {
      for (let i = 0; i < 120; i++) {
        await window.api.message.insert({ chatCardId: id, role: 'other', content: `短${i}` });
      }
    }, smallChatCardId);
    await appWindow.waitForTimeout(300);

    const smallCard = await appWindow.evaluate(async (id) => window.api.chatCard.get(id), smallChatCardId);
    expect(smallCard?.historySummary).toBe('');

    await appWindow.evaluate(async (id) => window.api.reply.generate({ chatCardId: id, tone: '真诚' }), smallChatCardId);
    expect(lastPrompt).toContain('【聊天记录】');
    expect(lastPrompt).not.toContain('【更早的对话摘要】');
    expect(lastPrompt).not.toContain('短0'); // beyond the 100-message window
    expect(lastPrompt).toContain('短119'); // within the window

    // ---- Edge path: the summarization LLM call fails outright — must not
    // affect 生成回复, which should still succeed normally ----
    mock.setResponder((prompt) => {
      if (prompt.includes(SUMMARY_MARKER)) return { error: true, status: 500, message: 'summary provider down' };
      if (prompt.includes('候选回复')) return JSON.stringify({ replies: [{ text: '失败场景仍可回复', translation: null }] });
      return 'NONE';
    });

    const failureChatCardId = await appWindow.evaluate(async () => {
      const card = await window.api.chatCard.create({ name: 'E2E 摘要失败', otherInfo: '', longTermGoal: '', shortTermGoal: '', personaId: null });
      return card.id;
    });
    await appWindow.evaluate(
      async ({ id, longMessage }) => {
        for (let i = 0; i < 11; i++) {
          await window.api.message.insert({ chatCardId: id, role: 'other', content: `${longMessage}(${i})` });
        }
        for (let i = 0; i < 109; i++) {
          await window.api.message.insert({ chatCardId: id, role: 'other', content: `填充${i}` });
        }
      },
      { id: failureChatCardId, longMessage: LONG_MESSAGE },
    );
    await appWindow.waitForTimeout(500);

    const failureCard = await appWindow.evaluate(async (id) => window.api.chatCard.get(id), failureChatCardId);
    expect(failureCard?.historySummary).toBe(''); // the failed summary call never wrote anything

    const replyAfterFailure = await appWindow.evaluate(
      async (id) => window.api.reply.generate({ chatCardId: id, tone: '真诚' }),
      failureChatCardId,
    );
    expect(replyAfterFailure).toEqual([{ text: '失败场景仍可回复', translation: null }]);
  } finally {
    await electronApp?.close().catch(() => {});
    await mock?.close().catch(() => {});
  }
});
