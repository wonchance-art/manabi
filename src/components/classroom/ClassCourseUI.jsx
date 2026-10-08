'use client';
import Link from 'next/link';
import { JaText } from '../../views/refShared';
import { dayProgress } from '../../lib/classCourse';
import { useClassCourse, courseErrorText } from '../../lib/classCourseClient';
import './class-course.css';

export const PENDING_TEXT = '아직 입력되지 않았어요';

/** 교재 문장이 아직 없는 자리 — 무엇이 들어올지까지 알려 준다. */
export function CoursePending({ what, total }) {
  return <p className="course-pending" role="note"><b>{PENDING_TEXT}.</b> {what}{total ? ` 0/${total}` : ''} — 교재에서 옮겨 오면 여기에 표시돼요.</p>;
}

/** speak = 페이지에서 한 번 만든 useTTS().speak (버튼마다 음성 목록 구독을 만들지 않는다). */
export function SpeakButton({ text, speak }) {
  if (!text || !speak) return null;
  return <button type="button" className="course-speak" aria-label="일본어 듣기" onClick={() => speak(text, 'Japanese')}>🔊</button>;
}

export function Ja({ ja, yomi }) {
  return yomi ? <JaText ja={ja} yomi={yomi} fallbackPron={false} /> : <span lang="ja">{ja}</span>;
}

/** 가리기 — both | hide-ko | hide-ja */
export function HideToggle({ value, onChange, label = '가리기' }) {
  const options = [['both', '모두 보기'], ['hide-ko', '한국어 가리기'], ['hide-ja', '일본어 가리기']];
  return <div className="course-hide" role="group" aria-label={label}>
    {options.map(([v, text]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}
  </div>;
}

/** 가려진 칸 — 탭하면 그 줄만 보인다. */
export function Masked({ hidden, onReveal, children, label }) {
  if (!hidden) return children;
  return <button type="button" className="course-masked" onClick={onReveal}>{label} — 탭해서 보기</button>;
}

function badge(day) {
  const p = dayProgress(day);
  if (p.drills >= p.drillsTotal) return <span className="course-badge course-badge--done">예문 {p.drills}</span>;
  if (p.drills === 0) return <span className="course-badge">입력 대기</span>;
  return <span className="course-badge">예문 {p.drills}/{p.drillsTotal}</span>;
}

/** 수업 홈의 「코스」 탭 — Day 목록 + 테스트 입구. */
export function CourseDayList({ course, teamKey }) {
  const total = course.days.reduce((s, d) => s + dayProgress(d).drills, 0);
  const totalMax = course.days.reduce((s, d) => s + dayProgress(d).drillsTotal, 0);
  return <section className="course-list" aria-label="수업 코스">
    <div className="course-list__head">
      <div><span className="classroom-eyebrow">수업 코스</span><h2>{course.title}</h2><p>{course.days.length}일 · 하루 3패턴 · 예문 {total}/{totalMax} 입력</p></div>
      <Link className="classroom-button" href={`/class/${teamKey}/test`}>🎯 테스트 · 10문제</Link>
    </div>
    <ol className="course-days">
      {course.days.map((d) => <li key={d.day}>
        <Link className="course-day-row" href={`/class/${teamKey}/course/${d.day}`}>
          <b>Day {d.day}</b>
          <span className="course-day-row__titles">{d.chapters.map((c) => c.title).join(' · ')}</span>
          {badge(d)}
        </Link>
      </li>)}
    </ol>
  </section>;
}

/**
 * 수업 홈 「코스」 탭 — 팀에 코스가 연결돼 있을 때만. 교재 문장은 서버 전용이라 오너도 코스 라우트를 거친다
 * (오너 뷰의 「API 라우트 0」은 RLS로 읽는 자료 행 얘기다 — 코스는 자료 행이 아니다. 오너 경로는 로그인 Bearer라
 * 해제 토큰·SHARE_LINK_SECRET 없이 열린다).
 */
export function CourseTab({ teamKey, user }) {
  const q = useClassCourse(teamKey, user?.id);
  if (q.isLoading) return <p role="status">코스를 불러오는 중…</p>;
  if (q.error) return <div className="classroom-notice" role="alert">{courseErrorText(q.error)} <button onClick={() => q.refetch()}>다시 불러오기</button></div>;
  return <CourseDayList course={q.data.course} teamKey={teamKey} />;
}
