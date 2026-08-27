import styles from './Toggle.module.css';

export interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** A labeled on/off switch row — visual pill matches `UI design/settings.html`'s `.toggle-row`/`.toggle`, with real `role="switch"` semantics since the visible label sits outside the button itself. */
export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <div className={styles.label}>{label}</div>
        {description && <div className={styles.desc}>{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={[styles.toggle, checked && styles.on].filter(Boolean).join(' ')}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
