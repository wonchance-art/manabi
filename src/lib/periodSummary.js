/**
 * 기간 요약 · 학습 진단지(STATS-MAP-001 · 오너 2026-11-02 KST: 「1번으로」 → 진단지 컨셉 「ㅇㅇ」 · 기준 「표준」 ·
 * 머리 숫자 「권장대로(공부한 날)」 · 메일은 별도 승인, 이번엔 복사).
 * 한 꾸러미에서 세 모양이 나온다 — 이번 주 창(기간 칩) · 진단지 화면 · 복사 텍스트. 숫자는 여기서 한 번만 정한다.
 * 순수 모듈 — 셈은 weeklyReport.buildRangeReport, 조회는 소비 화면 몫.
 */
import { dailyGoals } from './profileSummary.js';
import { learningDateString } from './growthStats.js';

const DAY_MS = 86400000;

/**
 * 표준(오너 「표준」) — 하루 기준 × 기간 일수. 하루 목표가 있는 축(복습 · 담기)은 목표 창 값(dailyGoals — 배움 「오늘 목표」와 같은 정본),
 * 목표가 없는 축은 manabi 기본값. 기본값은 이 표 하나만 고친다.
 */
export const STANDARD_PER_DAY = Object.freeze({
  metWords: 10,        // 만난 말 — 하루 10개
  readsCompleted: 2 / 7, // 완독 — 주 2편
  turns: 10,           // 대화 — 하루 10마디
  used: 0.5,           // 직접 쓴 말 — 이틀에 1개
});
/** 표준 범위 — 표준의 80 ~ 120%(인바디 「표준」 띠와 같은 결). 막대 눈금은 0 ~ 160% — 40%에서 자르면 그 아래 값이 빈 막대(0처럼)로 보였다(빌드 캡처 실측). */
export const STANDARD_BAND = Object.freeze({ low: 80, high: 120, min: 0, max: 160 });

export function periodStandards(profile, days) {
  const goals = dailyGoals(profile);
  const round = n => Math.max(1, Math.round(n));
  return {
    reviews: round(goals.review * days),
    newWords: round(goals.words * days),
    metWords: round(STANDARD_PER_DAY.metWords * days),
    readsCompleted: round(STANDARD_PER_DAY.readsCompleted * days),
    turns: round(STANDARD_PER_DAY.turns * days),
    used: round(STANDARD_PER_DAY.used * days),
  };
}

/** 표준 대비 % → 띠(이하 · 표준 · 이상). */
export function standardZone(pct) {
  if (pct == null) return null;
  return pct < STANDARD_BAND.low ? 'under' : pct > STANDARD_BAND.high ? 'over' : 'standard';
}
export const ZONE_LABEL = Object.freeze({ under: '표준 이하', standard: '표준', over: '표준 이상' });

/** ② 순환 균형 줄 — [{ key, label, value, unit, standard, pct, zone }]. 순서가 곧 화면 순서. */
export function balanceRows({ report, output = null, standards }) {
  const rows = [
    ['reviews', '복습', report?.reviews?.total ?? 0, '문항'],
    ['newWords', '새로 담은 말', report?.newWords ?? 0, '개'],
    ['metWords', '만난 말', report?.metWords ?? 0, '개'],
    ['readsCompleted', '완독', report?.readsCompleted ?? 0, '편'],
    ['turns', '대화', report?.conversation?.turns ?? 0, '마디'],
    ['used', '직접 쓴 말', output?.total ?? 0, '개'],
  ];
  return rows.map(([key, label, value, unit]) => {
    const standard = standards?.[key] || null;
    const pct = standard ? Math.round((value / standard) * 100) : null;
    return { key, label, value, unit, standard, pct, zone: standardZone(pct) };
  });
}

/** 기간 안에 공부한 날 수 — 공부한 날 칸과 같은 셈(studyDayCounts: 답 또는 담은 말이 있는 학습일). */
export function studyDaysIn(dayCounts, { startMs, days }) {
  let n = 0;
  for (let i = 0; i < days; i++) {
    const cell = dayCounts?.[learningDateString(startMs + i * DAY_MS + 12 * 3600e3)];
    if ((cell?.answers || 0) + (cell?.saved || 0) > 0) n += 1;
  }
  return n;
}

/** 기간 이름 — 창 제목 · 진단지 머리 · 복사 텍스트가 같은 말을 쓴다. */
export const PERIOD_LABEL = Object.freeze({ week: '이번 주', '30d': '지난 30일' });
export const PREV_LABEL = Object.freeze({ week: '지난주', '30d': '앞 30일' });

