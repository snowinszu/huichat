import { useEffect, useState } from 'react';
import styles from './SettingsScreen.module.css';
import { Button, IconArrowLeft, IconButton, LockButton, Modal, PasswordInput, Toggle, useAppLock, useToast } from '../../components/ui';
import { DEFAULT_APP_PREFERENCE } from '../../lib/appPreferenceDefaults';
import { applyDarkModeAttribute } from '../../lib/applyDarkMode';
import { maskApiKey } from '../models/providerMeta';
import type { AppLockStatus, AppPreferenceRecord, UpdateAppPreferenceInput } from '../../../electron/shared/ipc-types';

const DEFAULT_APP_LOCK_STATUS: AppLockStatus = { enabled: false };

export interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { showToast } = useToast();
  const { setLockEnabled } = useAppLock();
  const [preference, setPreference] = useState<AppPreferenceRecord>(DEFAULT_APP_PREFERENCE);
  const [pendingKey, setPendingKey] = useState<keyof UpdateAppPreferenceInput | null>(null);
  const [choosingDirectory, setChoosingDirectory] = useState(false);

  const [lockStatus, setLockStatus] = useState<AppLockStatus>(DEFAULT_APP_LOCK_STATUS);
  // 'set' = turning the lock on and choosing a password; 'disable' = turning
  // it off and confirming the current one. `null` closes both dialogs.
  const [lockDialog, setLockDialog] = useState<'set' | 'disable' | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [lockError, setLockError] = useState<string | undefined>(undefined);
  const [lockSubmitting, setLockSubmitting] = useState(false);

  // Open for both "turning the toggle on with no key saved yet" and
  // "更改 Key" on an already-configured setup — both cases save the same
  // shape (`webSearchEnabled: true` + the entered key), so one dialog covers
  // both entry points.
  const [webSearchKeyDialogOpen, setWebSearchKeyDialogOpen] = useState(false);
  const [webSearchKeyInput, setWebSearchKeyInput] = useState('');
  const [webSearchKeyError, setWebSearchKeyError] = useState<string | undefined>(undefined);
  const [webSearchKeySubmitting, setWebSearchKeySubmitting] = useState(false);

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
    window.api?.appLock
      .getStatus()
      .then((status) => {
        if (!cancelled) setLockStatus(status);
      })
      .catch(() => {
        // No Electron bridge in this context — keep the in-memory default (off).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function closeLockDialog() {
    setLockDialog(null);
    setPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setLockError(undefined);
  }

  // The toggle never flips optimistically here — `checked` stays bound to
  // `lockStatus.enabled`, which only changes once the password dialog (set or
  // confirm-to-disable) actually succeeds. Cancelling a dialog needs no
  // rollback because nothing was changed yet.
  function handleLockToggleClick(checked: boolean) {
    setLockError(undefined);
    setLockDialog(checked ? 'set' : 'disable');
  }

  async function handleSetPassword() {
    if (password !== confirmPassword) {
      setLockError('两次输入的密码不一致');
      return;
    }
    if (password.length < 4 || password.length > 20) {
      setLockError('密码长度需为 4-20 位');
      return;
    }
    setLockSubmitting(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      await window.api.appLock.setPassword(password);
      setLockStatus({ enabled: true });
      setLockEnabled(true);
      closeLockDialog();
      showToast('锁屏已开启', 'success');
    } catch (error) {
      setLockError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setLockSubmitting(false);
    }
  }

  async function handleDisableLock() {
    setLockSubmitting(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      await window.api.appLock.clearPassword(currentPassword);
      setLockStatus({ enabled: false });
      setLockEnabled(false);
      closeLockDialog();
      showToast('锁屏已关闭', 'success');
    } catch (error) {
      setLockError(error instanceof Error ? error.message : '密码错误');
    } finally {
      setLockSubmitting(false);
    }
  }

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

  function openWebSearchKeyDialog() {
    setWebSearchKeyInput('');
    setWebSearchKeyError(undefined);
    setWebSearchKeyDialogOpen(true);
  }

  function closeWebSearchKeyDialog() {
    setWebSearchKeyDialogOpen(false);
    setWebSearchKeyInput('');
    setWebSearchKeyError(undefined);
  }

  // Turning the toggle on with no key saved yet would persist an unusable
  // "开启但没有 Key" state — same reasoning as handleToggleDebugExport's
  // directory-first flow — so this routes into the key dialog first instead.
  // Turning it off, or turning it on when a key is already saved, is just
  // the plain toggle path (turning off never clears the saved key, so
  // re-enabling later doesn't require re-entering it).
  function handleToggleWebSearch(checked: boolean) {
    if (!checked || preference.webSearchApiKey) {
      handleToggle('webSearchEnabled', checked);
      return;
    }
    openWebSearchKeyDialog();
  }

  async function handleSaveWebSearchKey() {
    const trimmed = webSearchKeyInput.trim();
    if (!trimmed) {
      setWebSearchKeyError('请填写 Tavily API Key');
      return;
    }
    setWebSearchKeySubmitting(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      const updated = await window.api.appPreference.update({ webSearchEnabled: true, webSearchApiKey: trimmed });
      setPreference(updated);
      closeWebSearchKeyDialog();
      showToast('联网搜索已开启', 'success');
    } catch (error) {
      setWebSearchKeyError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setWebSearchKeySubmitting(false);
    }
  }

  return (
    <div>
      <header className={styles.titlebar}>
        <IconButton aria-label="返回" onClick={onBack}>
          <IconArrowLeft size={20} />
        </IconButton>
        <span className={styles.pageTitle}>设置</span>
        <LockButton />
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
          <div className={styles.sectionTitle}>隐私与安全</div>
          <Toggle
            label="锁屏密码"
            description="开启后可在标题栏一键锁定应用，需输入密码才能进入"
            checked={lockStatus.enabled}
            onChange={handleLockToggleClick}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>联网搜索</div>
          <Toggle
            label="联网搜索"
            description="对方问天气、日期、演出时间等时效性问题时，先联网查询再生成回复候选，需要 Tavily API Key"
            checked={preference.webSearchEnabled}
            disabled={pendingKey === 'webSearchEnabled'}
            onChange={handleToggleWebSearch}
          />
          <div className={styles.dirRow}>
            <div className={styles.dirInfo}>
              <div className={styles.dirLabel}>Tavily API Key</div>
              <div className={styles.dirPath}>{preference.webSearchApiKey ? maskApiKey(preference.webSearchApiKey) : '未设置'}</div>
            </div>
            <Button size="sm" variant="subtle" onClick={openWebSearchKeyDialog}>
              {preference.webSearchApiKey ? '更改 Key' : '设置 Key'}
            </Button>
          </div>
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

      <Modal
        open={lockDialog === 'set'}
        onClose={closeLockDialog}
        title="设置锁屏密码"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeLockDialog}>
              取消
            </Button>
            <Button size="sm" loading={lockSubmitting} onClick={handleSetPassword}>
              开启锁屏
            </Button>
          </>
        }
      >
        <div className={styles.fields}>
          <PasswordInput
            label="密码"
            hint="4-20 位"
            autoFocus
            value={password}
            error={lockError}
            onChange={(event) => {
              setPassword(event.target.value);
              setLockError(undefined);
            }}
          />
          <PasswordInput
            label="确认密码"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setLockError(undefined);
            }}
          />
        </div>
      </Modal>

      <Modal
        open={lockDialog === 'disable'}
        onClose={closeLockDialog}
        title="关闭锁屏"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeLockDialog}>
              取消
            </Button>
            <Button size="sm" loading={lockSubmitting} onClick={handleDisableLock}>
              确认关闭
            </Button>
          </>
        }
      >
        <div className={styles.fields}>
          <PasswordInput
            label="输入当前密码以关闭锁屏"
            autoFocus
            value={currentPassword}
            error={lockError}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              setLockError(undefined);
            }}
          />
        </div>
      </Modal>

      <Modal
        open={webSearchKeyDialogOpen}
        onClose={closeWebSearchKeyDialog}
        title="设置 Tavily API Key"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeWebSearchKeyDialog}>
              取消
            </Button>
            <Button size="sm" loading={webSearchKeySubmitting} onClick={handleSaveWebSearchKey}>
              保存
            </Button>
          </>
        }
      >
        <div className={styles.fields}>
          <PasswordInput
            label="Tavily API Key"
            hint="用于联网搜索时效性问题，可在 tavily.com 申请"
            autoFocus
            value={webSearchKeyInput}
            error={webSearchKeyError}
            onChange={(event) => {
              setWebSearchKeyInput(event.target.value);
              setWebSearchKeyError(undefined);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
