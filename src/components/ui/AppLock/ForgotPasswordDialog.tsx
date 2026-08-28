import { useState } from 'react';
import styles from './ForgotPasswordDialog.module.css';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { useAppLock } from './useAppLock';

const CONFIRM_WORD = '删除';

export interface ForgotPasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

/** The recovery path for a forgotten password — no security questions or cloud recovery (see PRD non-goals), just an explicit, hard-to-trigger-by-accident local wipe. */
export function ForgotPasswordDialog({ open, onClose }: ForgotPasswordDialogProps) {
  const { resetAppData } = useAppLock();
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  function handleClose() {
    if (resetting) return;
    setConfirmText('');
    onClose();
  }

  async function handleReset() {
    setResetting(true);
    await resetAppData();
    // No `finally` reset of `resetting`/`confirmText` — resetAppData ends in
    // a full page reload, so this component is about to be torn down anyway.
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="重置应用数据"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={resetting}>
            取消
          </Button>
          <Button variant="danger" size="sm" disabled={confirmText !== CONFIRM_WORD} loading={resetting} onClick={handleReset}>
            确认重置
          </Button>
        </>
      }
    >
      <div className={styles.warning}>重置将永久删除本机全部聊天记录、角色和设置，且无法恢复。</div>
      <Input
        label={`请输入"${CONFIRM_WORD}"以确认`}
        placeholder={CONFIRM_WORD}
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
        autoFocus
      />
    </Modal>
  );
}
