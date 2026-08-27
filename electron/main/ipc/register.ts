import { dialog, ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { getDatabase } from '../db/index.js';
import { insertMessage, listMessagesByChatCard, deleteMessage } from '../db/messageRepository.js';
import { createChatCard, getChatCard, listChatCards, updateChatCard, deleteChatCard } from '../db/chatCardRepository.js';
import { computeChatStats } from '../db/chatStatsRepository.js';
import { getSettings, saveSettings } from '../db/settingsRepository.js';
import { getAppPreference, updateAppPreference } from '../db/appPreferenceRepository.js';
import { createPersona, getPersona, listPersonasWithUsage, updatePersona, deletePersona } from '../db/personaRepository.js';
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
import { buildReplyPrompt, parseReplies } from '../llm/generateReplies.js';
import { buildPolishPrompt } from '../llm/polishDraft.js';
import { buildGoalEvaluationPrompt, parseGoalEvaluation } from '../llm/evaluateGoal.js';
import { maybeExtractInfo } from '../llm/extractInfo.js';
import { maybeSummarizeHistory } from '../llm/summarizeHistory.js';
import { IPC_CHANNELS } from '../../shared/ipc-types.js';
import { NO_CURRENT_MODEL_CARD_MESSAGE } from '../../shared/errors.js';
import type {
  ChatCardRecord,
  CreateChatCardInput,
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
    const prompt = buildReplyPrompt({ card, persona, messages, tone: input.tone, debugMode: getAppPreference(db).debugPromptExport });
    const responseText = await callLlm(
      { provider: modelCard.provider, apiKey: modelCard.apiKey, model: modelCard.model, baseUrl: modelCard.baseUrl ?? undefined },
      prompt,
      debugExportContextFor(db, '生成回复'),
    );
    return parseReplies(responseText);
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
