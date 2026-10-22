'use client';
// 단어 페이지 네 영역 체크(오너 승인 2026-10-21 KST) — 판정은 levelWordAreas(순수), 여기는 읽기 · 쓰기 연결만.
// 읽기: 이 레벨의 연습 답(review_events source 'level')을 이 기기에 받아 두고 다음부터는 그 뒤 줄만 받는다(이어 읽기) +
//       10-15 탭 표시(user_word_facets, 읽기만 — 하루 한 번 새로 받는다). 실패 · 손님은 조용히(연습 영역이 모두 처음으로 보인다).
// 쓰기: 연습 답은 바퀴 답과 같은 대기 → 확정 큐(levelRounds.createLevelAnswerQueue · logReviewEvents) — 다음 답 전 취소는 기록이 남지 않는다.
// 이 기기의 오늘 기록(첫 단어 채점 · 펼쳐 본 영역)은 같은 날 규칙에만 쓰인다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { logReviewEvents } from './reviewEvents';
import { createLevelAnswerQueue, fetchLevelAnswers, levelAnswerEvent, levelCancelEvent } from './levelRounds';
import { fetchWordFacets } from './wordFacets';
import { learningDay, schedulerTime } from './fsrsScheduler';
import { normalizeKnownWord } from './knownWordControl';
import { AREA_DAY_KEY, noteOpened, noteWordGrade, practiceFirstAnswers, readAreaDay } from './levelWordAreas';

const ROWS_KEY = 'manabi:level-areas-rows';
const FACETS_KEY = 'manabi:level-areas-facets';
const CACHE_LIMIT = 1_500_000; // 글자 수 — 넘으면 이 기기에 두지 않는다(매번 전부 받는다)
const SINCE_OVERLAP_MS = 24 * 3600 * 1000; // 이어 읽기 겹침 — 아래 「이어 읽기」 참고

const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (key, value) => {
  try {
    const text = JSON.stringify(value);
    if (text.length > CACHE_LIMIT) localStorage.removeItem(key); else localStorage.setItem(key, text);
  } catch { /* 저장소 없음 · 가득 참 — 이번 화면만 */ }
};
const compact = (r) => ({ id: r.id, item_key: r.item_key, correct: r.correct, detail: r.detail, created_at: r.created_at });

export function useLevelWordAreas(userId, { lang, level, enabled = true }) {
  const [rows, setRows] = useState([]);
  const [facets, setFacets] = useState([]);
  const [dayRec, setDayRec] = useState(() => readAreaDay(null));
  // 읽었는가 — 이 기기에 받아 둔 줄이 있거나 읽기가 끝났을 때(실패 포함). 연습 순서는 이 뒤에 정한다(빈 기록으로 줄을 세우지 않게).
  const [loaded, setLoaded] = useState(false);
  const queue = useRef(null);
  const typed = useRef([]);
  const rowsKey = `${ROWS_KEY}:${userId}:${lang}:${level}`;
  const facetsKey = `${FACETS_KEY}:${userId}:${lang}`;
  const dayKey = `${AREA_DAY_KEY}:${userId || 'guest'}:${lang}`;

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
    setDayRec(readAreaDay(readJson(dayKey)));
    setRows([]);
    setFacets([]);
    setLoaded(false);
    if (!userId || !enabled) return undefined;
    let alive = true;
    typed.current = [];
    const cached = readJson(rowsKey);
    const have = Array.isArray(cached?.rows) ? cached.rows : [];
    // 이어 읽기는 받아 둔 끝보다 하루 앞에서 — 다른 기기의 시계 차이 · 모아 두었다 늦게 보낸 답(created_at이 더 이르다)을
    // 놓치지 않게. 겹치는 줄은 아래에서 id로 거른다.
    const cachedUntil = typeof cached?.until === 'string' ? Date.parse(cached.until) : NaN;
    const since = Number.isFinite(cachedUntil) ? new Date(cachedUntil - SINCE_OVERLAP_MS).toISOString() : null;
    if (have.length) { setRows(have); setLoaded(true); }
    const untilIso = new Date().toISOString();
    fetchLevelAnswers(supabase, userId, { lang, level, untilIso, sinceIso: since })
      .then((fresh) => {
        if (!alive) return;
        const ids = new Set(have.map((r) => r.id));
        const merged = [...have, ...fresh.filter((r) => !ids.has(r.id)).map(compact)];
        writeJson(rowsKey, { until: untilIso, rows: merged });
        setRows([...merged, ...typed.current]);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    const today = learningDay(Date.now());
    const facetCache = readJson(facetsKey);
    if (facetCache?.day === today && Array.isArray(facetCache.rows)) setFacets(facetCache.rows);
    else fetchWordFacets(userId, lang).then((data) => { if (!alive) return; writeJson(facetsKey, { day: today, rows: data }); setFacets(data); }).catch(() => {});
    return () => { alive = false; };
  }, [userId, enabled, lang, level, rowsKey, facetsKey, dayKey]);

  const firsts = useMemo(() => practiceFirstAnswers(rows, facets), [rows, facets]);
  // 오늘 연습 답한 영역(단어 → 영역들) — 같은 날 규칙. 취소 줄도 「봤다」로 남긴다(답을 본 뒤의 취소다).
  const answeredToday = useMemo(() => {
    const today = learningDay(Date.now());
    const out = new Map();
    for (const r of rows) {
      const at = Date.parse(r.created_at);
      if (!Number.isFinite(at) || learningDay(schedulerTime(at)) !== today || !r.detail?.view) continue;
      const k = normalizeKnownWord(r.item_key);
      out.set(k, [...(out.get(k) || []), r.detail.view]);
    }
    return out;
  }, [rows]);

  const saveDay = useCallback((update) => setDayRec((cur) => {
    const next = update(readAreaDay(cur));
    if (next !== cur) writeJson(dayKey, next);
    return next;
  }), [dayKey]);
  const noteGrade = useCallback((word, rating) => saveDay((d) => noteWordGrade(d, word, rating)), [saveDay]);
  const noteOpen = useCallback((word, area) => saveDay((d) => noteOpened(d, word, area)), [saveDay]);

  /** 연습 답 — 대기에 올리고 바로 그린다. */
  const answer = useCallback((word, area, correct, sameDay) => {
    if (!userId || !queue.current) return null;
    const event = levelAnswerEvent({ lang, word, level, view: area, correct, sameDay });
    queue.current.answer(word, area, event);
    const row = { id: `local:${event.created_at}:${word}:${area}`, ...compact(event) };
    typed.current = [...typed.current, row];
    setRows((cur) => [...cur, row]);
    return row;
  }, [userId, lang, level]);
  /** 방금 답 되돌리기 — 대기 중이면 지우기만, 확정됐으면 취소 줄. */
  const cancel = useCallback((word, area, row) => {
    if (!userId || !queue.current) return;
    const event = levelCancelEvent({ lang, word, level, view: area });
    const dropped = queue.current.cancel(word, area);
    if (dropped) {
      typed.current = typed.current.filter((r) => r !== row);
      setRows((cur) => cur.filter((r) => r !== row));
      return;
    }
    logReviewEvents(userId, [event]);
    const line = { id: `local:${event.created_at}:${word}:${area}:x`, ...compact(event) };
    typed.current = [...typed.current, line];
    setRows((cur) => [...cur, line]);
  }, [userId, lang, level]);

  return { loaded, firsts, answeredToday, dayRec, noteGrade, noteOpen, answer, cancel };
}
