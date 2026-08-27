import { useEffect, useState } from 'react';
import styles from './SettingsScreen.module.css';
import { Button, IconArrowLeft, IconButton, Toggle, useToast } from '../../components/ui';
import { DEFAULT_APP_PREFERENCE } from '../../lib/appPreferenceDefaults';
import { applyDarkModeAttribute } from '../../lib/applyDarkMode';
import type { AppPreferenceRecord, UpdateAppPreferenceInput } from '../../../electron/shared/ipc-types';

export interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { showToast } = useToast();
  const [preference, setPreference] = useState<AppPreferenceRecord>(DEFAULT_APP_PREFERENCE);
  const [pendingKey, setPendingKey] = useState<keyof UpdateAppPreferenceInput | null>(null);
  const [choosingDirectory, setChoosingDirectory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api?.appPreference
      .get()
      .then((record) => {
        if (!cancelled) setPreference(record);
      })
      .catch(() => {
        // No Electron bridge in this context — keep the in-memory defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(key: keyof UpdateAppPreferenceInput, checked: boolean) {
    const previous = preference;
    setPreference((current) => ({ ...current, [key]: checked }));
    // Applied optimistically, same as the preference state itself — the
    // whole document re-themes the instant you click, not after the IPC
    // round-trip resolves. Rolled back in the catch below on failure.
    if (key === 'darkMode') applyDarkModeAttribute(checked);
    setPendingKey(key);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      const updated = await window.api.appPreference.update({ [key]: checked });
      setPreference(updated);
    } catch (error) {
      setPreference(previous);
      if (key === 'darkMode') applyDarkModeAttribute(previous.darkMode);
      showToast(error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      setPendingKey(null);
    }
  }

  // Returns the chosen path, or null if the user cancelled the native
  // dialog — callers decide what (if anything) to persist with it.
  async function chooseDirectory(): Promise<string | null> {
    if (!window.api) {
      showToast('当前环境不支持选择目录（未连接到 Electron 主进程）', 'error');
      return null;
    }
    setChoosingDirectory(true);
    try {
      return await window.api.debugExport.chooseDirectory();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '选择目录失败', 'error');
      return null;
    } finally {
      setChoosingDirectory(false);
    }
  }

  async function handleChangeDirectoryClick() {
    const chosen = await chooseDirectory();
    if (!chosen) return;
    setPendingKey('debugExportDir');
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      const updated = await window.api.appPreference.update({ debugExportDir: chosen });
      setPreference(updated);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      setPendingKey(null);
    }
  }

  // Turning the toggle on with no directory saved yet would persist an
  // unusable "开启但无处可写" state — instead this routes straight into the
  // directory picker first, and only saves both fields together once a real
  // path comes back. Turning it off, or turning it on when a directory is
  // already set, is just the plain toggle path.
  async function handleToggleDebugExport(checked: boolean) {
    if (!checked || preference.debugExportDir) {
      await handleToggle('debugPromptExport', checked);
      return;
    }
    const chosen = await chooseDirectory();
    if (!chosen) {
      showToast('请先选择导出目录后再开启', 'error');
      return;
    }
    setPendingKey('debugPromptExport');
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      const updated = await window.api.appPreference.update({ debugPromptExport: true, debugExportDir: chosen });
      setPreference(updated);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div>
      <header className={styles.titlebar}>
        <IconButton aria-label="返回" onClick={onBack}>
          <IconArrowLeft size={20} />
        </IconButton>
        <span className={styles.pageTitle}>设置</span>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.sectionTitle}>通用</div>
          <Toggle
            label="翻译非中文消息"
            description="对方发的英文、日文等自动显示中文翻译"
            checked={preference.translateNonChinese}
            disabled={pendingKey === 'translateNonChinese'}
            onChange={(checked) => handleToggle('translateNonChinese', checked)}
          />
          <Toggle
            label="复制时自动添加到历史"
            description="点击复制后自动把该条记录追加到对话历史"
            checked={preference.autoAddToHistory}
            disabled={pendingKey === 'autoAddToHistory'}
            onChange={(checked) => handleToggle('autoAddToHistory', checked)}
          />
          <Toggle
            label="自动信息提取"
            description="从粘贴的消息中自动提取对方与自己的信息，用于完善卡片资料"
            checked={preference.autoExtractInfo}
            disabled={pendingKey === 'autoExtractInfo'}
            onChange={(checked) => handleToggle('autoExtractInfo', checked)}
          />
          <Toggle
            label="深色模式"
            description="使用深色配色，适合夜间使用"
            checked={preference.darkMode}
            disabled={pendingKey === 'darkMode'}
            onChange={(checked) => handleToggle('darkMode', checked)}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>调试</div>
          <Toggle
            label="导出提示词调试日志"
            description="每次与 AI 交互都把完整提示词和响应保存为文件，用于调试"
            checked={preference.debugPromptExport}
            disabled={pendingKey === 'debugPromptExport' || choosingDirectory}
            onChange={handleToggleDebugExport}
          />
          <div className={styles.dirRow}>
            <div className={styles.dirInfo}>
              <div className={styles.dirLabel}>导出目录</div>
              <div className={styles.dirPath} title={preference.debugExportDir ?? undefined}>
                {preference.debugExportDir ?? '未设置目录'}
              </div>
            </div>
            <Button
              size="sm"
              variant="subtle"
              loading={choosingDirectory || pendingKey === 'debugExportDir'}
              onClick={handleChangeDirectoryClick}
            >
              {preference.debugExportDir ? '更改目录' : '选择目录'}
            </Button>
          </div>
        </div>

        <div className={styles.versionInfo}>会聊 v0.1.0 · Phase 1 · 仅本地运行，不连接社交账号</div>
      </main>
    </div>
  );
}
