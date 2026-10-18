// 공식 시험 일정에서 목표 고르기(LEVEL-ROUND-001 K — 설계 「단어장 여러 바퀴」 K, 오너 제안 2026-10-19 KST).
// 일정은 실시간으로 긁지 않는다(공식 API · 피드 없음). 공식 출처(HSK한국사무국 · chinesetest.cn · jlpt.or.kr · jlpt.jp)와
// 대조한 날짜만 data/examSchedules.json에 싣고, 줄마다 출처 · 확인일을 둔다. 대조 안 된 줄은 싣지 않는다.
// 고르면 목표 창의 지금 저장 길(profiles dday_date · dday_label · goal_lang · goal_level) 그대로 — 새 표 없음.
import rows from './data/examSchedules.json';
import { kstDateString, kstDayStartMs } from './growthStats';
import { zhHskLevelLabel } from './zhHskLevel';

const DAY_MS = 86_400_000;
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
    && (r.format == null || ['IBT', 'PBT'].includes(r.format))
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

/** 날짜 줄 — 「12월 13일(일) IBT · D-55 · 접수 마감 11월 9일」. closed = 접수가 끝남(흐리게 — 이미 접수한 사람용). */
export function examDateLine(r, nowMs = Date.now()) {
  const today = kstDateString(nowMs);
  const days = Math.round((at(r.date) - kstDayStartMs(nowMs)) / DAY_MS);
  const head = `${monthDay(r.date)}(${WEEKDAYS[new Date(at(r.date) + 9 * 3600_000).getUTCDay()]})${r.format ? ` ${r.format}` : ''} · ${days === 0 ? 'D-Day' : `D-${days}`}`;
  const reg = r.register;
  if (!reg) return { text: head, closed: false };
  if (today > reg.to) return { text: `${head} · 접수 끝남`, closed: true };
  if (today < reg.from) return { text: `${head} · 접수 ${monthDay(reg.from)}부터`, closed: false };
  return { text: `${head} · 접수 마감 ${monthDay(reg.to)}`, closed: false };
}

/** 고른 날짜 → 목표 창 저장 값. 이름은 이름 칸 길이(12자) 안에서 「HSK 4급 IBT」 · 「JLPT N3」. */
export function examGoalOf(r, level) {
  const kind = EXAM_KINDS[r.exam];
  const lv = kind.levels.find((x) => x.key === level);
  return { date: r.date, label: `${lv.name}${r.format ? ` ${r.format}` : ''}`.slice(0, 12), lang: lv.goal ? kind.lang : '', level: lv.goal || '' };
}

/** 확인 안내 한 줄 — 「공식 일정 기준 · 10월 19일 확인」(가장 오래된 확인일). */
export function examCheckedLine(list) {
  const oldest = (list || []).map((r) => r.checkedAt).sort()[0];
  return oldest ? `공식 일정 기준 · ${monthDay(oldest)} 확인` : '';
}
