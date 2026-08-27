import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Toast, type ToastType } from './Toast';
import { ToastContext } from './ToastContext';

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

const TOAST_DURATION_MS = 2800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    nextId.current += 1;
    setToast({ id: nextId.current, message, type });
    timeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} />}
    </ToastContext.Provider>
  );
}
