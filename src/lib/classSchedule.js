/**
 * 수업 일정 — 순수 부품(오너 확정 2026-10-08).
 *
 *   ① 수업은 정해진 요일(기본 화·목)에만, 한국 공휴일(krHolidays)은 건너뛴다
 *   ② 마지막 Day 날 = 수업 + 시험, 그다음 수업일은 휴강
 *   ③ 선생님이 어떤 Day의 날짜를 옮기면 그 뒤 Day·시험·휴강은 요일·공휴일 기준으로 다시 계산된다
 *      (뒤에 있던 옮김은 지운다 — 「자동으로 뒤 수업 일자들은 변동」)
 *   ④ 휴강일이 지나면 다음 바퀴(Day 1부터)가 휴강 다음 수업일에 자동으로 시작한다
 *
 * 저장 형태(팀 루트 metadata.team.schedule): { start, weekdays, moves: { [day]: date }, round }
 *   start  = 이번 바퀴 Day 1을 찾기 시작하는 날(그날 포함) · moves = 선생님이 옮긴 Day의 날짜
 * 날짜는 모두 KST 달력 날짜 문자열 'YYYY-MM-DD' — 시간대 계산은 kstToday 한 곳에서만.
 */
import { holidayName, holidayCovered } from './krHolidays.js';

export const DEFAULT_WEEKDAYS = Object.freeze([2, 4]); // 화·목
export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const MAX_SCAN = 400;

