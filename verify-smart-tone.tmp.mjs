import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const mockCard = {
  id: 1,
  name: '测试对象',
  otherInfo: '',
  avatarPath: null,
  longTermGoal: '',
  shortTermGoal: '',
  personaId: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockPreference = {
  translateNonChinese: true,
  autoAddToHistory: false,
  autoExtractInfo: true,
  darkMode: false,
  updatedAt: 0,
};

const browser = await chromium.launch();
const page = await browser.newPage();

await page.addInitScript(
  ({ card, preference }) => {
    window.api = {
      chatCard: {
        list: async () => [card],
        get: async () => card,
        create: async () => card,
        update: async () => card,
        delete: async () => {},
      },
      persona: {
        listWithUsage: async () => [],
      },
      message: {
        listByChatCard: async () => [],
        insert: async (input) => ({
          id: Date.now(),
          chatCardId: input.chatCardId,
          role: input.role,
          content: input.content ?? '',
          translation: input.translation ?? null,
          annotationType: input.annotationType ?? null,
          annotationText: input.annotationText ?? null,
          createdAt: Date.now(),
        }),
        translate: async (text) => text,
      },
      appPreference: {
        get: async () => preference,
      },
      reply: {
        generate: async () => [],
        polish: async () => [],
      },
      avatar: {
        save: async () => '',
      },
    };
  },
  { card: mockCard, preference: mockPreference },
);

await page.goto(BASE_URL);
await page.getByText('测试对象').click();

await page.waitForSelector('text=语气：');

const chips = await page.locator('button[aria-pressed]').allTextContents();
console.log('Tone chip order:', chips.slice(0, 3));

const smartChip = page.locator('button[aria-pressed]', { hasText: '智能模式' });
const smartActive = await smartChip.getAttribute('aria-pressed');
console.log('Smart mode chip aria-pressed (should be true by default):', smartActive);

const genButton = page.getByRole('button', { name: '生成回复' });
const disabled = await genButton.isDisabled();
console.log('生成回复 button disabled (should be false):', disabled);

await page.screenshot({ path: '/private/tmp/claude-501/-Users-timmy-Desktop-web-dev-ai-chat/d261f202-cd94-4651-ba8c-2c674d480901/scratchpad/before-click.png' });

const conciseChip = page.locator('button[aria-pressed]', { hasText: '简洁直接' });
await conciseChip.click();

const smartActiveAfter = await smartChip.getAttribute('aria-pressed');
const conciseActiveAfter = await conciseChip.getAttribute('aria-pressed');
console.log('After clicking 简洁直接 — smart mode aria-pressed (should be false):', smartActiveAfter);
console.log('After clicking 简洁直接 — 简洁直接 aria-pressed (should be true):', conciseActiveAfter);

await page.screenshot({ path: '/private/tmp/claude-501/-Users-timmy-Desktop-web-dev-ai-chat/d261f202-cd94-4651-ba8c-2c674d480901/scratchpad/after-click.png' });

await browser.close();
