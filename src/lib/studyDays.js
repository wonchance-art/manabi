/**
 * 공부한 날(현황 히트맵 — 오너 결정 3, 2026-11-01 KST · STATS-MAP-001) — 학습일(04시)마다 답한 문항 + 담은 말.
 * 예전 히트맵은 단어를 담은 날만 셌다 — 복습만 한 날이 빈칸이었다.
 * 답 = weeklyReport.countsAsStudyAnswer(이번 주 「복습 N문항」과 같은 정의 — 연습 · 사전 · ui 제외). 날 = growthStats.learningDateString.
 * 순수 집계 + 조회 하나. 조회는 created_at · source만, 정본 완전 조회로 1000행에 잘리지 않게.
 */
import { supabase } from './supabase';
import { readCompleteLegacyRows } from './legacyReviewSync';
import { learningDateString } from './growthStats';
import { countsAsStudyAnswer } from './weeklyReport';

/** 공부한 날 기간 — 최근 52주(364일 · 「1년」), 가장 오른쪽 아래가 오늘. 칸에는 24주가 보이고 나머지는 옆으로 밀어 본다(오너 「ㅇㅋ」 2026-11-01 KST). */
export const STUDY_DAYS_SPAN = 364;

export function fetchStudyAnswerRows(userId, sinceIso) {
  return readCompleteLegacyRows(() => supabase.from('review_events')
    .select('id, source, created_at', { count: 'exact' })
    .eq('user_id', userId).neq('source', 'ui').gte('created_at', sinceIso),
  { orderBy: ['created_at', 'id'] });
}

/** { 'YYYY-MM-DD': { answers, saved } } — 시작 시각 이전 행은 뺀다. */
export function studyDayCounts({ answers = [], saved = [], sinceMs = -Infinity } = {}) {
  const days = {};
  const bump = (at, key) => {
    const t = Date.parse(at);
    if (!Number.isFinite(t) || t < sinceMs) return;
    const day = learningDateString(t);
    (days[day] ||= { answers: 0, saved: 0 })[key] += 1;
  };
  for (const e of answers) if (countsAsStudyAnswer(e)) bump(e.created_at, 'answers');
  for (const row of saved) bump(row?.created_at, 'saved');
  return days;
}

/** 칸 설명 — 「11월 2일 · 답 34 · 담은 말 5」, 아무것도 안 한 날은 「11월 2일 · 쉼」. 0인 항목은 쓰지 않는다. */
export function studyDayLabel(day, counts) {
  const head = `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`;
  const parts = [];
  if (counts?.answers) parts.push(`답 ${counts.answers}`);
  if (counts?.saved) parts.push(`담은 말 ${counts.saved}`);
  return parts.length ? `${head} · ${parts.join(' · ')}` : `${head} · 쉼`;
}