export function isDate(v) {
  const m = DATE_RE.exec(String(v || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const toUtc = (date) => { const m = DATE_RE.exec(date); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (date, n) => fromUtc(toUtc(date) + n * DAY_MS);
export const weekdayOf = (date) => new Date(toUtc(date)).getUTCDay();

/** 오늘(KST) — 기기 시간대와 무관하게 한국 날짜. */
export const kstToday = (now = new Date()) => fromUtc(now.getTime() + 9 * 3_600_000);

/** `2026-10-13` → `10/13(화)` */
export function shortDate(date) {
  if (!isDate(date)) return '';
  const m = DATE_RE.exec(date);
  return `${+m[2]}/${+m[3]}(${WEEKDAY_KO[weekdayOf(date)]})`;
}

/** 저장값 검증 — 형식이 틀린 칸은 버린다. start가 없으면 일정 없음(null). */
export function parseSchedule(raw) {
  if (!raw || typeof raw !== 'object' || !isDate(raw.start)) return null;
  const weekdays = Array.isArray(raw.weekdays)
    ? [...new Set(raw.weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const moves = {};
  for (const [k, v] of Object.entries(raw.moves && typeof raw.moves === 'object' ? raw.moves : {})) {
    const day = Number(k);
    if (Number.isInteger(day) && day >= 2 && day <= 99 && isDate(v)) moves[day] = v;
  }
  const round = Number.isInteger(Number(raw.round)) && Number(raw.round) >= 1 ? Number(raw.round) : 1;
  return { start: raw.start, weekdays: weekdays.length ? weekdays : [...DEFAULT_WEEKDAYS], moves, round };
}

/** from 다음(inclusive면 그날 포함) 첫 수업 가능일 — 정한 요일이면서 공휴일이 아닌 날. */
export function nextClassDate(from, weekdays, { inclusive = false } = {}) {
  let d = inclusive ? from : addDays(from, 1);
  for (let i = 0; i < MAX_SCAN; i += 1, d = addDays(d, 1)) {
    if (weekdays.includes(weekdayOf(d)) && !holidayName(d)) return d;
  }
  throw new Error('수업 요일을 찾지 못했어요.');
}

/**
 * 한 바퀴 일정 — { round, sessions:[{day,date,moved,holiday}], testDate, breakDate, nextStart, uncovered:[해] }.
 * 마지막 Day가 시험 날, 그다음 수업일이 휴강, 그다음 수업일이 다음 바퀴 Day 1.
 */
export function buildSchedule(schedule, totalDays) {
  const s = parseSchedule(schedule);
  if (!s || !(totalDays >= 1)) return null;
  const sessions = [];
  let prev = null;
  for (let day = 1; day <= totalDays; day += 1) {
    const natural = day === 1 ? nextClassDate(s.start, s.weekdays, { inclusive: true }) : nextClassDate(prev, s.weekdays);
    const moved = day > 1 && s.moves[day] && s.moves[day] > prev ? s.moves[day] : null;
    const date = moved || natural;
    sessions.push({ day, date, natural, moved: !!moved, holiday: holidayName(date) });
    prev = date;
  }
  const breakDate = nextClassDate(prev, s.weekdays);
  const nextStart = nextClassDate(breakDate, s.weekdays);
  const uncovered = [...new Set([...sessions.map((x) => x.date), breakDate, nextStart].filter((d) => !holidayCovered(d)).map((d) => Number(d.slice(0, 4))))];
  return { round: s.round, weekdays: s.weekdays, sessions, testDate: prev, breakDate, nextStart, uncovered };
}

/** 휴강일이 지났으면 다음 바퀴로 — 저장값은 그대로 두고 화면만 넘긴다(선생님이 고치면 넘긴 값으로 저장). */
export function currentSchedule(schedule, totalDays, today) {
  let s = parseSchedule(schedule);
  if (!s) return null;
  for (let i = 0; i < 200; i += 1) {
    const built = buildSchedule(s, totalDays);
    if (built.breakDate >= today) return { schedule: s, built };
    s = { start: built.nextStart, weekdays: s.weekdays, moves: {}, round: s.round + 1 };
  }
  return null;
}

export class ScheduleError extends Error {}

/**
 * Day의 날짜를 옮긴 새 저장값. Day 1을 옮기면 바퀴 시작이 바뀐다. 뒤 Day의 옮김은 지운다.
 * 바로 앞 Day 날짜보다 늦어야 한다(같은 날·이전 날 금지).
 */
export function moveSession(schedule, totalDays, day, date) {
  const s = parseSchedule(schedule);
  if (!s) throw new ScheduleError('먼저 첫 수업 날짜를 정해 주세요.');
  if (!isDate(date)) throw new ScheduleError('날짜를 다시 골라 주세요.');
  if (!(day >= 1 && day <= totalDays)) throw new ScheduleError('없는 Day예요.');
  if (day === 1) return { ...s, start: date, moves: {} };
  const built = buildSchedule(s, totalDays);
  const prev = built.sessions[day - 2].date;
  if (date <= prev) throw new ScheduleError(`Day ${day - 1}(${shortDate(prev)})보다 뒤 날짜여야 해요.`);
  const moves = Object.fromEntries(Object.entries(s.moves).filter(([k]) => Number(k) < day));
  if (date !== nextClassDate(prev, s.weekdays)) moves[day] = date;
  return { ...s, moves };
}

/** 옮긴 날짜를 원래대로 — 그 Day와 뒤 Day의 옮김을 지운다. */
export function resetSession(schedule, day) {
  const s = parseSchedule(schedule);
  if (!s) return null;
  return { ...s, moves: Object.fromEntries(Object.entries(s.moves).filter(([k]) => Number(k) < day)) };
}

/** 첫 일정 — 오늘(포함) 이후 첫 수업일부터. */
export function newSchedule(start, weekdays = DEFAULT_WEEKDAYS) {
  if (!isDate(start)) throw new ScheduleError('날짜를 다시 골라 주세요.');
  return { start, weekdays: [...weekdays], moves: {}, round: 1 };
}

/** 진행 상황 — 끝난 Day 수·오늘 수업·다음 수업·단계. */
export function scheduleProgress(built, today) {
  if (!built) return null;
  const done = built.sessions.filter((x) => x.date < today).length;
  const todays = built.sessions.find((x) => x.date === today) || null;
  const next = built.sessions.find((x) => x.date > today) || null;
  const total = built.sessions.length;
  const phase = done === 0 && !todays ? 'before'
    : todays && todays.day === total ? 'test-today'
      : done === total ? (built.breakDate === today ? 'break-today' : 'break-wait')
        : 'running';
  return { done, total, today: todays, next, phase };
}

export function sessionStatus(date, today) {
  return date < today ? 'done' : date === today ? 'today' : 'upcoming';
}

/** 옮기면 무엇이 바뀌나 — 저장 전 미리보기(시험일·휴강일이 며칠 밀리는지). */
export function moveImpact(schedule, totalDays, day, date) {
  const before = buildSchedule(schedule, totalDays);
  const after = buildSchedule(moveSession(schedule, totalDays, day, date), totalDays);
  const shifted = after.sessions.filter((x, i) => x.day > day && x.date !== before.sessions[i].date).length;
  return { before, after, shifted, testFrom: before.testDate, testTo: after.testDate };
}

/** 달력 한 달 — 일요일 시작 주 배열, 칸은 날짜 문자열 또는 null. */
export function monthGrid(year, month) {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lead = weekdayOf(first);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
