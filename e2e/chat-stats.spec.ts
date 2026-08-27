import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const DAY = 24 * HOUR;

// Three whole calendar days strictly before "today" (local time) — stable
// regardless of what time of day the suite happens to run at, and lines up
// with computeChatStats' local-calendar-day bucketing (chatStatsRepository.ts).
const localMidnight = new Date();
localMidnight.setHours(0, 0, 0, 0);
const dayA = localMidnight.getTime() - 3 * DAY; // "对方" opens the conversation
const dayB = localMidnight.getTime() - 2 * DAY; // "我" opens the conversation
const dayC = localMidnight.getTime() - 1 * DAY; // "对方" opens the conversation

// `insertMessage` (electron/main/db/messageRepository.ts) always stamps
// `created_at: Date.now()` — there's no way to backdate a message through
// the app's own IPC surface. So multi-day stats data is seeded directly
// into the SQLite file from inside the *running Electron main process*
// (via `electronApp.evaluate`), not through the UI — this guarantees the
// `better-sqlite3` native binding loaded there matches the one the app
// itself was rebuilt against (electron-rebuild targets Electron's ABI,
// which usually differs from the Playwright test runner's plain Node ABI).
interface SeedMessage {
  role: 'self' | 'other' | 'annotation';
  createdAt: number;
  content?: string;
  annotationType?: string;
  annotationText?: string;
}

async function seedChatCard(
  electronApp: ElectronApplication,
  input: { name: string; longTermGoal?: string; shortTermGoal?: string; messages: SeedMessage[] },
): Promise<void> {
  await electronApp.evaluate(({ app }, seed) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require('node:path') as typeof import('node:path');
    const db = new Database(nodePath.join(app.getPath('userData'), 'app.db'));
    try {
      const now = Date.now();
      const cardResult = db
        .prepare(
          `INSERT INTO chat_card (name, other_info, avatar_path, long_term_goal, short_term_goal, persona_id, created_at, updated_at)
           VALUES (@name, '', NULL, @longTermGoal, @shortTermGoal, NULL, @now, @now)`,
        )
        .run({ name: seed.name, longTermGoal: seed.longTermGoal ?? '', shortTermGoal: seed.shortTermGoal ?? '', now });
      const chatCardId = cardResult.lastInsertRowid;
      const insertMessage = db.prepare(
        `INSERT INTO message (chat_card_id, role, content, translation, annotation_type, annotation_text, created_at)
         VALUES (@chatCardId, @role, @content, NULL, @annotationType, @annotationText, @createdAt)`,
      );
      for (const message of seed.messages) {
        insertMessage.run({
          chatCardId,
          role: message.role,
          content: message.content ?? '',
          annotationType: message.annotationType ?? null,
          annotationText: message.annotationText ?? null,
          createdAt: message.createdAt,
        });
      }
    } finally {
      db.close();
    }
  }, input);
}

