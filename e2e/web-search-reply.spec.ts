import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startMockLlmServer, type MockLlmServerHandle } from './support/mockLlmServer.js';
import { startMockTavilyServer, type MockTavilyServerHandle } from './support/mockTavilyServer.js';

const MAIN_ENTRY = path.resolve(process.cwd(), 'dist-electron/main/index.js');

// The two markers buildReplyPrompt (generateReplies.ts) injects only when
// the web-search flow is active — used here to tell the first-phase
// "decide whether to search" call apart from the second-phase "generate
// with search results" call, instead of relying on raw request counts
// (which would also pick up unrelated background calls like auto-extract
// or history-summarize hitting the same mock server).
const SEARCH_DECISION_MARKER = '【联网判断】';
const SEARCH_RESULTS_MARKER = '【实时搜索结果】';

// One continuous scenario across three phases (time-sensitive → ordinary
// chat → search failure), same shape as full-flow.spec.ts — reusing one
// chat card/model card across phases is both faster (single Electron
// launch) and closer to how a real user would actually hit all three
// paths in one session.
test('联网搜索完整流程：时效性问题触发搜索 → 普通消息不触发 → 搜索失败优雅降级', async () => {
  test.setTimeout(120_000);

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'huichat-e2e-websearch-'));
  let llmMock: MockLlmServerHandle | undefined;
  let tavilyMock: MockTavilyServerHandle | undefined;
  let electronApp: ElectronApplication | undefined;

  try {
    llmMock = await startMockLlmServer(() => 'NONE');
    tavilyMock = await startMockTavilyServer(() => ({ results: [] }));

    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: { ...process.env, E2E_USER_DATA_DIR: userDataDir, E2E_TAVILY_BASE_URL: tavilyMock.url },
    });
    const window: Page = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ---- Point the app at the mock LLM via a model card ----
    await window.getByLabel('模型').click();
    await window.getByRole('button', { name: '新建第一张模型卡片' }).click();
    await window.getByLabel('卡片名称').fill('E2E 模型卡片');
    await window.getByLabel('AI 提供方').selectOption('custom');
    await window.getByLabel('API Endpoint').fill(llmMock.url);
    await window.getByLabel('API Key').fill('sk-mock-1234567890');
    await window.getByLabel('模型名称').fill('mock-model');
    await window.getByRole('button', { name: '保存卡片' }).click();
    await expect(window.getByText('模型卡片已创建')).toBeVisible();
    await window.getByLabel('返回').click();

    // ---- Enable 联网搜索 with a mock key (the mock Tavily server doesn't validate it) ----
    await window.getByLabel('设置').click();
    await window.getByRole('switch', { name: '联网搜索' }).click();
    await expect(window.getByText('设置 Tavily API Key', { exact: true })).toBeVisible();
    await window.getByRole('textbox', { name: 'Tavily API Key' }).fill('tvly-mock-key-1234567890');
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('联网搜索已开启')).toBeVisible();
    await window.getByLabel('返回').click();

    // ---- Create a chat card (persona is optional — skipped to keep this test focused) ----
    await window.getByRole('button', { name: /新建.*聊天对象/ }).first().click();
    await window.getByLabel('对方称呼').fill('E2E 联网测试对象');
    await window.getByLabel('对方基本信息').fill('喜欢聊天气和演出');
    await window.getByRole('button', { name: '保存', exact: true }).click();
    await expect(window.getByText('聊天对象已创建')).toBeVisible();
    await window.getByText('E2E 联网测试对象', { exact: true }).click();
    await window.getByText('真诚', { exact: true }).click();

    // ==================================================================
    // Phase 1: 时效性问题 → 应该触发搜索，最终回复采用搜索结果生成的内容
    // ==================================================================
    let decisionCalls = 0;
    let finalCalls = 0;
    llmMock.setResponder((prompt) => {
      if (prompt.includes(SEARCH_RESULTS_MARKER)) {
        finalCalls += 1;
        return JSON.stringify({
          replies: [
            { text: '明天多云转晴，20到28度，出门不用带伞', translation: null },
            { text: '看了下明天挺舒服的，适合出去走走', translation: null },
            { text: '明天天气不错哦，我们出去玩吧', translation: null },
          ],
        });
      }
      if (prompt.includes(SEARCH_DECISION_MARKER)) {
        decisionCalls += 1;
        return JSON.stringify({
          needsSearch: true,
          searchQuery: '明天天气',
          replies: [
            { text: '兜底回复一', translation: null },
            { text: '兜底回复二', translation: null },
            { text: '兜底回复三', translation: null },
          ],
        });
      }
      return 'NONE';
    });
    let tavilyCalls = 0;
    tavilyMock.setResponder((query) => {
      tavilyCalls += 1;
      expect(query).toContain('天气');
      return { results: [{ title: '天气预报', url: 'https://example.com/weather', content: '明天多云转晴，气温20-28度' }] };
    });

    await window.getByPlaceholder('粘贴对方发来的消息…').fill('明天天气怎么样呀');
    await window.getByRole('button', { name: '添加消息' }).click();
    await window.getByRole('button', { name: '生成回复' }).click();

    await expect(window.getByText('明天多云转晴，20到28度，出门不用带伞')).toBeVisible();
    expect(decisionCalls).toBe(1);
    expect(finalCalls).toBe(1);
    expect(tavilyCalls).toBe(1);

    // ==================================================================
    // Phase 1b: 同一条消息点"生成回复"重新生成（没有新增消息）→ 判断阶段仍
    // 正常调用一次，但应该复用上一次的搜索结果，不再请求 Tavily。这里故意
    // 让第二次判断给出与第一次不同措辞的 searchQuery（真实 LLM 每次给出的
    // 搜索关键词原文基本不会完全一致）——缓存应该按"同一条最后消息"命中，
    // 而不是要求 searchQuery 逐字相同。
    // ==================================================================
    decisionCalls = 0;
    finalCalls = 0;
    llmMock.setResponder((prompt) => {
      if (prompt.includes(SEARCH_RESULTS_MARKER)) {
        finalCalls += 1;
        return JSON.stringify({
          replies: [
            { text: '要不我们明天出去走走，天气挺好的', translation: null },
            { text: '明天天气不错，一起出去吧', translation: null },
            { text: '天气预报说明天挺舒服的', translation: null },
          ],
        });
      }
      if (prompt.includes(SEARCH_DECISION_MARKER)) {
        decisionCalls += 1;
        // Deliberately a *different* searchQuery string than phase 1 used
        // ('明天天气') — the cache must still hit on "same last message",
        // not on matching this text.
        return JSON.stringify({
          needsSearch: true,
          searchQuery: '明天的天气情况',
          replies: [
            { text: '兜底回复一', translation: null },
            { text: '兜底回复二', translation: null },
            { text: '兜底回复三', translation: null },
          ],
        });
      }
      return 'NONE';
    });
    const tavilyCallsBeforeRegenerate = tavilyCalls;
    // Not expected to be hit at all — if the cache didn't work this still
    // responds successfully (rather than erroring the mock server itself)
    // so the failure shows up as a clean assertion below instead of a crash.
    tavilyMock.setResponder(() => {
      tavilyCalls += 1;
      return { results: [{ title: '不应该被调用', url: 'https://example.com', content: '不应该被调用' }] };
    });

    await window.getByRole('button', { name: '生成回复' }).click();

    await expect(window.getByText('要不我们明天出去走走，天气挺好的')).toBeVisible();
    expect(decisionCalls).toBe(1);
    expect(finalCalls).toBe(1);
    expect(tavilyCalls).toBe(tavilyCallsBeforeRegenerate);

    // ==================================================================
    // Phase 2: 普通消息 → needsSearch: false，全程只应发生一次 LLM 调用，
    // 不应该调用 Tavily
    // ==================================================================
    decisionCalls = 0;
    finalCalls = 0;
    llmMock.setResponder((prompt) => {
      if (prompt.includes(SEARCH_RESULTS_MARKER)) {
        finalCalls += 1;
        return JSON.stringify({ replies: [{ text: '不应该走到这里', translation: null }] });
      }
      if (prompt.includes(SEARCH_DECISION_MARKER)) {
        decisionCalls += 1;
        return JSON.stringify({
          needsSearch: false,
          searchQuery: null,
          replies: [
            { text: '在的呀，怎么啦', translation: null },
            { text: '在呢在呢', translation: null },
            { text: '在的，找我啥事', translation: null },
          ],
        });
      }
      return 'NONE';
    });
    const tavilyCallsBeforePhase2 = tavilyCalls;
    tavilyMock.setResponder((query) => {
      tavilyCalls += 1;
      return { results: [{ title: '不应该被调用', url: 'https://example.com', content: query }] };
    });

    await window.getByPlaceholder('粘贴对方发来的消息…').fill('在吗');
    await window.getByRole('button', { name: '添加消息' }).click();
    await window.getByRole('button', { name: '生成回复' }).click();

    await expect(window.getByText('在的呀，怎么啦')).toBeVisible();
    expect(decisionCalls).toBe(1);
    expect(finalCalls).toBe(0);
    expect(tavilyCalls).toBe(tavilyCallsBeforePhase2);

    // ==================================================================
    // Phase 3: 需要搜索但 Tavily 请求失败 → 优雅降级为第一阶段的兜底回复，
    // 不应该再发起第二次 LLM 调用
    // ==================================================================
    decisionCalls = 0;
    finalCalls = 0;
    llmMock.setResponder((prompt) => {
      if (prompt.includes(SEARCH_RESULTS_MARKER)) {
        finalCalls += 1;
        return JSON.stringify({ replies: [{ text: '不应该走到这里', translation: null }] });
      }
      if (prompt.includes(SEARCH_DECISION_MARKER)) {
        decisionCalls += 1;
        return JSON.stringify({
          needsSearch: true,
          searchQuery: '李健 演唱会',
          replies: [
            { text: '这个我得查查，稍等哈', translation: null },
            { text: '不太确定，我帮你搜一下', translation: null },
            { text: '这个我还真不清楚', translation: null },
          ],
        });
      }
      return 'NONE';
    });
    let tavilyCallsPhase3 = 0;
    tavilyMock.setResponder(() => {
      tavilyCallsPhase3 += 1;
      return { error: true, status: 500 };
    });

    await window.getByPlaceholder('粘贴对方发来的消息…').fill('李健什么时候开演唱会呀');
    await window.getByRole('button', { name: '添加消息' }).click();
    await window.getByRole('button', { name: '生成回复' }).click();

    await expect(window.getByText('这个我得查查，稍等哈')).toBeVisible();
    expect(decisionCalls).toBe(1);
    expect(finalCalls).toBe(0);
    expect(tavilyCallsPhase3).toBe(1);

    // ---- Cleanup via the app's own delete flow ----
    await window.getByLabel('返回').click();
    await window.getByLabel('删除', { exact: true }).click();
    await window.getByRole('button', { name: '确认删除' }).click();
    await expect(window.getByText('聊天对象已删除')).toBeVisible();
  } finally {
    await electronApp?.close();
    await llmMock?.close();
    await tavilyMock?.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
