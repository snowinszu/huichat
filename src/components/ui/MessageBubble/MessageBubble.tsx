import type { ReactNode } from 'react';
import styles from './MessageBubble.module.css';

export interface MessageBubbleProps {
  from: 'me' | 'them';
  children: ReactNode;
}

export function MessageBubble({ from, children }: MessageBubbleProps) {
  return <div className={[styles.bubble, styles[from]].join(' ')}>{children}</div>;
}

export function MessageBubbleGroup({ children }: { children: ReactNode }) {
  return <div className={styles.group}>{children}</div>;
}

export interface TranslationNoteProps {
  children: ReactNode;
}

export function TranslationNote({ children }: TranslationNoteProps) {
  return (
    <div className={styles.translation}>
      <span className={styles.translationTag}>译</span>
      {children}
    </div>
  );
}

export interface AnnotationNoteProps {
  type: string;
  children: ReactNode;
}

export function AnnotationNote({ type, children }: AnnotationNoteProps) {
  return (
    <div className={styles.annotation}>
      <span className={styles.annotationTag}>{type}</span>
      <span>{children}</span>
    </div>
  );
}