test('聊天统计完整流程：入口 → 核心指标/图表/目标评估 → 空状态 → AI 调用失败', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-chat-stats-'));
  let mock: MockLlmServerHandle | undefined;
  let electronApp: ElectronApplication | undefined;

  try {
    mock = await startMockLlmServer(() => JSON.stringify({ verdict: '部分达成', reason: '对方回应积极，但还没有明确表态。' }));

    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // A model card is required for the goal-evaluation IPC call to have
    // somewhere to send its prompt.
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

    // Card #1: 3 active days, mixed initiators, one annotation (must be
    // excluded), spanning hours 8/9/21 — enough to make every stat non-trivial.
    await seedChatCard(electronApp, {
      name: 'E2E 统计对象',
      longTermGoal: '确认统计功能可用',
      shortTermGoal: '今天先跑通全流程',
      messages: [
        { role: 'other', createdAt: dayA + 9 * HOUR, content: '你好呀' },
        { role: 'self', createdAt: dayA + 9 * HOUR + 30 * MINUTE, content: '嗨，最近怎么样' },
        { role: 'self', createdAt: dayB + 8 * HOUR, content: '早上好' },
        { role: 'other', createdAt: dayB + 8 * HOUR + 10 * MINUTE, content: '早呀' },
        { role: 'annotation', createdAt: dayB + 20 * HOUR, annotationType: '表情', annotationText: '开心' },
        { role: 'other', createdAt: dayC + 21 * HOUR, content: '晚上在干嘛' },
        { role: 'self', createdAt: dayC + 21 * HOUR + 10 * MINUTE, content: '在看书' },
      ],
    });

    // Card #2: no messages at all — the empty-state path.
    await seedChatCard(electronApp, { name: 'E2E 空对象', messages: [] });

    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await expect(window.getByText('E2E 统计对象')).toBeVisible();
    await expect(window.getByText('E2E 空对象')).toBeVisible();

    // ContactCard's name div is a direct child of the card container (which
    // also holds the sibling 统计/编辑/删除 action buttons) — one `..` from
    // the name reaches the card, matching the actual DOM in ContactCard.tsx.
    const cardOf = (name: string) => window.getByText(name, { exact: true }).locator('..');

    // ---- Core metrics + charts + goal evaluation (happy path) ----
    await cardOf('E2E 统计对象').getByLabel('统计').click();

    await expect(window.getByText('聊天统计')).toBeVisible();

    // annotation excluded: 6 real messages split 3 self / 3 other, not 4/3 or 7 total.
    await expect(window.getByText('我发送的消息').locator('..')).toContainText('3');
    await expect(window.getByText('对方发送的消息').locator('..')).toContainText('3');
    await expect(window.getByText('活跃天数').locator('..')).toContainText('3');
    await expect(window.getByText('最长连续聊天天数').locator('..')).toContainText('3');
    await expect(window.getByText('平均每日消息数').locator('..')).toContainText('2');
    await expect(window.getByText('我方主动发起').locator('..')).toContainText('1');
    await expect(window.getByText('对方主动发起').locator('..')).toContainText('2');
    // Longest gap is between day B's 08:10 message and day C's 21:00 message: 1 天 12 小时.
    await expect(window.getByText('最长沉默时间').locator('..')).toContainText('1 天 12 小时');

    // Each chart's bars carry a `title="<label>: <count> 条"` tooltip — scope
    // the count assertions to each section's own <h2> sibling container so
    // the hour chart's bars and the weekday chart's bars aren't conflated.
    const hourSection = window.locator('h2', { hasText: '24 小时消息分布' }).locator('..');
    await expect(hourSection.locator('[title="8: 2 条"]')).toBeVisible();
    await expect(hourSection.locator('[title="9: 2 条"]')).toBeVisible();
    await expect(hourSection.locator('[title="21: 2 条"]')).toBeVisible();
    await expect(hourSection.locator('[title$=": 2 条"]')).toHaveCount(3); // exactly hours 8/9/21

    // day A/B/C are 3 consecutive calendar days → exactly 3 of the 7 weekday
    // bars carry 2 messages each, whichever weekdays those happen to be.
    const weekdaySection = window.locator('h2', { hasText: '星期分布' }).locator('..');
    await expect(weekdaySection.locator('[title$=": 2 条"]')).toHaveCount(3);
    await expect(weekdaySection.locator('[title$=": 0 条"]')).toHaveCount(4);

    await expect(window.getByText('聊天目标达成情况')).toBeVisible();
    await expect(window.getByText('确认统计功能可用')).toBeVisible();
    await expect(window.getByText('今天先跑通全流程')).toBeVisible();
    await expect(window.getByText('部分达成')).toBeVisible({ timeout: 15_000 });
    await expect(window.getByText('对方回应积极，但还没有明确表态。')).toBeVisible();

    // ---- AI call failure: core metrics must stay intact ----
    mock.setResponder(() => ({ error: true, status: 500, message: 'mock upstream failure' }));
    await window.getByLabel('返回').click();
    await cardOf('E2E 统计对象').getByLabel('统计').click();
    await expect(window.getByText('我发送的消息').locator('..')).toContainText('3');
    await expect(window.getByText(/mock upstream failure|LLM 调用失败/)).toBeVisible({ timeout: 15_000 });

    // ---- Empty state ----
    await window.getByLabel('返回').click();
    await cardOf('E2E 空对象').getByLabel('统计').click();
    await expect(window.getByText('暂无聊天记录，还没有可统计的数据')).toBeVisible();
    await expect(window.getByText('24 小时消息分布')).not.toBeVisible();

    // ---- Cleanup: delete both cards this test created ----
    await window.getByLabel('返回').click();
    for (const name of ['E2E 统计对象', 'E2E 空对象']) {
      await cardOf(name).getByLabel('删除', { exact: true }).click();
      await window.getByRole('button', { name: '确认删除' }).click();
      await expect(window.getByText('聊天对象已删除')).toBeVisible();
    }
  } finally {
    await electronApp?.close();
    await mock?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
