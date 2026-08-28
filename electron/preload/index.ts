// Preload script: bridges main-process IPC to the renderer via contextBridge.
// Only a typed, narrow surface is exposed here — never ipcRenderer itself —
// so the renderer can't reach arbitrary channels or native modules.
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-types.js';
import type {
  AppLockStatus,
  AppPreferenceRecord,
  ChatCardRecord,
  ChatStatsRecord,
  CreateChatCardInput,
  CreateGroupInput,
  CreateModelCardInput,
  CreatePersonaInput,
  GenerateRepliesInput,
  GoalEvaluationResult,
  GroupRecord,
  GroupWithUsage,
  InsertMessageInput,
  MessageRecord,
  ModelCardRecord,
  PersonaRecord,
  PersonaWithUsage,
  PolishDraftInput,
  ReplyCandidate,
  SaveSettingsInput,
  SettingsRecord,
  UpdateAppPreferenceInput,
  UpdateChatCardInput,
  UpdateModelCardInput,
  UpdatePersonaInput,
} from '../shared/ipc-types.js';

const api = {
  message: {
    insert: (input: InsertMessageInput): Promise<MessageRecord> => ipcRenderer.invoke(IPC_CHANNELS.messageInsert, input),
    listByChatCard: (chatCardId: number): Promise<MessageRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.messageListByChatCard, chatCardId),
    translate: (text: string): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.messageTranslate, text),
    delete: (messageId: number): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.messageDelete, messageId),
    revert: (messageId: number): Promise<number> => ipcRenderer.invoke(IPC_CHANNELS.messageRevert, messageId),
  },
  chatCard: {
    create: (input: CreateChatCardInput): Promise<ChatCardRecord> => ipcRenderer.invoke(IPC_CHANNELS.chatCardCreate, input),
    get: (id: number): Promise<ChatCardRecord | undefined> => ipcRenderer.invoke(IPC_CHANNELS.chatCardGet, id),
    list: (): Promise<ChatCardRecord[]> => ipcRenderer.invoke(IPC_CHANNELS.chatCardList),
    update: (id: number, patch: UpdateChatCardInput): Promise<ChatCardRecord> =>
      ipcRenderer.invoke(IPC_CHANNELS.chatCardUpdate, id, patch),
    delete: (id: number): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.chatCardDelete, id),
  },
  settings: {
    get: (): Promise<SettingsRecord | undefined> => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    save: (input: SaveSettingsInput): Promise<SettingsRecord> => ipcRenderer.invoke(IPC_CHANNELS.settingsSave, input),
  },
  llm: {
    testConnection: (config: SaveSettingsInput): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.llmTestConnection, config),
  },
  modelCard: {
    list: (): Promise<ModelCardRecord[]> => ipcRenderer.invoke(IPC_CHANNELS.modelCardList),
    create: (input: CreateModelCardInput): Promise<ModelCardRecord> => ipcRenderer.invoke(IPC_CHANNELS.modelCardCreate, input),
    update: (id: number, patch: UpdateModelCardInput): Promise<ModelCardRecord> =>
      ipcRenderer.invoke(IPC_CHANNELS.modelCardUpdate, id, patch),
    delete: (id: number): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.modelCardDelete, id),
    setCurrent: (id: number): Promise<ModelCardRecord> => ipcRenderer.invoke(IPC_CHANNELS.modelCardSetCurrent, id),
  },
  appPreference: {
    get: (): Promise<AppPreferenceRecord> => ipcRenderer.invoke(IPC_CHANNELS.appPreferenceGet),
    update: (patch: UpdateAppPreferenceInput): Promise<AppPreferenceRecord> =>
      ipcRenderer.invoke(IPC_CHANNELS.appPreferenceUpdate, patch),
  },
  debugExport: {
    chooseDirectory: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.debugExportChooseDirectory),
  },
  appLock: {
    getStatus: (): Promise<AppLockStatus> => ipcRenderer.invoke(IPC_CHANNELS.appLockGetStatus),
    setPassword: (password: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.appLockSetPassword, password),
    verifyPassword: (password: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.appLockVerifyPassword, password),
    clearPassword: (password: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.appLockClearPassword, password),
    isLocked: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.appLockIsLocked),
    engage: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.appLockEngage),
    unlock: (password: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.appLockUnlock, password),
    resetData: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.appLockResetData),
  },
  persona: {
    create: (input: CreatePersonaInput): Promise<PersonaRecord> => ipcRenderer.invoke(IPC_CHANNELS.personaCreate, input),
    get: (id: number): Promise<PersonaRecord | undefined> => ipcRenderer.invoke(IPC_CHANNELS.personaGet, id),
    listWithUsage: (): Promise<PersonaWithUsage[]> => ipcRenderer.invoke(IPC_CHANNELS.personaListWithUsage),
    update: (id: number, patch: UpdatePersonaInput): Promise<PersonaRecord> =>
      ipcRenderer.invoke(IPC_CHANNELS.personaUpdate, id, patch),
    delete: (id: number): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.personaDelete, id),
    duplicate: (id: number): Promise<PersonaRecord> => ipcRenderer.invoke(IPC_CHANNELS.personaDuplicate, id),
  },
  chatGroup: {
    create: (input: CreateGroupInput): Promise<GroupRecord> => ipcRenderer.invoke(IPC_CHANNELS.chatGroupCreate, input),
    listWithUsage: (): Promise<GroupWithUsage[]> => ipcRenderer.invoke(IPC_CHANNELS.chatGroupListWithUsage),
    rename: (id: number, name: string): Promise<GroupRecord> => ipcRenderer.invoke(IPC_CHANNELS.chatGroupRename, id, name),
    delete: (id: number): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.chatGroupDelete, id),
  },
  avatar: {
    save: (data: Uint8Array): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.avatarSave, data),
  },
  reply: {
    generate: (input: GenerateRepliesInput): Promise<ReplyCandidate[]> => ipcRenderer.invoke(IPC_CHANNELS.replyGenerate, input),
    polish: (input: PolishDraftInput): Promise<ReplyCandidate[]> => ipcRenderer.invoke(IPC_CHANNELS.replyPolish, input),
  },
  chatStats: {
    get: (chatCardId: number): Promise<ChatStatsRecord> => ipcRenderer.invoke(IPC_CHANNELS.chatStatsGet, chatCardId),
    evaluateGoal: (chatCardId: number): Promise<GoalEvaluationResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.chatStatsEvaluateGoal, chatCardId),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
