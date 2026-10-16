// 단어 목록 키보드 조작(LEVEL-KEYS-001, 오너 목업 승인 2026-10-17 KST — 「O · X 뒤 다음 카드로 자동 이동」).
// 키 하나를 동작 이름으로만 바꾼다(화면 상태는 모른다). 무시: 입력기 조합(isComposing · keyCode 229 — imeComposing 정본),
// 입력 칸 · 찾기, 수정키 조합(Ctrl · ⌘ · Alt — 브라우저 단축키를 빼앗지 않는다), 이미 처리된 이벤트.
import { isImeComposing } from './imeComposing';

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const KEYS = Object.freeze({ ArrowDown: 'next', ArrowUp: 'prev', o: 'o', O: 'o', x: 'x', X: 'x', ' ': 'peek', Spacebar: 'peek', Escape: 'close' });

/** @returns {'next'|'prev'|'o'|'x'|'peek'|'close'|null} */
export function levelListKeyAction(event) {
  if (!event || event.defaultPrevented || isImeComposing(event)) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.target?.closest?.(EDITABLE) || event.target?.isContentEditable) return null;
  return KEYS[event.key] || null;
}

/** 지금 카드에서 delta만큼 옮긴 카드 키. 끝 너머면 grow(더 그릴 것이 있으면) — 범위 밖이면 null. */
export function levelListMove(keys, from, delta, { canGrow = false } = {}) {
  const i = keys.indexOf(from);
  if (i < 0) return keys.length ? { key: keys[0] } : null;
  const j = i + delta;
  if (j < 0) return null;
  if (j >= keys.length) return canGrow ? { grow: true } : null;
  return { key: keys[j] };
}

/** 화면 읽기 이름 — 그 보기에 보이는 것만(뜻 보기에서 글자를, 글자 보기에서 뜻을 미리 읽어 주지 않는다). */
export function levelCardLabel(entry, view, { known = false, studying = false } = {}) {
  const shown = view === 'word' ? entry.word
    : view === 'meaning' ? entry.meaning
      : view === 'sentence' ? (entry.ex?.text || '예문 없음')
        : view === 'audio' ? '소리 카드'
          : `${entry.word} — ${entry.meaning}`;
  return [shown, known ? '아는 단어' : studying ? '공부 중' : null].filter(Boolean).join(' · ');
}
