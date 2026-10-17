'use client';
import { useEffect, useRef } from 'react';

/**
 * 가벼운 팝업(role="dialog" div)의 키보드 하한 — 열리면 창 안으로 포커스, Esc로 닫기, 닫히면 연 자리로 포커스를 돌려준다.
 * 선례 ConfirmModal(CONFIRM-FOCUS-001) · ViewerModal과 같은 조건: 연 요소가 살아 있고 포커스가 body로 떨어졌을 때만 돌려준다.
 * onClose는 ref로 읽어 부모가 다시 그려져도 키 처리기를 다시 걸지 않는다(다시 걸면 포커스가 처음 칸으로 되돌아간다).
 * @returns 창 바깥 요소에 붙일 ref — 조작 요소가 없을 때를 위해 tabIndex={-1}을 함께 단다.
 */
export function useDialogReturn(onClose) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = typeof document === 'undefined' ? null : document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close.current?.(); } };
    document.addEventListener('keydown', onKey);
    // 창 안 첫 조작 요소(대개 「닫기」)로 — 창 상자 자체에 포커스를 주면 키보드 사용 뒤 테두리가 상자 전체에 그려진다.
    const timer = setTimeout(() => {
      const box = ref.current;
      if (!box || box.contains(document.activeElement)) return;
      const first = box.querySelector('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
      (first || box).focus({ preventScroll: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      requestAnimationFrame(() => {
        if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });
      });
    };
  }, []);
  return ref;
}
