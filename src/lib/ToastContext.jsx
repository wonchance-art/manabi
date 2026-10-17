'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { reducedMotion } from './reducedMotion';

const ToastContext = createContext(null);

const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️', celebrate: '🎉' };

// 한 번에 보이는 토스트 상한 — 넘치면 가장 오래된 것부터 내린다(WALL-STATES-001).
export const TOAST_STACK_LIMIT = 3;

// 실패(error)와 막힘(warning)만 낭독을 끊는 alert, 나머지(성공·안내·축하)는 차례를 기다리는 status.
// 전부 alert이던 때는 「저장됨」 같은 성공 알림도 화면 낭독기를 매번 끊었다.
export function toastRole(type) {
  return type === 'error' || type === 'warning' ? 'alert' : 'status';
}

// 퇴장(TOAST-MOTION-001, 2026-10-17 KST): 바로 지우면 툭 사라져 무엇이 내려갔는지 놓쳤다. leaving으로 표시해 CSS가
// 투명도 · 4px 아래로 빼는 동안(--transition-fast) 두었다가 지운다. 동작 줄이기면 즉시 지운다.
export const TOAST_LEAVE_MS = 160;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // id → { timer, remaining, started, holds } — holds(hover · focus)가 있는 동안 자동 닫힘을 멈춘다.
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismiss = useCallback((id) => {
    const entry = timers.current.get(id);
    clearTimeout(entry?.timer);
    timers.current.delete(id);
    if (reducedMotion()) { remove(id); return; }
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => remove(id), TOAST_LEAVE_MS);
  }, [remove]);

  const arm = useCallback((id) => {
    const entry = timers.current.get(id);
    if (!entry || entry.holds.size) return;
    entry.started = Date.now();
    entry.timer = setTimeout(() => dismiss(id), entry.remaining);
  }, [dismiss]);

  // 읽는 동안(포인터가 올라가 있거나 안에 포커스가 있는 동안)은 저절로 닫히지 않는다 — 떠나면 남은 시간으로 다시 건다.
  const hold = useCallback((id, reason) => {
    const entry = timers.current.get(id);
    if (!entry) return;
    if (!entry.holds.size) {
      clearTimeout(entry.timer);
      entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.started));
    }
    entry.holds.add(reason);
  }, []);
  const release = useCallback((id, reason) => {
    const entry = timers.current.get(id);
    if (!entry || !entry.holds.delete(reason)) return;
    arm(id);
  }, [arm]);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    // 상한을 넘기면 가장 오래된 것부터 내린다. 내려간 토스트의 타이머는 그대로 두어도 된다 — 나중에 없는 id를 거를 뿐이다.
    setToasts(prev => [...prev, { id, message, type }].slice(-TOAST_STACK_LIMIT));
    timers.current.set(id, { timer: null, remaining: duration, started: 0, holds: new Set() });
    arm(id);
  }, [arm]);

  useEffect(() => {
    const pending = timers.current;
    return () => { for (const entry of pending.values()) clearTimeout(entry.timer); pending.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}${t.leaving ? ' toast--leaving' : ''}`}
            onPointerEnter={() => hold(t.id, 'pointer')} onPointerLeave={() => release(t.id, 'pointer')}
            onFocus={() => hold(t.id, 'focus')}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) release(t.id, 'focus'); }}>
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
