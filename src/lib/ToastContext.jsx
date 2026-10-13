'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ToastContext = createContext(null);

const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️', celebrate: '🎉' };

// 한 번에 보이는 토스트 상한 — 넘치면 가장 오래된 것부터 내린다(WALL-STATES-001).
export const TOAST_STACK_LIMIT = 3;

// 실패(error)와 막힘(warning)만 낭독을 끊는 alert, 나머지(성공·안내·축하)는 차례를 기다리는 status.
// 전부 alert이던 때는 「저장됨」 같은 성공 알림도 화면 낭독기를 매번 끊었다.
export function toastRole(type) {
  return type === 'error' || type === 'warning' ? 'alert' : 'status';
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    // 상한을 넘기면 가장 오래된 것부터 내린다. 내려간 토스트의 타이머는 그대로 두어도 된다 — 나중에 없는 id를 거를 뿐이다.
    setToasts(prev => [...prev, { id, message, type }].slice(-TOAST_STACK_LIMIT));
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
  }, [dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => { for (const timer of pending.values()) clearTimeout(timer); pending.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <div className="toast__body" role={toastRole(t.type)}>
              <span className="toast__icon" aria-hidden="true">{ICONS[t.type] || ICONS.info}</span>
              <span className="toast__msg">{t.message}</span>
            </div>
            <button type="button" className="toast__close" aria-label="알림 닫기" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
