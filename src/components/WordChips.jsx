'use client';

/**
 * 단어 칩 한 줄(STATS-MAP-001 통합안 · 오너 「통합안으로 연계 넷이랑 같이 진행해」 2026-11-02 KST).
 * 다시 만난 말 · 직접 쓴 말 창, 완독 창, 첨삭 결과가 같은 칩을 쓴다 — 자리마다 칩을 따로 그리지 않는다.
 *  - 핵심 말(keys)은 채운 장미색 칩으로 맨 앞 · 나타날 때 한 번 퍼짐(움직임 줄이기면 없음).
 *    들어옴(다시 만난 말 · 완독) = 흐려지던 말, 나감(직접 쓴 말 · 첨삭) = 처음 씀.
 *  - 다섯 개가 넘으면 「+N」 — 누르면 새 창 없이 그 자리에서 펼친다.
 *  - 칩을 누르면 단어 카드(onWord). onWord가 없으면 누를 수 없는 칩.
 *  - 화면 읽기: 「駅 — 흐려지던 말 · 단어 카드」 — 색이 안 보여도 핵심이 전해진다.
 */
import { useEffect, useRef, useState } from 'react';
import './word-chips.css';

export const WORD_CHIPS_CAP = 5;

/** 핵심 말을 앞으로 — 같은 묶음 안의 순서는 그대로. */
export function orderWordChips(words, keys) {
  const list = Array.isArray(words) ? words : [];
  if (!keys?.size) return list;
  return [...list.filter(w => keys.has(w)), ...list.filter(w => !keys.has(w))];
}

export default function WordChips({ words, keys = null, keyLabel = '', onWord = null, cap = WORD_CHIPS_CAP, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const moved = useRef(false);
  useEffect(() => {
    // 펼친 뒤 「+N」이 사라져 초점이 body로 떨어지지 않게 — 새로 보인 첫 칩으로 잇는다.
    if (!open || !moved.current) return;
    moved.current = false;
    ref.current?.children?.[cap]?.focus?.();
  }, [open, cap]);
  const ordered = orderWordChips(words, keys);
  if (!ordered.length) return null;
  const shown = open ? ordered : ordered.slice(0, cap);
  const rest = ordered.length - shown.length;
  return (
    <span ref={ref} className={`word-chips ${className}`.trim()}>
      {shown.map(w => {
        const key = !!keys?.has(w);
        const said = key && keyLabel ? `${w} — ${keyLabel}` : w;
        return onWord
          ? <button key={w} type="button" className={key ? 'is-key' : undefined} onClick={() => onWord(w)} aria-label={`${said} · 단어 카드`}>{w}</button>
          : <span key={w} className={key ? 'is-key' : undefined}>{w}{key && keyLabel && <span className="sr-only"> — {keyLabel}</span>}</span>;
      })}
      {rest > 0 && (
        <button type="button" className="is-more" onClick={() => { moved.current = true; setOpen(true); }} aria-label={`${rest}개 더 보기`}>+{rest}</button>
      )}
    </span>
  );
}

/** 채운 칩 설명 — 자리마다가 아니라 칩 묶음 아래 한 번. 핵심 말이 없으면 그리지 않는다. */
export function WordChipsLegend({ label, show = true }) {
  if (!show || !label) return null;
  return <span className="word-chips-legend"><i aria-hidden="true" />{label}</span>;
}
