import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';
import { SMART_TONE_ID } from '../electron/shared/tone.js';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// Covers the full smart-tone-mode chain (#027-#029): default selection →
// generate → regenerate → switch to a manual tone → polish a draft. One
// continuous scenario (not isolated cases) because later steps genuinely
// depend on earlier state — e.g. "switch to manual tone" only means
// something once smart mode was already selected and used.
test('智能模式完整流程：默认选中 → 生成回复 → 重新生成 → 切换手动语气 → 润色草稿', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-smart-tone-mode-'));
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

    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 智能语气');
    await window.getByLabel('对方基本信息').fill('25岁，设计师');
    await window.getByLabel('聊天最终目标').fill('发展成恋爱关系');
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();
    await window.getByText('E2E 智能语气', { exact: true }).click();

    await window.getByPlaceholder('粘贴对方发来的消息…').fill('周末有空一起吃饭吗？');
    await window.getByRole('button', { name: '添加消息' }).click();
    await expect(window.getByText('周末有空一起吃饭吗？')).toBeVisible();

    // ---- AC1: 默认选中「智能模式」，渲染顺序第一，"生成回复"无需手动选语气即可点击 ----
    const toneRow = window.locator('text=语气：').locator('..');
    const firstChipText = await toneRow
      .locator('button')
      .filter({ hasText: /智能模式|礼貌|幽默|暧昧|真诚|撒娇|高冷|简洁直接|安慰共情/ })
      .first()
      .textContent();
    expect(firstChipText?.trim()).toBe('智能模式');

    const smartChip = window.getByRole('button', { name: '智能模式' });
    await expect(smartChip).toHaveAttribute('aria-pressed', 'true');
    await expect(window.getByRole('button', { name: '生成回复' })).toBeEnabled();

    // Every generate/polish call's prompt gets captured here so requests can
    // be inspected directly rather than inferred from UI text alone.
    const capturedPrompts: string[] = [];
    let round = 0;
    mock.setResponder((prompt) => {
      capturedPrompts.push(prompt);
      round += 1;
      const label = prompt.includes('润色结果1') ? '润色' : '回复';
      return JSON.stringify({
        replies: [
          { text: `第${round}轮${label}一`, translation: null },
          { text: `第${round}轮${label}二`, translation: null },
          { text: `第${round}轮${label}三`, translation: null },
        ],
      });
    });

    // ---- AC2: 生成回复请求携带智能模式标识，而非具体语气文本；返回 3 条不同候选 ----
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('第1轮回复一')).toBeVisible();
    await expect(window.getByText('第1轮回复二')).toBeVisible();
    await expect(window.getByText('第1轮回复三')).toBeVisible();
    expect(capturedPrompts).toHaveLength(1);
    expect(capturedPrompts[0]).not.toContain(SMART_TONE_ID);
    expect(capturedPrompts[0]).toContain('自动判断最合适的一种语气');
    await expect(window.getByText(/候选回复 · 智能模式/)).toBeVisible();

    // ---- AC3: "重新生成"（同一个"生成回复"按钮）独立发起新一轮请求，返回新内容 ----
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('第2轮回复一')).toBeVisible();
    await expect(window.getByText('第1轮回复一')).not.toBeVisible();
    expect(capturedPrompts).toHaveLength(2);
    expect(capturedPrompts[1]).not.toContain(SMART_TONE_ID);
    expect(capturedPrompts[1]).toContain('自动判断最合适的一种语气');

    // ---- AC4: 切换到手动语气「简洁直接」，「智能模式」变为未选中，后续请求携带该语气文本 ----
    await window.getByText('简洁直接', { exact: true }).click();
    await expect(smartChip).toHaveAttribute('aria-pressed', 'false');
    await expect(window.getByRole('button', { name: '简洁直接' })).toHaveAttribute('aria-pressed', 'true');

    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('第3轮回复一')).toBeVisible();
    expect(capturedPrompts).toHaveLength(3);
    expect(capturedPrompts[2]).not.toContain(SMART_TONE_ID);
    expect(capturedPrompts[2]).not.toContain('自动判断最合适的一种语气');
    expect(capturedPrompts[2]).toContain('简洁直接');
    await expect(window.getByText(/候选回复 · 简洁直接语气/)).toBeVisible();

    // ---- AC5: 智能模式下点击"润色"，请求携带智能模式标识，返回润色结果 ----
    await smartChip.click();
    await expect(smartChip).toHaveAttribute('aria-pressed', 'true');

    await window.getByPlaceholder('用自己的话说出想法，AI 帮你打磨成合适的表达').fill('周末可以呀，去哪吃');
    await window.getByRole('button', { name: '生成回复' }).click();
    await expect(window.getByText('第4轮润色一')).toBeVisible();
    await expect(window.getByText('第4轮润色二')).toBeVisible();
    await expect(window.getByText('第4轮润色三')).toBeVisible();
    expect(capturedPrompts).toHaveLength(4);
    expect(capturedPrompts[3]).not.toContain(SMART_TONE_ID);
    expect(capturedPrompts[3]).toContain('请结合草稿内容与对话上下文，自动判断最合适的语气进行润色');
    await expect(window.getByText(/润色结果 · 智能模式/)).toBeVisible();

    // ---- AC7: 测试自行清理所创建的聊天卡片数据 ----
    await window.getByLabel('返回').click();
    await window.getByLabel('删除', { exact: true }).click();
    await window.getByRole('button', { name: '确认删除' }).click();
    await expect(window.getByText('聊天对象已删除')).toBeVisible();
  } finally {
    await electronApp?.close();
    await mock?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
