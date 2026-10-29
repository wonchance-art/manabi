'use client';
// 단어 목록 바퀴 답 · 바퀴 읽기 · 쓰기(LEVEL-ROUND-001) — 규칙은 levelRounds(순수), 여기는 화면 연결만.
// 읽기 실패 · 게스트는 조용히(답 표시만 비고 O · X의 상태 길은 그대로). 답 쓰기는 logReviewEvents(fire-and-forget).
// 바퀴 표(user_level_rounds)가 없으면 roundsAvailable=false — 화면은 지금까지의 답 전부를 1바퀴로 본다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { logReviewEvents } from './reviewEvents';
import {
  createLevelAnswerQueue, currentLevelRound, deleteLevelRounds, fetchLevelAnswers, fetchLevelRounds, insertLevelRounds,
  isSameDayAnswer, lastLevelAnswers, levelAnswerEvent, levelAnswerOf, levelCancelEvent, levelRowsBetween,
} from './levelRounds';

const rowOf = (event) => ({ item_key: event.item_key, correct: event.correct, detail: event.detail, created_at: event.created_at });

export function useLevelAnswers(userId, { lang, level, enabled = true }) {
  const [rows, setRows] = useState([]); // 이 레벨의 답 줄(최신 순) — 받아 온 것 + 이 화면에서 누른 것
  const [rounds, setRounds] = useState({ available: false, rows: [] });
  const queue = useRef(null);
  const typed = useRef([]); // 받는 사이에 누른 답 · 취소 줄 — 받아 온 줄 앞에 다시 얹는다
  const scope = { lang, level };

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
    setRows([]);
    setRounds({ available: false, rows: [] });
    if (!userId || !enabled) return undefined;
    let alive = true;
    typed.current = [];
    fetchLevelAnswers(supabase, userId, { lang, level })
      .then((data) => { if (alive) setRows([...typed.current, ...data]); })
      .catch(() => {});
    fetchLevelRounds(supabase, userId, { lang, level })
      .then((data) => { if (alive) setRounds(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId, enabled, lang, level]);

  const push = (row) => {
    typed.current = [row, ...typed.current];
    setRows((cur) => [row, ...cur]);
  };
  const roundOf = useCallback((view) => currentLevelRound(rounds.rows, view), [rounds.rows]);
  // 단어 · 보기마다 마지막 답(바퀴와 무관) — 같은 날 규칙이 본다.
  const latest = useMemo(() => lastLevelAnswers(rows), [rows]);
  const latestRef = useRef(latest);
  latestRef.current = latest;
  // 이번 바퀴 답 — 보기마다 그 바퀴 시작 뒤의 줄만. 1바퀴(줄 없음)면 전부.
  const current = useMemo(() => {
    const since = new Map();
    for (const r of rounds.rows) {
      const t = Date.parse(r.started_at);
      if (!since.has(r.view) || t > since.get(r.view)) since.set(r.view, t);
    }
    return lastLevelAnswers(rows.filter((r) => !since.has(r.detail?.view) || Date.parse(r.created_at) >= since.get(r.detail.view)));
  }, [rows, rounds.rows]);
  const currentRef = useRef(current);
  currentRef.current = current;

  /** 답 — { sameDay }를 돌려준다(부르는 쪽이 「아는 단어로?」 판단에 쓴다). */
  const answer = useCallback((word, view, correct) => {
    const at = Date.now();
    const sameDay = isSameDayAnswer(latestRef.current, word, view, at);
    if (!userId || !queue.current) return { sameDay };
    const event = levelAnswerEvent({ lang, word, level, view, correct, sameDay, round: roundOf(view).round, at });
    queue.current.answer(word, view, event);
    push(rowOf(event));
    return { sameDay };
  }, [userId, lang, level, roundOf]);

  /** 이번 바퀴 답 취소 — 답이 없으면 아무 일도 없다. 대기 중이면 지우기만, 확정됐으면 취소 줄. */
  const cancel = useCallback((word, view) => {
    if (!userId || !queue.current || !levelAnswerOf(currentRef.current, word, view)) return;
    const event = levelCancelEvent({ lang, word, level, view, round: roundOf(view).round });
    if (!queue.current.cancel(word, view)) logReviewEvents(userId, [event]);
    push(rowOf(event));
  }, [userId, lang, level, roundOf]);

  /** 새 바퀴 — 보기 하나. 대기 답은 먼저 확정한다(지난 바퀴 답으로). 실패면 reject(화면이 알린다). */
  const startRound = useCallback(async (view, roundScope) => {
    queue.current?.flush();
    const next = { view, round_no: roundOf(view).round + 1, scope: roundScope, started_at: new Date().toISOString() };
    await insertLevelRounds(supabase, userId, scope, [next]);
    setRounds((cur) => ({ ...cur, rows: [...cur.rows, next] }));
    return next;
  }, [userId, lang, level, roundOf]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 방금 시작한 바퀴 되돌리기(「새 바퀴를 시작했어요 · 되돌리기」). */
  const undoRound = useCallback(async (started) => {
    await deleteLevelRounds(supabase, userId, scope, { view: started.view, round: started.round_no });
    setRounds((cur) => ({ ...cur, rows: cur.rows.filter((r) => !(r.view === started.view && r.round_no === started.round_no)) }));
  }, [userId, lang, level]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 초기화 — 이 레벨의 바퀴 줄을 바꿔 끼운다(지우고 views마다 새 1바퀴). 되돌리기용으로 지운 줄을 돌려준다. */
  const replaceRounds = useCallback(async (nextRows) => {
    queue.current?.flush();
    const before = rounds.rows;
    await deleteLevelRounds(supabase, userId, scope);
    if (nextRows.length) await insertLevelRounds(supabase, userId, scope, nextRows);
    setRounds((cur) => ({ ...cur, rows: nextRows }));
    return before;
  }, [userId, lang, level, rounds.rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const get = useCallback((word, view) => levelAnswerOf(current, word, view), [current]);
  /** 바퀴 시작 직전까지의 마지막 답(「모른 것만」 범위) — 보기 하나. */
  const before = useCallback((view) => {
    const round = roundOf(view);
    return lastLevelAnswers(round.startedAt == null ? [] : levelRowsBetween(rows, { before: round.startedAt }));
  }, [rows, roundOf]);
  return { answers: current, get, answer, cancel, roundOf, before, roundRows: rounds.rows, roundsAvailable: rounds.available, startRound, undoRound, replaceRounds };
}
