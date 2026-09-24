"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./Toast.module.css";

type ToastTone = "ok" | "err";

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_HIDE_MS = 2200;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, tone: ToastTone = "ok") => {
    setMessage({ text, tone });
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={visible ? `${styles.toast} ${styles.show}` : styles.toast}
        role="status"
        aria-live="polite"
      >
        {message ? (
          <>
            <span
              className={
                message.tone === "ok"
                  ? `${styles.dot} ${styles.dotOk}`
                  : `${styles.dot} ${styles.dotErr}`
              }
            />
            <span>{message.text}</span>
          </>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
