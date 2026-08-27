import { useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './Input.module.css';
import { IconAlertCircle, IconEye, IconEyeOff } from '../icons';

interface FieldChromeProps {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
}

function FieldLabel({ htmlFor, label, required, hint }: { htmlFor: string } & FieldChromeProps) {
  if (!label) return null;
  return (
    <label className={styles.label} htmlFor={htmlFor}>
      {label}
      {required && <span className={styles.required}>*</span>}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <span className={styles.errorLabel}>
      <IconAlertCircle size={12} />
      {error}
    </span>
  );
}

export interface InputProps extends FieldChromeProps, InputHTMLAttributes<HTMLInputElement> {}

export function Input({ label, hint, required, error, id, className, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={inputId} label={label} required={required} hint={hint} />
      <input
        id={inputId}
        className={[styles.control, error && styles.hasError, className].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      <FieldError error={error} />
    </div>
  );
}

export interface TextareaProps extends FieldChromeProps, TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ label, hint, required, error, id, className, ...rest }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={textareaId} label={label} required={required} hint={hint} />
      <textarea
        id={textareaId}
        className={[styles.control, styles.textarea, error && styles.hasError, className]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      <FieldError error={error} />
    </div>
  );
}

export interface PasswordInputProps extends FieldChromeProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

/** A masked text field with a show/hide toggle — for API keys and other secrets that still need to be checkable. */
export function PasswordInput({ label, hint, required, error, id, className, ...rest }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={inputId} label={label} required={required} hint={hint} />
      <div className={styles.passwordWrap}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={[styles.control, styles.passwordControl, error && styles.hasError, className]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        <button
          type="button"
          className={styles.showHideBtn}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? '隐藏' : '显示'}
        >
          {visible ? <IconEyeOff size={17} /> : <IconEye size={17} />}
        </button>
      </div>
      <FieldError error={error} />
    </div>
  );
}
