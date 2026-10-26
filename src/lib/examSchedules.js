// 공식 시험 일정에서 목표 고르기(LEVEL-ROUND-001 K — 설계 「단어장 여러 바퀴」 K, 오너 제안 2026-10-19 KST).
// 일정은 실시간으로 긁지 않는다(공식 API · 피드 없음). 공식 출처(HSK한국사무국 · chinesetest.cn · jlpt.or.kr · jlpt.jp)와
// 대조한 날짜만 data/examSchedules.json에 싣고, 줄마다 출처 · 확인일을 둔다. 대조 안 된 줄은 싣지 않는다.
// 고르면 목표 창의 지금 저장 길(profiles dday_date · dday_label · goal_lang · goal_level) 그대로 — 새 표 없음.
import rows from './data/examSchedules.json';
import { kstDayStartMs } from './growthStats';
import { zhHskLevelLabel } from './zhHskLevel';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 시험별 급수 단추 — key = 단어 목록 · 목표 과정 키(H1~H7 · N5~N1), goal = 목표 과정에 저장할 키(과정이 없는 급수는 null). */
export const EXAM_KINDS = Object.freeze({
  // 이름은 급수 라벨 정본(zhHskLevelLabel)에서. 7–9급은 목표 과정이 없어 goal = null.
  HSK: { lang: 'Chinese', levels: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ key: `H${n}`, label: n === 7 ? zhHskLevelLabel(7).slice(4) : String(n),
    goal: n === 7 ? null : `H${n}`, name: `${zhHskLevelLabel(n)}급` })) },
  JLPT: { lang: 'Japanese', levels: ['N5', 'N4', 'N3', 'N2', 'N1'].map((n) => ({ key: n, label: n, goal: n, name: `JLPT ${n}` })) },
});
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFICIAL = /^https:\/\/(www\.)?(newhsk\.or\.kr|hsk\.or\.kr|chinesetest\.cn|jlpt\.or\.kr|jlpt\.jp)\//;

/** 줄 하나가 실을 만한가 — 시험 · 급수 · 날짜 · 공식 출처 · 확인일. 화면은 이것을 통과한 줄만 쓴다(계약이 파일 전체를 같은 규칙으로 본다). */
export function isExamRow(r) {
  const kind = EXAM_KINDS[r?.exam];
  return !!kind && Array.isArray(r.levels) && r.levels.length > 0 && r.levels.every((l) => kind.levels.some((x) => x.key === l))
    && DATE.test(r.date || '') && DATE.test(r.checkedAt || '') && OFFICIAL.test(r.source || '')
    && (r.format == null || ['IBT', 'PBT'].includes(r.format)) && (r.edition == null || (r.exam === 'HSK' && r.edition === '2.0'))
    && (r.register == null || (DATE.test(r.register.from || '') && DATE.test(r.register.to || '')));
}
export const EXAM_SCHEDULES = Object.freeze(rows.filter(isExamRow));

const at = (date) => Date.parse(`${date}T00:00:00+09:00`);
const monthDay = (date) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;

/** 고를 수 있는 시험 날짜 — 그 시험 · 급수의 오늘(KST) 이후 날짜, 가까운 순. */
export function examDatesFor(list, exam, level, nowMs = Date.now()) {
  const today = kstDayStartMs(nowMs);
  return (list || []).filter((r) => r.exam === exam && r.levels.includes(level) && at(r.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.format).localeCompare(String(b.format)));
}

/** 'YYYY-MM-DD'(KST) → 「12월 13일 일요일」 — 목표 창의 날짜 카드 · 지금 목표 칸이 같은 표기를 쓴다. */
export function examDayLabel(date) {
  if (!DATE.test(date || '')) return null;
  return `${monthDay(date)} ${WEEKDAYS[new Date(at(date) + 9 * 3600_000).getUTCDay()]}요일`;
}

/** 날짜 카드의 시험 이름 — 「JLPT 2026년 2회」(7월 = 1회 · 12월 = 2회, 한국 시행 기준) · 「기존 HSK(2.0)」 · 「HSK」.
 *  edition '2.0' = 개편(HSK 3.0, 2026-12 시행) 전 회차 — 우리 단어 목록(새 대강)과 출제 범위가 달라 「기존」을 붙인다. */
export function examRoundName(r) {
  if (r.exam === 'JLPT') return `JLPT ${r.date.slice(0, 4)}년 ${Number(r.date.slice(5, 7)) <= 8 ? 1 : 2}회`;
  return r.edition === '2.0' ? `기존 ${r.exam}(2.0)` : r.exam;
}

/**
 * 목표 창의 날짜 카드(GOAL-SHEET-001 — 오너 승인 목업 2026-10-26 KST) — 같은 날 · 같은 판(기존 · 새)의 IBT · PBT 줄을 카드 하나로 합친다.
 * 접수 기간은 싣지 않는다(오너 「접수 일정은 굳이 안 넣어도 될 듯」). { key, date, day, name, formats, rows }, 가까운 순.
 */
export function examDateCards(list, exam, level, nowMs = Date.now()) {
  const cards = new Map();
  for (const r of examDatesFor(list, exam, level, nowMs)) {
    const key = `${r.date}|${r.edition || ''}`;
    if (!cards.has(key)) cards.set(key, { key, date: r.date, day: examDayLabel(r.date), name: examRoundName(r), formats: [], rows: [] });
    const card = cards.get(key);
    card.rows.push(r);
    if (r.format && !card.formats.includes(r.format)) card.formats.push(r.format);
  }
  return [...cards.values()].map((c) => ({ ...c, formats: c.formats.sort() }));
}

/** 카드 → 저장 값. 형식이 하나뿐이면 examGoalOf 그대로(「… IBT」), IBT · PBT를 합친 카드는 형식이 뜻을 잃어 뺀다(「HSK 4급」). */
export function examCardGoal(card, level) {
  return examGoalOf({ ...card.rows[0], format: card.formats.length === 1 ? card.formats[0] : null }, level);
}

/** 고른 날짜 → 목표 창 저장 값. 이름은 이름 칸 길이(12자) 안에서 「HSK 4급 IBT」 · 「JLPT N3」. */
export function examGoalOf(r, level) {
  const kind = EXAM_KINDS[r.exam];
  const lv = kind.levels.find((x) => x.key === level);
  return { date: r.date, label: `${lv.name}${r.format ? ` ${r.format}` : ''}`.slice(0, 12), lang: lv.goal ? kind.lang : '', level: lv.goal || '' };
}

/** 확인 안내 한 줄 — 「공식 일정 · 10월 19일 확인」(가장 오래된 확인일). */
export function examCheckedLine(list) {
  const oldest = (list || []).map((r) => r.checkedAt).sort()[0];
  return oldest ? `공식 일정 · ${monthDay(oldest)} 확인` : '';
}
