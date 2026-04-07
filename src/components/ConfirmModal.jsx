'use client';

import { useCallback, useEffect } from 'react';

export default function ConfirmModal({ open, title, message, confirmLabel = '삭제', cancelLabel = '취소', variant = 'danger', onConfirm, onCancel }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onCancel?.();
  }, [onCancel]);

  useEffect(() => {
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title || '확인'}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        {title && <h3 className="confirm-modal__title" id="confirm-title">{title}</h3>}
        <p className="confirm-modal__msg">{message}</p>
        <div className="confirm-modal__actions">
          <button className="btn btn--secondary btn--sm" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn btn--${variant} btn--sm`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
