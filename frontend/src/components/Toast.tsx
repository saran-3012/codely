import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'error' | 'success' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
    error: (message: string) => void;
    success: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

const COLORS: Record<ToastType, string> = {
  error:   'bg-red-900/90 border-red-500 text-red-100',
  success: 'bg-green-900/90 border-green-500 text-green-100',
  info:    'bg-blue-900/90 border-blue-500 text-blue-100',
};

const ICONS: Record<ToastType, string> = {
  error:   '✕',
  success: '✓',
  info:    'ℹ',
};

const DURATION = 4000;

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURATION);
  }, []);

  const toast = {
    error:   (m: string) => add('error', m),
    success: (m: string) => add('success', m),
    info:    (m: string) => add('info', m),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3 rounded-lg border text-sm shadow-lg pointer-events-auto animate-in fade-in slide-in-from-bottom-2 ${COLORS[t.type]}`}
          >
            <span className="font-bold mt-0.5">{ICONS[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType['toast'] => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
};
