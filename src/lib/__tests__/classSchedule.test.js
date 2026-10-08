import { describe, expect, it } from 'vitest';
import { KR_HOLIDAYS, HOLIDAY_YEARS, holidayName } from '../krHolidays.js';
import {
  parseSchedule, buildSchedule, currentSchedule, moveSession, resetSession, newSchedule, scheduleProgress,
  moveImpact, monthGrid, kstToday, shortDate, weekdayOf, nextClassDate, ScheduleError, DEFAULT_WEEKDAYS,
} from '../classSchedule.js';
import { getTeam } from '../classBoard.js';
import { indexFromRows } from '../server/classIndex.js';

/**
 * 계약: 수업 일정(오너 확정 2026-10-08)
 * ① 화·목만 · 한국 공휴일 건너뜀 ② 마지막 Day = 수업+시험, 다음 수업일 = 휴강
 * ③ Day 날짜를 옮기면 뒤 일정이 요일·공휴일 기준으로 다시 계산 ④ 휴강이 지나면 다음 바퀴 자동
 */
const N = 14;
const s0 = newSchedule('2026-10-13'); // 화요일

describe('공휴일 표', () => {
  it('2026·2027 — 대체공휴일은 평일, 핵심 날짜·요일이 맞다', () => {
    expect(HOLIDAY_YEARS).toEqual([2026, 2027]);
    for (const [date, name] of Object.entries(KR_HOLIDAYS)) {
      if (name.startsWith('대체공휴일')) expect([1, 2, 3, 4, 5], date).toContain(weekdayOf(date));
    }
    expect(weekdayOf('2026-02-17')).toBe(2); // 설날(화)
    expect(weekdayOf('2026-10-09')).toBe(5); // 한글날(금)
    expect(holidayName('2026-05-01')).toBe('노동절');
    expect(holidayName('2026-07-17')).toBe('제헌절');
    expect(holidayName('2027-02-09')).toBe('대체공휴일(설날)'); // 화요일 — 수업 건너뜀 대상
    expect(holidayName('2026-10-13')).toBeNull();
  });
});

describe('기본 일정 — 화·목, 공휴일 제외', () => {
  const b = buildSchedule(s0, N);

  it('2026-10-13(화) 시작: 14회가 모두 화·목, 마지막 날 시험, 다음 수업일 휴강, 그다음 다음 바퀴', () => {
    expect(b.sessions.map((x) => x.date)).toEqual([
      '2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29', '2026-11-03',
      '2026-11-05', '2026-11-10', '2026-11-12', '2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26',
    ]);
    expect(b.sessions.every((x) => DEFAULT_WEEKDAYS.includes(weekdayOf(x.date)))).toBe(true);
    expect(b.testDate).toBe('2026-11-26');
    expect(b.breakDate).toBe('2026-12-01');
    expect(b.nextStart).toBe('2026-12-03');
    expect(b.uncovered).toEqual([]);
  });

  it('공휴일 수업일은 건너뛴다 — 2027 설 대체공휴일(2/9 화)', () => {
    const c = buildSchedule(newSchedule('2027-02-04'), 3);
    expect(c.sessions.map((x) => x.date)).toEqual(['2027-02-04', '2027-02-11', '2027-02-16']);
    // 추석 2027(9/14 화·9/16 목) 연속 건너뜀
    expect(nextClassDate('2027-09-10', [2, 4])).toBe('2027-09-21');
  });

  it('시작일이 수업 요일이 아니면 그 뒤 첫 수업일이 Day 1', () => {
    expect(buildSchedule(newSchedule('2026-10-12'), N).sessions[0].date).toBe('2026-10-13');
  });

  it('표 밖의 해가 들어오면 uncovered로 알린다', () => {
    expect(buildSchedule(newSchedule('2027-11-30'), N).uncovered).toEqual([2028]);
  });
});

