'use client';

import { useCallback, useEffect, useRef } from 'react';

export default function ConfirmModal({ open, title, message, confirmLabel = '삭제', cancelLabel = '취소', variant = 'danger', onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onCancel?.();
    // 포커스 트랩: Tab 키가 모달 밖으로 나가지 않도록
    if (e.key === 'Tab') {
      const modal = cancelRef.current?.closest('.confirm-modal');
      if (!modal) return;
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onCancel]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKey);
      // 열릴 때 취소 버튼에 자동 포커스
      setTimeout(() => cancelRef.current?.focus(), 0);
    }
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby={title ? 'confirm-title' : undefined} aria-label={title ? undefined : '확인'}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        {title && <h3 className="confirm-modal__title" id="confirm-title">{title}</h3>}
        <p className="confirm-modal__msg">{message}</p>
        <div className="confirm-modal__actions">
          <button ref={cancelRef} className="btn btn--secondary btn--sm" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn btn--${variant} btn--sm`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
