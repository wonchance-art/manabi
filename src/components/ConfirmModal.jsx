'use client';

import { useCallback, useEffect, useRef } from 'react';

// 기본 버튼은 중립 「확인」(primary)이다. 파괴적 동작(영구 삭제 등)은 호출부가
// confirmLabel·variant='danger'를 명시한다 — 예전 기본값 「삭제」(danger)는 휴지통 이동처럼
// 되돌릴 수 있는 동작에도 빨간 「삭제」를 띄워 영구 삭제로 오인하게 했다(WALL-STATES-001 ②).
export default function ConfirmModal({ open, title, message, confirmLabel = '확인', cancelLabel = '취소', variant = 'primary', confirmDisabled = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  // 호출부가 매 렌더 새 화살표 함수를 넘겨도 키 처리기를 다시 걸지 않는다 — 다시 걸면 열린 동안
  // 부모가 다시 그려질 때마다 포커스가 「취소」로 되돌아갔다.
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') cancel.current?.();
    // 포커스 트랩: Tab 키가 모달 밖으로 나가지 않도록
    if (e.key === 'Tab') {
      const modal = cancelRef.current?.closest('.confirm-modal');
      if (!modal) return;
      // 잠긴 버튼(confirmDisabled)은 포커스를 받지 못하므로 트랩의 끝점에서 뺀다.
      const focusable = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
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
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    document.addEventListener('keydown', handleKey);
    // 열릴 때 취소 버튼에 자동 포커스
    const focusTimer = setTimeout(() => cancelRef.current?.focus(), 0);
    return () => { clearTimeout(focusTimer); document.removeEventListener('keydown', handleKey); };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby={title ? 'confirm-title' : undefined} aria-label={title ? undefined : '확인'}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        {title && <h3 className="confirm-modal__title" id="confirm-title">{title}</h3>}
        <p className="confirm-modal__msg">{message}</p>
        <div className="confirm-modal__actions">
          <button ref={cancelRef} className="btn btn--secondary btn--sm" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn btn--${variant} btn--sm`} onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
