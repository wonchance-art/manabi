import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 코스 탭 표시 계약(오너 확정 2026-10-08) — 정적 렌더로 사용자가 보는 결과를 고정한다.
 * - 챕터 줄 = Ch.N · 일본어 패턴 · 한국어 제목(강조 없이 — 오너 결정 2026-10-08)
 * - 날짜·진행·달력·시험(마지막 Day)·휴강 줄
 * - 일정 편집(날짜 변경·일정 만들기)은 팀 루트 소유자에게만 — 학생 화면에는 편집 수단이 없다
 */
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
vi.mock('next/link', () => ({ default: ({ href, children, className }) => createElement('a', { href, className }, children) }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../classSchedule', async (orig) => ({ ...(await orig()), kstToday: () => '2026-10-21' }));
const { default: CourseSchedule } = await import('../../components/classroom/ClassCourseSchedule.jsx');
const { loadCourse } = await import('../server/classCourse.js');

const course = loadCourse('nihongo42');
const schedule = { start: '2026-10-13', weekdays: [2, 4], moves: {}, round: 1 };
const teacher = { id: 'teacher' };
const root = (sch) => ({ id: 1, owner_id: 'teacher', processed_json: { metadata: { team: { key: 'culcom', root: true, name: 'culcom', course: 'nihongo42', ...(sch ? { schedule: sch } : {}) } } } });
const render = (props) => renderToStaticMarkup(createElement(CourseSchedule, { course, teamKey: 'culcom', user: null, root: null, schedule: null, ...props }));

describe('코스 탭 — 학생', () => {
  const html = render({ schedule });
  it('챕터는 Ch.N · 일본어 패턴 · 한국어 제목으로', () => {
    expect(html).toContain('<span class="course-day__n">Ch.1</span><span lang="ja" class="course-day__jp">~する時があります</span>');
    expect(html).toContain('<b>Ch.1~3</b>');
    expect(html).toContain('<span class="course-day__ko">~할 때가 있어요</span>');
    expect(html).not.toContain('course-hl');
    expect(html).not.toContain('칸 숫자');
  });
  it('날짜·진행·달력·시험·휴강', () => {
    expect(html).toContain('10/13(화)');
    expect(html).toContain('1바퀴 · 3/14회 완료');
    expect(html).toContain('다음 수업 10/22(목) · Ch.10~12');
    expect(html).toContain('2026년 10월');
    expect(html).toContain('수업 + 시험');
    expect(html).toContain('12/1(화)</b><span class="course-chip course-chip--break">휴강');
    expect(html).toContain('다음 바퀴(Ch.1~3)는 12/3(목)');
    expect(html).not.toMatch(/Day/);
  });
  it('편집 수단이 없다', () => {
    expect(html).not.toContain('날짜 변경');
    expect(html).not.toContain('일정 만들기');
  });
  it('일정이 없으면 안내만', () => {
    const none = render({ schedule: null });
    expect(none).toContain('선생님이 일정을 정하면');
    expect(none).not.toContain('일정 만들기');
  });
});

describe('코스 탭 — 선생님(팀 루트 소유자)', () => {
  it('일정이 없으면 첫 수업 날짜로 일정 만들기 — 기본값은 오늘 이후 첫 화·목', () => {
    const html = render({ user: teacher, root: root(null) });
    expect(html).toContain('일정 만들기');
    expect(html).toContain('value="2026-10-22"');
  });
  it('일정이 있으면 Day마다 날짜 변경', () => {
    const html = render({ user: teacher, root: root(schedule) });
    expect(html.match(/날짜 변경/g)).toHaveLength(14);
  });
  it('다른 사람의 루트로는 편집이 열리지 않는다', () => {
    const html = render({ user: { id: 'student' }, root: root(schedule), schedule });
    expect(html).not.toContain('날짜 변경');
  });
  it('학생 화면은 루트를 넘기지 않는다(편집 경로 자체가 없다)', () => {
    const page = fs.readFileSync('src/views/ClassTeamPage.jsx', 'utf8');
    expect(page).toContain("<CourseTab teamKey={teamKey} user={user} root={root}/>");
    const student = sliceBetween(page, 'function StudentView(');
    expect(student).toContain('<CourseTab teamKey={teamKey} user={user}/>');
  });
});
