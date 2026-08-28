import { dialog, ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import { insertMessage, listMessagesByChatCard, deleteMessage, revertToMessage } from '../db/messageRepository.js';
import { createChatCard, getChatCard, listChatCards, updateChatCard, deleteChatCard } from '../db/chatCardRepository.js';
import { computeChatStats } from '../db/chatStatsRepository.js';
import { getSettings, saveSettings } from '../db/settingsRepository.js';
import { getAppPreference, updateAppPreference } from '../db/appPreferenceRepository.js';
import { getAppLockStatus, setAppLockPassword, verifyAppLockPassword, clearAppLockPassword } from '../db/appLockRepository.js';
import { isAppLocked, setAppLocked } from '../appLockState.js';
import { resetAppData } from '../db/resetRepository.js';
import {
  createPersona,
  getPersona,
  listPersonasWithUsage,
  updatePersona,
  deletePersona,
  duplicatePersona,
} from '../db/personaRepository.js';
import { createGroup, listGroupsWithUsage, renameGroup, deleteGroup } from '../db/groupRepository.js';
import {
  createModelCard,
  deleteModelCard,
  getCurrentModelCard,
  listModelCards,
  setCurrentModelCard,
  updateModelCard,
} from '../db/modelCardRepository.js';
import { saveAvatar } from '../avatarStorage.js';
import { callLlm } from '../llm/client.js';
import type { DebugExportContext } from '../debugExport.js';
import { buildReplyPrompt, parseGenerateRepliesResponse, parseReplies } from '../llm/generateReplies.js';
import { buildPolishPrompt } from '../llm/polishDraft.js';
import { searchWeb, formatSearchResults } from '../llm/webSearch.js';
import { getCachedSearchResults, setCachedSearchResults } from '../llm/searchCache.js';
import { buildGoalEvaluationPrompt, parseGoalEvaluation } from '../llm/evaluateGoal.js';
import { maybeExtractInfo } from '../llm/extractInfo.js';
import { maybeSummarizeHistory } from '../llm/summarizeHistory.js';
import { IPC_CHANNELS } from '../../shared/ipc-types.js';
import { NO_CURRENT_MODEL_CARD_MESSAGE } from '../../shared/errors.js';
import type {
  ChatCardRecord,
  CreateChatCardInput,
  CreateGroupInput,
  CreatePersonaInput,
  CreateModelCardInput,
  GenerateRepliesInput,
  InsertMessageInput,
  MessageRecord,
  ModelCardRecord,
  PersonaRecord,
  PolishDraftInput,
  SaveSettingsInput,
  UpdateAppPreferenceInput,
  UpdateChatCardInput,
  UpdateModelCardInput,
  UpdatePersonaInput,
} from '../../shared/ipc-types.js';

/** The card/persona/history/current-model bundle every LLM-backed reply feature (generate, polish, …) needs to build its prompt. */
function loadChatContext(
  db: Database.Database,
  chatCardId: number,
): { card: ChatCardRecord; persona: PersonaRecord | undefined; messages: MessageRecord[]; modelCard: ModelCardRecord } {
  const card = getChatCard(db, chatCardId);
  if (!card) throw new Error('聊天对象不存在');

  const persona = card.personaId ? getPersona(db, card.personaId) : undefined;
  const messages = listMessagesByChatCard(db, chatCardId);
  const modelCard = getCurrentModelCard(db);
  if (!modelCard) throw new Error(NO_CURRENT_MODEL_CARD_MESSAGE);

  return { card, persona, messages, modelCard };
}

/** Every `callLlm` call site builds its debug-export context the same way — read the current preference, label the interaction with what triggered it. */
function debugExportContextFor(db: Database.Database, source: string): DebugExportContext {
  const preference = getAppPreference(db);
  return { source, enabled: preference.debugPromptExport, dir: preference.debugExportDir };
}

/** Wires every IPC channel the preload bridge exposes to its main-process handler. Call once, after initDatabase(). */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.messageInsert, (_event, input: InsertMessageInput) => {
    const db = getDatabase();
    const message = insertMessage(db, input);
    // Fire-and-forget: extraction runs an LLM call of its own, which must
    // never delay the paste/reply flow the user is actually waiting on.
    // Gated behind the "自动信息提取" preference — off means this never runs.
    // maybeExtractInfo itself no-ops unless the chat card's message count
    // has just hit a multiple of AUTO_EXTRACT_BATCH_SIZE, so this is safe
    // (and cheap) to call after every single insert.
    if (getAppPreference(db).autoExtractInfo) {
      maybeExtractInfo(db, message.chatCardId).catch((error: unknown) => {
        console.error('[info-extraction] failed for chat card', message.chatCardId, error);
      });
    }
    // Fire-and-forget, same reasoning as extraction above — no preference
    // gate here, though: unlike extraction, this exists to keep prompts from
    // growing unbounded, so it's always on. maybeSummarizeHistory no-ops
    // itself unless the chat card is actually over the retention window with
    // enough unsummarized backlog, so this is safe and cheap to call after
    // every single insert.
    maybeSummarizeHistory(db, message.chatCardId).catch((error: unknown) => {
      console.error('[history-summary] failed for chat card', message.chatCardId, error);
    });
    return message;
  });
  ipcMain.handle(IPC_CHANNELS.messageListByChatCard, (_event, chatCardId: number) =>
    listMessagesByChatCard(getDatabase(), chatCardId),
  );
  ipcMain.handle(IPC_CHANNELS.messageDelete, (_event, messageId: number) => deleteMessage(getDatabase(), messageId));
  ipcMain.handle(IPC_CHANNELS.messageRevert, (_event, messageId: number) => revertToMessage(getDatabase(), messageId));
  ipcMain.handle(IPC_CHANNELS.messageTranslate, async (_event, text: string) => {
    const db = getDatabase();
    const modelCard = getCurrentModelCard(db);
    if (!modelCard) throw new Error(NO_CURRENT_MODEL_CARD_MESSAGE);
    const translation = await callLlm(
      { provider: modelCard.provider, apiKey: modelCard.apiKey, model: modelCard.model, baseUrl: modelCard.baseUrl ?? undefined },
      `将下面的文本翻译成中文，只输出翻译结果本身，不要添加任何解释、引号或前后缀：\n\n${text}`,
      debugExportContextFor(db, '翻译消息'),
    );
    return translation.trim();
  });

  ipcMain.handle(IPC_CHANNELS.chatCardCreate, (_event, input: CreateChatCardInput) => createChatCard(getDatabase(), input));
  ipcMain.handle(IPC_CHANNELS.chatCardGet, (_event, id: number) => getChatCard(getDatabase(), id));
  ipcMain.handle(IPC_CHANNELS.chatCardList, () => listChatCards(getDatabase()));
  ipcMain.handle(IPC_CHANNELS.chatCardUpdate, (_event, id: number, patch: UpdateChatCardInput) =>
    updateChatCard(getDatabase(), id, patch),
  );
  ipcMain.handle(IPC_CHANNELS.chatCardDelete, (_event, id: number) => deleteChatCard(getDatabase(), id));

  ipcMain.handle(IPC_CHANNELS.settingsGet, () => getSettings(getDatabase()));
  ipcMain.handle(IPC_CHANNELS.settingsSave, (_event, input: SaveSettingsInput) => saveSettings(getDatabase(), input));

  ipcMain.handle(IPC_CHANNELS.llmTestConnection, async (_event, config: SaveSettingsInput) => {
    await callLlm(
      { ...config, baseUrl: config.baseUrl ?? undefined },
      '你好，这是一次连接测试，请用一个字回复。',
      debugExportContextFor(getDatabase(), '模型连接测试'),
    );
  });

  ipcMain.handle(IPC_CHANNELS.personaCreate, (_event, input: CreatePersonaInput) => createPersona(getDatabase(), input));
  ipcMain.handle(IPC_CHANNELS.personaGet, (_event, id: number) => getPersona(getDatabase(), id));
  ipcMain.handle(IPC_CHANNELS.personaListWithUsage, () => listPersonasWithUsage(getDatabase()));
  ipcMain.handle(IPC_CHANNELS.personaUpdate, (_event, id: number, patch: UpdatePersonaInput) =>
    updatePersona(getDatabase(), id, patch),
  );
  ipcMain.handle(IPC_CHANNELS.personaDelete, (_event, id: number) => deletePersona(getDatabase(), id));
  ipcMain.handle(IPC_CHANNELS.personaDuplicate, (_event, id: number) => duplicatePersona(getDatabase(), id));

  ipcMain.handle(IPC_CHANNELS.chatGroupCreate, (_event, input: CreateGroupInput) => createGroup(getDatabase(), input));
  ipcMain.handle(IPC_CHANNELS.chatGroupListWithUsage, () => listGroupsWithUsage(getDatabase()));
  ipcMain.handle(IPC_CHANNELS.chatGroupRename, (_event, id: number, name: string) => renameGroup(getDatabase(), id, name));
  ipcMain.handle(IPC_CHANNELS.chatGroupDelete, (_event, id: number) => deleteGroup(getDatabase(), id));

  ipcMain.handle(IPC_CHANNELS.modelCardList, () => listModelCards(getDatabase()));
  ipcMain.handle(IPC_CHANNELS.modelCardGetCurrent, () => getCurrentModelCard(getDatabase()));

  ipcMain.handle(IPC_CHANNELS.modelCardCreate, (_event, input: CreateModelCardInput) => {
    const db = getDatabase();
    const isFirstCard = listModelCards(db).length === 0;
    const card = createModelCard(db, input);
    return isFirstCard ? setCurrentModelCard(db, card.id) : card;
  });
  ipcMain.handle(IPC_CHANNELS.modelCardUpdate, (_event, id: number, patch: UpdateModelCardInput) =>
    updateModelCard(getDatabase(), id, patch),
  );
  ipcMain.handle(IPC_CHANNELS.modelCardDelete, (_event, id: number) => {
    const db = getDatabase();
    const current = getCurrentModelCard(db);
    if (current && current.id === id) throw new Error('请先切换当前模型后再删除');
    deleteModelCard(db, id);
  });
  ipcMain.handle(IPC_CHANNELS.modelCardSetCurrent, (_event, id: number) => setCurrentModelCard(getDatabase(), id));

  ipcMain.handle(IPC_CHANNELS.appPreferenceGet, () => getAppPreference(getDatabase()));
  ipcMain.handle(IPC_CHANNELS.appPreferenceUpdate, (_event, patch: UpdateAppPreferenceInput) =>
    updateAppPreference(getDatabase(), patch),
  );

  ipcMain.handle(IPC_CHANNELS.appLockGetStatus, () => getAppLockStatus(getDatabase()));
  ipcMain.handle(IPC_CHANNELS.appLockSetPassword, (_event, password: string) => {
    if (password.length < 4 || password.length > 20) throw new Error('密码长度需为 4-20 位');
    setAppLockPassword(getDatabase(), password);
  });
  ipcMain.handle(IPC_CHANNELS.appLockVerifyPassword, (_event, password: string) => verifyAppLockPassword(getDatabase(), password));
  ipcMain.handle(IPC_CHANNELS.appLockClearPassword, (_event, password: string) => {
    const db = getDatabase();
    if (!verifyAppLockPassword(db, password)) throw new Error('密码错误');
    clearAppLockPassword(db);
  });
  ipcMain.handle(IPC_CHANNELS.appLockIsLocked, () => isAppLocked());
  ipcMain.handle(IPC_CHANNELS.appLockEngage, () => {
    if (!getAppLockStatus(getDatabase()).enabled) throw new Error('尚未设置锁屏密码');
    setAppLocked(true);
  });
  // Returns a boolean rather than throwing — a wrong password here is an
  // everyday, no-attempt-limit outcome (see PRD non-goals), not an error
  // condition the way a wrong password is for `appLockClearPassword`.
  ipcMain.handle(IPC_CHANNELS.appLockUnlock, (_event, password: string) => {
    const db = getDatabase();
    const correct = verifyAppLockPassword(db, password);
    if (correct) setAppLocked(false);
    return correct;
  });
  ipcMain.handle(IPC_CHANNELS.appLockResetData, () => {
    resetAppData(getDatabase());
    setAppLocked(false);
  });

  ipcMain.handle(IPC_CHANNELS.debugExportChooseDirectory, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.chatStatsGet, (_event, chatCardId: number) => computeChatStats(getDatabase(), chatCardId));

  ipcMain.handle(IPC_CHANNELS.chatStatsEvaluateGoal, async (_event, chatCardId: number) => {
    const db = getDatabase();
    const { card, persona, messages, modelCard } = loadChatContext(db, chatCardId);
    const prompt = buildGoalEvaluationPrompt({ card, persona, messages, debugMode: getAppPreference(db).debugPromptExport });
    const responseText = await callLlm(
      { provider: modelCard.provider, apiKey: modelCard.apiKey, model: modelCard.model, baseUrl: modelCard.baseUrl ?? undefined },
      prompt,
      debugExportContextFor(db, '目标评估'),
    );
    return parseGoalEvaluation(responseText);
  });

  ipcMain.handle(IPC_CHANNELS.avatarSave, (_event, data: Uint8Array) => saveAvatar(Buffer.from(data)));

  ipcMain.handle(IPC_CHANNELS.replyGenerate, async (_event, input: GenerateRepliesInput) => {
    const db = getDatabase();
    const { card, persona, messages, modelCard } = loadChatContext(db, input.chatCardId);
    const preference = getAppPreference(db);
    const llmConfig = {
      provider: modelCard.provider,
      apiKey: modelCard.apiKey,
      model: modelCard.model,
      baseUrl: modelCard.baseUrl ?? undefined,
    };
    const promptBase = { card, persona, messages, tone: input.tone, debugMode: preference.debugPromptExport };

    const webSearchReady = preference.webSearchEnabled && Boolean(preference.webSearchApiKey);
    if (!webSearchReady) {
      const prompt = buildReplyPrompt(promptBase);
      const responseText = await callLlm(llmConfig, prompt, debugExportContextFor(db, '生成回复'));
      return parseReplies(responseText);
    }

    // Phase 1: the model decides, alongside its normal 3-reply generation,
    // whether this turn needs real-time info — see SEARCH_DECISION_GUIDANCE
    // in generateReplies.ts. `firstPass.replies` is always populated even
    // when needsSearch is true, so it doubles as the fallback if search
    // fails below.
    const firstPrompt = buildReplyPrompt({ ...promptBase, webSearchEnabled: true });
    const firstResponseText = await callLlm(llmConfig, firstPrompt, debugExportContextFor(db, '生成回复（判断是否需要联网）'));
    const firstPass = parseGenerateRepliesResponse(firstResponseText);

    if (!firstPass.needsSearch || !firstPass.searchQuery) {
      return firstPass.replies;
    }

    // "重新生成" re-runs this whole handler for the same still-unanswered
    // message — reuse the search from the previous run instead of hitting
    // Tavily again for what would be near-identical results.
    const lastMessageId = messages[messages.length - 1]?.id;
    const cachedResults = lastMessageId !== undefined ? getCachedSearchResults(input.chatCardId, lastMessageId) : null;

    // preference.webSearchApiKey is non-null here per webSearchReady above.
    const searchResults =
      cachedResults ??
      (await searchWeb(preference.webSearchApiKey as string, firstPass.searchQuery).catch((error: unknown) => {
        console.error('[web-search] search failed, falling back to first-pass replies', error);
        return null;
      }));
    if (!searchResults || searchResults.length === 0) {
      return firstPass.replies;
    }
    if (!cachedResults && lastMessageId !== undefined) {
      setCachedSearchResults(input.chatCardId, lastMessageId, searchResults);
    }

    const secondPrompt = buildReplyPrompt({ ...promptBase, searchResults: formatSearchResults(searchResults) });
    const secondResponseText = await callLlm(llmConfig, secondPrompt, debugExportContextFor(db, '生成回复（联网搜索后）'));
    return parseReplies(secondResponseText);
  });

  ipcMain.handle(IPC_CHANNELS.replyPolish, async (_event, input: PolishDraftInput) => {
    const db = getDatabase();
    const { card, persona, messages, modelCard } = loadChatContext(db, input.chatCardId);
    const prompt = buildPolishPrompt({
      card,
      persona,
      messages,
      tone: input.tone,
      draft: input.draft,
      debugMode: getAppPreference(db).debugPromptExport,
    });
    const responseText = await callLlm(
      { provider: modelCard.provider, apiKey: modelCard.apiKey, model: modelCard.model, baseUrl: modelCard.baseUrl ?? undefined },
      prompt,
      debugExportContextFor(db, '润色'),
    );
    return parseReplies(responseText);
  });
}
