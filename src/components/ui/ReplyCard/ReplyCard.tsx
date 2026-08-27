import styles from './ReplyCard.module.css';
import { IconCopy, IconCheck, IconPlus } from '../icons';

export interface ReplyCardProps {
  text: string;
  translation?: string | null;
  tag: string;
  copied?: boolean;
  onCopy?: () => void;
  adding?: boolean;
  onAdd?: () => void;
}

export function ReplyCard({ text, translation, tag, copied = false, onCopy, adding = false, onAdd }: ReplyCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.text}>{text}</div>
      {translation && (
        <div className={styles.translation}>
          <span className={styles.translationTag}>译</span>
          <span>{translation}</span>
        </div>
      )}
      <div className={styles.foot}>
        <span className={styles.tag}>{tag}</span>
        <div className={styles.actions}>
          {onAdd && (
            <button type="button" className={styles.addBtn} disabled={adding} onClick={onAdd}>
              <IconPlus size={11} />
              加入对话
            </button>
          )}
          <button
            type="button"
            className={[styles.copyBtn, copied && styles.copied].filter(Boolean).join(' ')}
            onClick={onCopy}
          >
            {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
    </div>
  );
}
