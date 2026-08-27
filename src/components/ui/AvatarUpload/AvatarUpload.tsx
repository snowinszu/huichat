import { useId, useRef } from 'react';
import styles from './AvatarUpload.module.css';

export interface AvatarUploadProps {
  imageUrl?: string;
  placeholder?: string;
  hint?: string;
  onFileSelect: (file: File) => void;
}

export function AvatarUpload({ imageUrl, placeholder = '+', hint = '点击上传头像（可选）', onFileSelect }: AvatarUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.wrap}>
      <div
        className={[styles.preview, imageUrl && styles.filled].filter(Boolean).join(' ')}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {imageUrl ? <img className={styles.image} src={imageUrl} alt="" /> : <span aria-hidden="true">{placeholder}</span>}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
