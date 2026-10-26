// 공식 시험 일정에서 목표 고르기(LEVEL-ROUND-001 K) — 실을 수 있는 줄 · 날짜 줄 · 저장 값 · 파일 계약.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  EXAM_KINDS, EXAM_SCHEDULES, examCardGoal, examCheckedLine, examDateCards, examDatesFor, examDayLabel, examGoalOf, examRoundName, isExamRow,
} from '../examSchedules.js';

const KST = (s) => Date.parse(`${s}+09:00`);
const row = (over = {}) => ({ exam: 'HSK', levels: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'], date: '2026-12-13', format: 'IBT', region: 'KR',
  register: { from: '2026-10-20', to: '2026-11-09' }, result: null, source: 'https://www.newhsk.or.kr/schedule', checkedAt: '2026-10-19', ...over });

describe('K 공식 시험 일정', () => {
  it('실을 수 있는 줄 — 공식 출처 · 확인일 · 날짜 · 아는 급수만', () => {
    expect(isExamRow(row())).toBe(true);
    expect(isExamRow(row({ exam: 'JLPT', levels: ['N5', 'N1'], format: null, register: null, source: 'https://www.jlpt.or.kr/main' }))).toBe(true);
    expect(isExamRow(row({ source: 'https://blog.example.com/hsk' }))).toBe(false); // 학원 · 블로그는 힌트로만
    expect(isExamRow(row({ checkedAt: undefined }))).toBe(false);
    expect(isExamRow(row({ levels: ['N3'] }))).toBe(false);
    expect(isExamRow(row({ date: '12/13' }))).toBe(false);
    expect(isExamRow(row({ format: 'ONLINE' }))).toBe(false);
    expect(isExamRow(row({ edition: '2.0' }))).toBe(true);
    expect(isExamRow(row({ edition: '3.0' }))).toBe(false); // 표시는 개편 전 회차만
  });

  it('날짜 목록 — 그 시험 · 급수의 오늘 이후, 가까운 순', () => {
    const list = [row({ date: '2027-01-10' }), row({ date: '2026-10-10' }), row(), row({ levels: ['H7'], date: '2026-12-06' }), row({ exam: 'JLPT', levels: ['N3'], source: 'https://www.jlpt.jp/e/' })];
    expect(examDatesFor(list, 'HSK', 'H4', KST('2026-10-19T12:00:00')).map((r) => r.date)).toEqual(['2026-12-13', '2027-01-10']);
    expect(examDatesFor(list, 'HSK', 'H7', KST('2026-10-19T12:00:00')).map((r) => r.date)).toEqual(['2026-12-06']);
  });

  it('날짜 카드(GOAL-SHEET-001) — 「12월 13일 일요일」 · 시험 이름 · 같은 날 IBT · PBT는 한 장 · 접수 기간은 싣지 않는다', () => {
    expect(examDayLabel('2026-12-13')).toBe('12월 13일 일요일');
    expect(examDayLabel('2026-11-07')).toBe('11월 7일 토요일');
    expect(examDayLabel('12/13')).toBeNull();
    expect(examRoundName(row({ exam: 'JLPT', date: '2026-12-06' }))).toBe('JLPT 2026년 2회');
    expect(examRoundName(row({ exam: 'JLPT', date: '2027-07-04' }))).toBe('JLPT 2027년 1회');
    expect(examRoundName(row({ edition: '2.0' }))).toBe('기존 HSK(2.0)');
    expect(examRoundName(row())).toBe('HSK');
    const list = [row({ format: 'PBT' }), row(), row({ date: '2026-11-07', edition: '2.0' }), row({ date: '2026-11-07', edition: '2.0', format: 'PBT' }),
      row({ levels: ['H7'], date: '2026-11-22' })];
    const cards = examDateCards(list, 'HSK', 'H4', KST('2026-10-26T12:00:00'));
    expect(cards.map((c) => [c.date, c.day, c.name, c.formats, c.rows.length])).toEqual([
      ['2026-11-07', '11월 7일 토요일', '기존 HSK(2.0)', ['IBT', 'PBT'], 2],
      ['2026-12-13', '12월 13일 일요일', 'HSK', ['IBT', 'PBT'], 2],
    ]);
    expect(JSON.stringify(cards.map(({ rows, ...c }) => c))).not.toMatch(/register|접수/);
    // 형식이 하나뿐인 날은 그대로 · 형식 없는 시험(JLPT)은 꼬리표 없음
    expect(examDateCards(list, 'HSK', 'H7', KST('2026-10-26T12:00:00')).map((c) => c.formats)).toEqual([['IBT']]);
    expect(examDateCards([row({ exam: 'JLPT', levels: ['N3'], format: null, date: '2026-12-06' })], 'JLPT', 'N3', KST('2026-10-26T12:00:00'))[0].formats).toEqual([]);
  });

  it('날짜 카드 → 저장 값 — 합친 카드는 형식을 뺀다(「HSK 4급」), 한 형식뿐이면 examGoalOf 그대로', () => {
    const list = [row(), row({ format: 'PBT' }), row({ levels: ['H7'], date: '2026-11-22' })];
    const [both] = examDateCards(list, 'HSK', 'H4', KST('2026-10-26T12:00:00'));
    expect(examCardGoal(both, 'H4')).toEqual({ date: '2026-12-13', label: 'HSK 4급', lang: 'Chinese', level: 'H4' });
    const [ibt] = examDateCards(list, 'HSK', 'H7', KST('2026-10-26T12:00:00'));
    expect(examCardGoal(ibt, 'H7')).toEqual(examGoalOf(list[2], 'H7'));
    expect(examCardGoal(ibt, 'H7').label).toBe('HSK 7–9급 IBT');
    const [jlpt] = examDateCards([row({ exam: 'JLPT', levels: ['N3'], format: null, date: '2026-12-06' })], 'JLPT', 'N3', KST('2026-10-26T12:00:00'));
    expect(examCardGoal(jlpt, 'N3')).toEqual({ date: '2026-12-06', label: 'JLPT N3', lang: 'Japanese', level: 'N3' });
  });

  it('저장 값 — 날짜 · 이름(12자 안) · 목표 과정(7–9급은 과정이 없어 비움)', () => {
    expect(examGoalOf(row(), 'H4')).toEqual({ date: '2026-12-13', label: 'HSK 4급 IBT', lang: 'Chinese', level: 'H4' });
    expect(examGoalOf(row({ levels: ['H7'] }), 'H7')).toEqual({ date: '2026-12-13', label: 'HSK 7–9급 IBT', lang: '', level: '' });
    expect(examGoalOf(row({ exam: 'JLPT', levels: ['N3'], format: null }), 'N3')).toEqual({ date: '2026-12-13', label: 'JLPT N3', lang: 'Japanese', level: 'N3' });
    expect(examCheckedLine([row({ checkedAt: '2026-10-21' }), row()])).toBe('공식 일정 · 10월 19일 확인');
  });

  it('계약: 파일의 모든 줄이 대조 규칙을 통과 · 목표 과정 키는 목록 키와 같음 · 저장은 목표 창의 persist 그대로', () => {
    const file = JSON.parse(fs.readFileSync('src/lib/data/examSchedules.json', 'utf8'));
    expect(Array.isArray(file)).toBe(true);
    expect(file.filter((r) => !isExamRow(r))).toEqual([]);
    expect(EXAM_SCHEDULES).toHaveLength(file.length);
    expect(EXAM_KINDS.HSK.levels.map((l) => l.key)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7']);
    // 목표 창(GOAL-SHEET-001): 카드 → examCardGoal → persist(날짜, 이름, 언어, 레벨). 대조한 일정이 없는 언어는 시험 칩 대신 「목표 수준」.
    const lib = fs.readFileSync('src/lib/goalSheet.js', 'utf8');
    expect(lib).toContain('const g = examCardGoal(card, lv.key);\n      return [g.date, g.label, g.lang, g.level];');
    expect(lib).toContain('EXAM_KINDS[k].lang === lang && schedules.some(r => r.exam === k)');
    const page = fs.readFileSync('src/components/goal/GoalSheet.jsx', 'utf8');
    expect(page).toContain("if (plan.kind === 'persist') persist(...plan.args);");
    expect(page).toContain('rel="noopener noreferrer">출처 ↗</a>');
    // 접수 기간은 화면에 없다(오너 「접수 일정은 굳이 안 넣어도 될 듯」)
    // 데이터의 접수 기간(register)은 대조 규칙(isExamRow)만 보고, 화면 · 목표 창 계산은 읽지 않는다.
    const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code(page + lib)).not.toMatch(/접수|\.register\b|examDateLine/);
    expect(fs.readFileSync('src/lib/examSchedules.js', 'utf8')).not.toContain('examDateLine');
  });
});