describe('날짜 옮기기 — 뒤 일정 자동 변동', () => {
  it('Day 5를 하루 미루면(수) Day 6부터 그 뒤 화·목으로 다시 계산되고 시험·휴강도 밀린다', () => {
    const moved = moveSession(s0, N, 5, '2026-10-28');
    const b = buildSchedule(moved, N);
    expect(b.sessions[4]).toMatchObject({ day: 5, date: '2026-10-28', moved: true });
    expect(b.sessions[5].date).toBe('2026-10-29');
    expect(b.testDate).toBe('2026-11-26');
    const later = buildSchedule(moveSession(s0, N, 5, '2026-11-03'), N);
    expect(later.sessions.slice(4, 7).map((x) => x.date)).toEqual(['2026-11-03', '2026-11-05', '2026-11-10']);
    // 10/27 → 11/03은 수업일 두 칸 뒤 — 시험·휴강도 두 칸 밀린다
    expect(later.testDate).toBe('2026-12-03');
    expect(later.breakDate).toBe('2026-12-08');
  });

  it('뒤 Day의 옮김은 지우고, 앞 Day의 옮김은 지킨다', () => {
    const a = moveSession(s0, N, 3, '2026-10-21');
    const b = moveSession(a, N, 8, '2026-11-09');
    expect(b.moves).toEqual({ 3: '2026-10-21', 8: '2026-11-09' });
    const c = moveSession(b, N, 5, '2026-10-30');
    expect(c.moves).toEqual({ 3: '2026-10-21', 5: '2026-10-30' });
  });

  it('원래 날짜로 옮기면 옮김으로 남기지 않는다 · 원래대로 되돌리기', () => {
    expect(moveSession(s0, N, 4, '2026-10-22').moves).toEqual({});
    const m = moveSession(s0, N, 4, '2026-10-23');
    expect(resetSession(m, 4).moves).toEqual({});
  });

  it('앞 Day와 같거나 이른 날은 거절 · Day 1을 옮기면 바퀴 시작이 바뀐다', () => {
    expect(() => moveSession(s0, N, 3, '2026-10-15')).toThrow(ScheduleError);
    expect(() => moveSession(s0, N, 3, '2026-10-14')).toThrow(/Day 2/);
    expect(() => moveSession(s0, N, 3, 'nope')).toThrow(ScheduleError);
    const m = moveSession(moveSession(s0, N, 6, '2026-10-30'), N, 1, '2026-10-20');
    expect(m).toMatchObject({ start: '2026-10-20', moves: {} });
  });

  it('공휴일로 옮기는 것은 허용(보강)하되 표시한다', () => {
    const b = buildSchedule(moveSession(newSchedule('2026-12-01'), N, 2, '2026-12-25'), N);
    expect(b.sessions[1]).toMatchObject({ date: '2026-12-25', holiday: '성탄절' });
  });

  it('미리보기 — 몇 회가 밀리고 시험일이 언제로 바뀌는지', () => {
    const imp = moveImpact(s0, N, 5, '2026-11-03');
    expect(imp.shifted).toBe(9);
    expect(imp).toMatchObject({ testFrom: '2026-11-26', testTo: '2026-12-03' });
  });
});

describe('바퀴·진행 상황', () => {
  it('휴강일이 지나면 다음 바퀴(Day 1 = 휴강 다음 수업일)를 보여 준다', () => {
    expect(currentSchedule(s0, N, '2026-12-01').built.round).toBe(1);
    const next = currentSchedule(s0, N, '2026-12-02');
    expect(next.built.round).toBe(2);
    expect(next.built.sessions[0].date).toBe('2026-12-03');
    expect(next.schedule.moves).toEqual({});
  });

  it('진행 단계 — 개강 전 · 진행 중 · 시험 당일 · 휴강', () => {
    const b = buildSchedule(s0, N);
    expect(scheduleProgress(b, '2026-10-01')).toMatchObject({ phase: 'before', done: 0 });
    expect(scheduleProgress(b, '2026-10-21')).toMatchObject({ phase: 'running', done: 3, next: { day: 4 } });
    expect(scheduleProgress(b, '2026-10-22')).toMatchObject({ phase: 'running', done: 3, today: { day: 4 } });
    expect(scheduleProgress(b, '2026-11-26')).toMatchObject({ phase: 'test-today', done: 13 });
    expect(scheduleProgress(b, '2026-11-30')).toMatchObject({ phase: 'break-wait', done: 14 });
    expect(scheduleProgress(b, '2026-12-01')).toMatchObject({ phase: 'break-today' });
  });

  it('KST 오늘 — UTC 15:00 이후는 다음 날', () => {
    expect(kstToday(new Date('2026-10-12T14:59:00Z'))).toBe('2026-10-12');
    expect(kstToday(new Date('2026-10-12T15:00:00Z'))).toBe('2026-10-13');
  });

  it('달력 — 일요일 시작, 2026년 10월은 목요일 1일', () => {
    const g = monthGrid(2026, 10);
    expect(g[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(shortDate('2026-10-13')).toBe('10/13(화)');
  });
});

describe('저장값 검증과 전달', () => {
  it('형식이 틀린 칸은 버린다', () => {
    expect(parseSchedule(null)).toBeNull();
    expect(parseSchedule({ start: '2026-02-30' })).toBeNull();
    expect(parseSchedule({ start: '2026-10-13', weekdays: [9, 'x'], moves: { 1: '2026-10-14', 3: 'bad', 4: '2026-10-23' }, round: 0 }))
      .toEqual({ start: '2026-10-13', weekdays: [2, 4], moves: { 4: '2026-10-23' }, round: 1 });
  });

  it('팀 루트 → getTeam → 학생 목록 페이로드까지 실린다', () => {
    const team = getTeam({ team: { key: 'culcom', root: true, name: 'A', course: 'nihongo42', schedule: s0 } });
    expect(team.schedule).toEqual(s0);
    expect(indexFromRows({ team }).team.schedule).toEqual(s0);
    expect(getTeam({ team: { key: 'culcom', root: true } }).schedule).toBeNull();
  });
});
