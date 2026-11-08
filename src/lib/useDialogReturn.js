'use client';
import { useEffect, useRef } from 'react';

/**
 * 가벼운 팝업(role="dialog" div)의 키보드 하한 — 열리면 창 안으로 포커스, Tab은 창 안에서 돈다, Esc로 닫기, 닫히면 연 자리로 포커스를 돌려준다.
 * Tab 가둠(A11Y-AUTH-001, 2026-11-08 KST): aria-modal 창인데 Tab이 뒤 화면(머리 메뉴 · 푸터)으로 빠져나가 닫은 뒤 포커스가 그 자리에 남았다
 * (현황 · 내 정보의 창 10곳 실측 — 8곳은 닫은 뒤 연 단추로 못 돌아옴). 단어 상세(VocabDetailCard) · 범위 고르기(ReviewScopeBar)의 가둠과 같은 규칙 — 끝에서 처음으로, 처음에서 끝으로.
 * 다른 창이 위에 열려 포커스가 그 안에 있으면(이 창 밖 · 다른 aria-modal 안) 그 창에 맡긴다.
 * 선례 ConfirmModal(CONFIRM-FOCUS-001) · ViewerModal과 같은 조건: 연 요소가 살아 있고 포커스가 body로 떨어졌을 때만 돌려준다.
 * onClose는 ref로 읽어 부모가 다시 그려져도 키 처리기를 다시 걸지 않는다(다시 걸면 포커스가 처음 칸으로 되돌아간다).
 * @returns 창 바깥 요소에 붙일 ref — 조작 요소가 없을 때를 위해 tabIndex={-1}을 함께 단다.
 */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab · Shift+Tab을 창 안에서 돌린다. 포커스가 창 밖(뒤 화면)에 있으면 창 첫 칸으로 되돌린다. 그 밖에서는 브라우저 순서 그대로. */
export function trapTab(e, box) {
  if (!box) return;
  const active = box.ownerDocument.activeElement;
  if (active && !box.contains(active) && active.closest?.('[aria-modal="true"]')) return; // 위에 열린 다른 창의 일
  const items = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0 && !el.closest('[inert]'));
  if (!items.length) { e.preventDefault(); box.focus({ preventScroll: true }); return; }
  const first = items[0], last = items[items.length - 1];
  if (!box.contains(active) || active === box) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

export function useDialogReturn(onClose) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = typeof document === 'undefined' ? null : document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close.current?.(); return; }
      if (e.key === 'Tab' && !e.defaultPrevented) trapTab(e, ref.current);
    };
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
