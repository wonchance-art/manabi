'use client';
// 단어 목록 바퀴 답 읽기 · 쓰기(LEVEL-ROUND-001) — 규칙은 levelRounds(순수), 여기는 화면 연결만.
// 읽기 실패 · 게스트는 조용히(답 표시만 비고 O · X의 상태 길은 그대로). 쓰기는 logReviewEvents(fire-and-forget).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { logReviewEvents } from './reviewEvents';
import {
  applyLevelAnswer, createLevelAnswerQueue, fetchLevelAnswers, isSameDayAnswer, lastLevelAnswers,
  levelAnswerEvent, levelAnswerKey, levelAnswerOf, levelCancelEvent,
} from './levelRounds';

export function useLevelAnswers(userId, { lang, level, enabled = true }) {
  const [answers, setAnswers] = useState(() => new Map());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const queue = useRef(null);
  const typed = useRef(new Map()); // 이 화면에서 누른 답 · 취소(키 → 답 | null) — 받아 온 답 위에 다시 얹는다

  // 계정 · 레벨이 바뀌거나 화면을 떠나면 대기 답을 확정한다. 탭을 숨길 때(pagehide · visibilitychange)도 — 닫힌 탭의 답이 사라지지 않게.
  useEffect(() => {
    if (!userId || !enabled) return undefined;
    const q = createLevelAnswerQueue((event) => logReviewEvents(userId, [event]));
    queue.current = q;
    const flush = () => q.flush();
    const onVisibility = () => { if (document.visibilityState === 'hidden') q.flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      q.flush();
      if (queue.current === q) queue.current = null;
    };
  }, [userId, enabled, lang, level]);

  useEffect(() => {
    setAnswers(new Map());
    if (!userId || !enabled) return undefined;
    let alive = true;
    typed.current = new Map();
    // 받는 사이에 누른 답 · 취소가 덮이지 않게 — 읽어 온 답 위에 이 화면의 답을 다시 얹는다.
    fetchLevelAnswers(supabase, userId, { lang, level })
      .then((rows) => {
        if (!alive) return;
        const merged = lastLevelAnswers(rows);
        for (const [key, answer] of typed.current) if (answer) merged.set(key, answer); else merged.delete(key);
        setAnswers(merged);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId, enabled, lang, level]);

  /** 답 — { sameDay }를 돌려준다(부르는 쪽이 「아는 단어로?」 판단에 쓴다). */
  const answer = useCallback((word, view, correct) => {
    const at = Date.now();
    const sameDay = isSameDayAnswer(answersRef.current, word, view, at);
    if (!userId || !queue.current) return { sameDay };
    queue.current.answer(word, view, levelAnswerEvent({ lang, word, level, view, correct, sameDay, at }));
    const next = { correct, at, sameDay };
    typed.current.set(levelAnswerKey(word, view), next);
    setAnswers((cur) => applyLevelAnswer(cur, word, view, next));
    return { sameDay };
  }, [userId, lang, level]);

  /** 이번 바퀴 답 취소 — 답이 없으면 아무 일도 없다. 대기 중이면 지우기만, 확정됐으면 취소 줄. */
  const cancel = useCallback((word, view) => {
    if (!userId || !queue.current || !levelAnswerOf(answersRef.current, word, view)) return;
    if (!queue.current.cancel(word, view)) logReviewEvents(userId, [levelCancelEvent({ lang, word, level, view })]);
    typed.current.set(levelAnswerKey(word, view), null);
    setAnswers((cur) => applyLevelAnswer(cur, word, view, null));
  }, [userId, lang, level]);

  const get = useCallback((word, view) => levelAnswerOf(answers, word, view), [answers]);
  return { answers, get, answer, cancel };
}
