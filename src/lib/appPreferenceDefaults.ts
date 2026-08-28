import type { AppPreferenceRecord } from '../../electron/shared/ipc-types';

/** Mirrors the defaults `schema.ts` seeds `app_preference` with — used before the real value has loaded (or when there's no Electron bridge) so consumers never have to null-check. */
export const DEFAULT_APP_PREFERENCE: AppPreferenceRecord = {
  translateNonChinese: true,
  autoAddToHistory: false,
  autoExtractInfo: true,
  darkMode: false,
  debugPromptExport: false,
  debugExportDir: null,
  webSearchEnabled: false,
  webSearchApiKey: null,
  updatedAt: 0,
};