/** 'YYYY-MM-DD ~ MM-DD' — 학습일(04시) 기준. */
export function periodDates({ startMs, endMs }) {
  const a = learningDateString(startMs + 12 * 3600e3);
  const b = learningDateString(endMs - 12 * 3600e3);
  return `${a} ~ ${b.slice(5)}`;
}

/**
 * 복사 텍스트(에이전트 · 개인 메일에 붙여넣기) — 진단지와 같은 번호 · 같은 숫자. 0 · 없는 줄은 빼고(0 무표기),
 * 이름 · 이메일 · 답안 원문 · 개인 자료 제목은 넣지 않는다. 마지막 줄 `@manabi-summary`로 에이전트가 형식을 알아본다.
 */
export function periodSummaryText({ range, report, studyDays = null, balance = [], output = null, remet = null,
  retention = null, health = null, levels = null, history = null, next = [], language = null }) {
  const lines = [`# manabi 학습 진단지 · ${PERIOD_LABEL[range.kind] || '기간'} (${periodDates(range)}, 04시 기준)`];
  if (studyDays != null) lines.push(`공부한 날: ${studyDays} / ${range.days}`);
  const r = report || {};
  const acc = r.reviews?.accuracy == null ? null : Math.round(r.reviews.accuracy * 100);
  const comp = [];
  const inParts = [r.metWords ? `만난 말 ${r.metWords}` : '', r.readsCompleted ? `완독 ${r.readsCompleted}` : ''].filter(Boolean);
  if (inParts.length) comp.push(inParts.join(' · '));
  if (r.newWords) comp.push(`새로 담은 말 ${r.newWords}`);
  if (r.reviews?.total) comp.push(`복습 ${r.reviews.total}${acc != null ? ` (정답 ${acc}%)` : ''}`);
  const outParts = [output?.total ? `직접 쓴 말 ${output.total}` : '', r.conversation?.turns ? `대화 ${r.conversation.turns}마디` : ''].filter(Boolean);
  if (outParts.length) comp.push(outParts.join(' · '));
  if (comp.length) lines.push(`① 구성: ${comp.join(' / ')}`);
  const bal = balance.filter(b => b.pct != null);
  if (bal.length) lines.push(`② 균형(표준=100%): ${bal.map(b => `${b.label} ${b.pct}`).join(' · ')}`);
  const mem = [];
  if (retention?.pct != null) mem.push(`실제 기억률 ${retention.pct}%${retention.target ? ` (목표 ${retention.target}%)` : ''}`);
  if (health?.measured) mem.push(`선명 ${health.buckets.high} · 양호 ${health.buckets.mid} · 흐릿 ${health.buckets.low} · 위험 ${health.buckets.forgotten}`);
  if (mem.length) lines.push(`③ 기억${language ? `(${language})` : ''}: ${mem.join(' · ')}`);
  if (levels?.length) lines.push(`④ 수준(확보): ${levels.map(l => `${l.label} ${l.pct}%`).join(' · ')}`);
  if (history?.length) lines.push(`⑤ 변화(7일씩 · 복습): ${history.map(h => h.reviews).join(' ')}`);
  if (next.length) lines.push(`⑥ 다음: ${next.map(n => n.text).join(' · ')}`);
  const params = [];
  if (remet?.total) params.push(`다시 만난 말 ${remet.total}`);
  if (output?.firstTime) params.push(`처음 씀 ${output.firstTime}`);
  if (r.conversation?.fixed) params.push(`고친 문장 ${r.conversation.fixed}`);
  if (params.length) lines.push(`⑦ 세부: ${params.join(' · ')}`);
  lines.push('---', `@manabi-summary: v1 · period=${range.kind}`);
  return lines.join('\n');
}

/**
 * ⑤ 변화 기록 — 끝 시각에서 거꾸로 7일씩 n칸(오래된 → 최근). 셈은 buildRangeReport 그대로(복습 · 정답률 · 담은 말).
 * buildRange는 주입(weeklyReport.buildRangeReport) — 순수 모듈끼리 순환 import를 피한다.
 */
export function historyBuckets(rows, { endMs, buckets = 8, buildRange }) {
  const out = [];
  for (let i = buckets - 1; i >= 0; i--) {
    const end = endMs - i * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    const r = buildRange(rows, { startMs: start, endMs: end, prevStartMs: start });
    out.push({ startMs: start, endMs: end, reviews: r.reviews.total,
      accuracy: r.reviews.accuracy == null ? null : Math.round(r.reviews.accuracy * 100), newWords: r.newWords });
  }
  return out;
}
