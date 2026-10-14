'use client';
import { useRef, useState } from 'react';

/**
 * 입력이 바뀐 편집 창을 닫기 전에 한 번 묻는다(WALL-STATES-001 ④).
 * 취소·Esc·배경 클릭이 모두 같은 requestClose로 와서, 바뀐 것이 없으면 바로 닫고
 * 바뀐 것이 있으면 공용 ConfirmModal을 띄운다. 이미 묻는 중에 다시 닫기가 오면(네이티브
 * <dialog>의 Esc 등) 묻기를 거두고 편집으로 돌아간다 — 실수로 두 번 눌러 버리지 않게.
 *
 * 문구는 문구 표준 §2(확인창 제목 = 질문, 버튼 = 실제 동작 이름)를 따른다.
 */
export const DISCARD_CONFIRM = Object.freeze({
  title: '저장하지 않은 변경을 버릴까요?',
  confirmLabel: '버리기',
  cancelLabel: '계속 수정',
  variant: 'danger',
});

/** 편집 초안이 처음 값과 다른가 — 지정한 필드만, 문자열 비교. */
export function hasUnsavedEdits(initial, draft, fields) {
  if (!initial || !draft) return false;
  return fields.some(key => String(draft[key] ?? '') !== String(initial[key] ?? ''));
}

export function useDiscardGuard({ dirty, onClose }) {
  const [asking, setAsking] = useState(false);
  // 키 처리기가 한 번만 등록되는 창(effect deps가 열림 여부뿐)에서도 최신 값을 읽게 ref로 둔다.
  const live = useRef({ dirty, onClose, asking });
  live.current.dirty = dirty;
  live.current.onClose = onClose;
  live.current.asking = asking;
  const api = useRef(null);
  if (!api.current) {
    const setAsk = (value) => { live.current.asking = value; setAsking(value); };
    api.current = {
      requestClose() {
        if (live.current.asking) { setAsk(false); return; }
        if (!live.current.dirty) { live.current.onClose?.(); return; }
        setAsk(true);
      },
      discard() { setAsk(false); live.current.onClose?.(); },
      keepEditing() { setAsk(false); },
      isAsking: () => live.current.asking,
    };
  }
  const { requestClose, discard, keepEditing, isAsking } = api.current;
  return {
    requestClose,
    asking,
    isAsking,
    confirmProps: { ...DISCARD_CONFIRM, open: asking, onConfirm: discard, onCancel: keepEditing },
  };
}
