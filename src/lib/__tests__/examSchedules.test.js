// 공식 시험 일정에서 목표 고르기(LEVEL-ROUND-001 K) — 실을 수 있는 줄 · 날짜 줄 · 저장 값 · 파일 계약.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { EXAM_KINDS, EXAM_SCHEDULES, examCheckedLine, examDateLine, examDatesFor, examGoalOf, isExamRow } from '../examSchedules.js';

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
  });

  it('날짜 목록 — 그 시험 · 급수의 오늘 이후, 가까운 순', () => {
    const list = [row({ date: '2027-01-10' }), row({ date: '2026-10-10' }), row(), row({ levels: ['H7'], date: '2026-12-06' }), row({ exam: 'JLPT', levels: ['N3'], source: 'https://www.jlpt.jp/e/' })];
    expect(examDatesFor(list, 'HSK', 'H4', KST('2026-10-19T12:00:00')).map((r) => r.date)).toEqual(['2026-12-13', '2027-01-10']);
    expect(examDatesFor(list, 'HSK', 'H7', KST('2026-10-19T12:00:00')).map((r) => r.date)).toEqual(['2026-12-06']);
  });

  it('날짜 줄 — 요일 · 형식 · D-n · 접수 상태(끝남은 흐리게)', () => {
    expect(examDateLine(row(), KST('2026-10-19T12:00:00'))).toEqual({ text: '12월 13일(일) IBT · D-55 · 접수 10월 20일부터', closed: false });
    expect(examDateLine(row(), KST('2026-10-25T12:00:00')).text).toBe('12월 13일(일) IBT · D-49 · 접수 마감 11월 9일');
    expect(examDateLine(row(), KST('2026-11-10T09:00:00'))).toEqual({ text: '12월 13일(일) IBT · D-33 · 접수 끝남', closed: true });
    expect(examDateLine(row({ register: null, format: null }), KST('2026-12-13T09:00:00')).text).toBe('12월 13일(일) · D-Day');
  });

  it('저장 값 — 날짜 · 이름(12자 안) · 목표 과정(7–9급은 과정이 없어 비움)', () => {
    expect(examGoalOf(row(), 'H4')).toEqual({ date: '2026-12-13', label: 'HSK 4급 IBT', lang: 'Chinese', level: 'H4' });
    expect(examGoalOf(row({ levels: ['H7'] }), 'H7')).toEqual({ date: '2026-12-13', label: 'HSK 7–9급 IBT', lang: '', level: '' });
    expect(examGoalOf(row({ exam: 'JLPT', levels: ['N3'], format: null }), 'N3')).toEqual({ date: '2026-12-13', label: 'JLPT N3', lang: 'Japanese', level: 'N3' });
    expect(examCheckedLine([row({ checkedAt: '2026-10-21' }), row()])).toBe('공식 일정 기준 · 10월 19일 확인');
  });

  it('계약: 파일의 모든 줄이 대조 규칙을 통과 · 목표 과정 키는 목록 키와 같음 · 저장은 목표 창의 persist 그대로', () => {
    const file = JSON.parse(fs.readFileSync('src/lib/data/examSchedules.json', 'utf8'));
    expect(Array.isArray(file)).toBe(true);
    expect(file.filter((r) => !isExamRow(r))).toEqual([]);
    expect(EXAM_SCHEDULES).toHaveLength(file.length);
    expect(EXAM_KINDS.HSK.levels.map((l) => l.key)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7']);
    const page = fs.readFileSync('src/views/ProfileStats.jsx', 'utf8');
    expect(page).toContain('const g = examGoalOf(examPick, examLevel); persist(g.date, g.label, g.lang, g.level);');
    expect(page).toContain('examKinds.length > 0 &&'); // 대조한 일정이 없으면 단추 없음
    expect(page).toContain('rel="noopener noreferrer">출처 ↗</a>');
  });
});
