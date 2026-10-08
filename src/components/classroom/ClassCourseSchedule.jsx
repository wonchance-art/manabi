'use client';

/**
 * 코스 탭 본문 — 진행 상황 · 달력 · 날짜별 Day 목록(오너 확정 2026-10-08).
 *
 * 일정 계산은 classSchedule(순수)이 전부 한다. 이 파일은 그리기와 저장만:
 *   · 저장은 팀 루트 소유자(canTeachClass)만 — RLS로 자기 루트 행에 쓴다(학생은 쓸 길이 없다)
 *   · 저장 직전 최신 루트를 다시 읽어, 편집을 시작한 뒤 다른 창에서 일정이 바뀌었으면 덮어쓰지 않는다
 *   · 휴강이 지나 다음 바퀴로 넘어간 화면에서 고치면, 넘어간 바퀴 값으로 저장된다
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { getTeam, patchTeamRoot } from '../../lib/classBoard';
import { canTeachClass } from '../../lib/classWorkspace';
import { fetchTeamRoot } from '../../lib/classTeamQueries';
import { saveClassroomMetadata, classroomError } from '../../lib/classroomModel';
import { dayProgress } from '../../lib/classCourse';
import {
  currentSchedule, moveSession, resetSession, newSchedule, moveImpact, scheduleProgress, sessionStatus,
  monthGrid, nextClassDate, kstToday, shortDate, parseSchedule, DEFAULT_WEEKDAYS, WEEKDAY_KO, ScheduleError,
} from '../../lib/classSchedule';
import { holidayName } from '../../lib/krHolidays';
import { Hi } from './ClassCourseUI';
import { useClassCourse, courseErrorText } from '../../lib/classCourseClient';

const same = (a, b) => JSON.stringify(parseSchedule(a)) === JSON.stringify(parseSchedule(b));

function useScheduleSaver({ user, teamKey, stored }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(next) {
    setBusy(true); setMessage('');
    try {
      const fresh = await fetchTeamRoot(user.id, teamKey);
      if (!canTeachClass(user, fresh)) throw new Error('일정은 이 수업의 선생님만 바꿀 수 있어요.');
      const latest = getTeam(fresh.processed_json?.metadata)?.schedule || null;
      if (!same(latest, stored)) {
        client.setQueryData(['class-root', user.id, teamKey], fresh);
        throw new Error('다른 창에서 일정이 바뀌었어요. 최신 일정을 불러왔으니 다시 확인해 주세요.');
      }
      const patched = patchTeamRoot(fresh.processed_json, { schedule: next });
      const saved = await saveClassroomMetadata(supabase, fresh, patched.metadata);
      client.setQueryData(['class-root', user.id, teamKey], saved);
      await client.invalidateQueries({ queryKey: ['class-course', teamKey] });
      return true;
    } catch (err) {
      setMessage(err instanceof ScheduleError ? err.message : classroomError(err));
      return false;
    } finally { setBusy(false); }
  }
  return { save, busy, message, setMessage };
}

function inputBadge(day) {
  const p = dayProgress(day);
  if (p.drills >= p.drillsTotal) return null;
  return <span className="course-badge">{p.drills === 0 ? '예문 입력 대기' : `예문 ${p.drills}/${p.drillsTotal}`}</span>;
}

function ProgressBar({ built, today, round, ranges }) {
  const p = scheduleProgress(built, today);
  const pct = Math.round((p.done / p.total) * 100);
  const text = p.phase === 'before' ? `개강 전 · 첫 수업 ${shortDate(built.sessions[0].date)}`
    : p.phase === 'test-today' ? `오늘 ${ranges[p.total - 1]} 수업 + 시험`
      : p.phase === 'break-today' ? `오늘 휴강 · 다음 바퀴 ${shortDate(built.nextStart)} 시작`
        : p.phase === 'break-wait' ? `이번 바퀴 끝 · 휴강 ${shortDate(built.breakDate)} · 다음 바퀴 ${shortDate(built.nextStart)}`
          : p.today ? `오늘 ${ranges[p.today.day - 1]} 수업`
            : `다음 수업 ${shortDate(p.next.date)} · ${ranges[p.next.day - 1]}`;
  return <div className="course-progress">
    <div className="course-progress__top"><b>{round}바퀴 · {p.done}/{p.total}회 완료</b><span>{text}</span></div>
    <div className="course-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} aria-label="이번 바퀴 진행">
      <span style={{ width: `${pct}%` }} />
    </div>
    <div className="course-progress__foot"><span>시험 {shortDate(built.testDate)}</span><span>휴강 {shortDate(built.breakDate)}</span></div>
  </div>;
}

function CourseCalendar({ built, today, teamKey, ranges }) {
  const byDate = useMemo(() => new Map(built.sessions.map((x) => [x.date, x])), [built]);
  const months = useMemo(() => {
    const out = [];
    const [first, last] = [built.sessions[0].date, built.nextStart];
    let y = +first.slice(0, 4), m = +first.slice(5, 7);
    while (`${y}-${String(m).padStart(2, '0')}` <= last.slice(0, 7)) { out.push([y, m]); m += 1; if (m > 12) { m = 1; y += 1; } }
    return out;
  }, [built]);
  const initial = Math.max(0, months.findIndex(([y, m]) => `${y}-${String(m).padStart(2, '0')}` === today.slice(0, 7)));
  const [at, setAt] = useState(initial);
  const [y, m] = months[Math.min(at, months.length - 1)];
  const total = built.sessions.length;
  return <section className="course-cal" aria-label="수업 달력">
    <div className="course-cal__nav">
      <button type="button" onClick={() => setAt((v) => Math.max(0, v - 1))} disabled={at === 0} aria-label="이전 달">‹</button>
      <b>{y}년 {m}월</b>
      <button type="button" onClick={() => setAt((v) => Math.min(months.length - 1, v + 1))} disabled={at >= months.length - 1} aria-label="다음 달">›</button>
    </div>
    <table className="course-cal__grid">
      <thead><tr>{WEEKDAY_KO.map((w) => <th key={w} scope="col">{w}</th>)}</tr></thead>
      <tbody>{monthGrid(y, m).map((week, wi) => <tr key={wi}>{week.map((date, di) => {
        if (!date) return <td key={di} />;
        const s = byDate.get(date), hol = holidayName(date);
        const kind = s ? (s.day === total ? 'test' : 'class') : date === built.breakDate ? 'break' : date === built.nextStart ? 'next' : null;
        const cls = ['course-cal__cell', kind && `course-cal__cell--${kind}`, s && sessionStatus(date, today) === 'done' && 'course-cal__cell--done', date === today && 'course-cal__cell--today', hol && 'course-cal__cell--holiday'].filter(Boolean).join(' ');
        const label = s ? (s.day === total ? '시험' : ranges[s.day - 1].replace(/^Ch\./, '')) : kind === 'break' ? '휴강' : kind === 'next' ? '다음 바퀴' : hol ? (hol.startsWith('대체공휴일') ? '대체휴일' : hol) : '';
        const inner = <><span className="course-cal__num">{+date.slice(8)}</span>{label && <span className="course-cal__tag">{label}</span>}</>;
        return <td key={di} className={cls} aria-label={`${shortDate(date)}${s ? ` ${ranges[s.day - 1]}${s.day === total ? ' 수업 + 시험' : ' 수업'}` : label ? ` ${label}` : ''}${hol && label !== hol ? ` ${hol}` : ''}${date === today ? ' 오늘' : ''}`}>
          {s ? <Link href={`/class/${teamKey}/course/${s.day}`}>{inner}</Link> : <div>{inner}</div>}
        </td>;
      })}</tr>)}</tbody>
    </table>
    <p className="course-cal__legend">
      <span><i className="course-cal__key course-cal__key--class" />수업</span>
      <span><i className="course-cal__key course-cal__key--test" />시험</span>
      <span><i className="course-cal__key course-cal__key--break" />휴강</span>
      <span><i className="course-cal__key course-cal__key--holiday" />공휴일</span>
      <span>칸 숫자 = 챕터 · {built.weekdays.map((d) => WEEKDAY_KO[d]).join('·')} 수업</span>
    </p>
  </section>;
}

function DateEditor({ schedule, total, session, saver, onDone, range }) {
  const [value, setValue] = useState(session.date);
  let preview = null, error = null;
  if (value && value !== session.date) {
    try {
      const imp = moveImpact(schedule, total, session.day, value);
      preview = session.day === 1 ? `첫 수업이 ${shortDate(value)}로 바뀌고 모든 일정이 다시 계산돼요. 시험 ${shortDate(imp.testFrom)} → ${shortDate(imp.testTo)}`
        : `뒤 수업 ${imp.shifted}회가 다시 계산돼요. 시험 ${shortDate(imp.testFrom)} → ${shortDate(imp.testTo)}`;
      if (holidayName(value)) preview += ` · ${holidayName(value)}에 보강해요`;
    } catch (err) { error = err.message; }
  }
  async function submit(e) {
    e.preventDefault();
    if (error || value === session.date) return;
    if (await saver.save(moveSession(schedule, total, session.day, value))) onDone();
  }
  async function reset() { if (await saver.save(resetSession(schedule, session.day))) onDone(); }
  return <form className="course-date-edit" onSubmit={submit}>
    <label>{range} 수업 날짜<input type="date" value={value} onChange={(e) => setValue(e.target.value)} required /></label>
    <p role="status" className={error ? 'course-date-edit__error' : ''}>{error || preview || '바꿀 날짜를 고르면 뒤 일정이 어떻게 바뀌는지 먼저 보여 줘요. 화·목, 공휴일 제외 기준.'}</p>
    <div className="course-date-edit__actions">
      <button className="classroom-button" disabled={saver.busy || !!error || value === session.date}>{saver.busy ? '저장 중…' : '저장'}</button>
      {session.moved && <button type="button" className="classroom-button classroom-button--quiet" disabled={saver.busy} onClick={reset}>원래 날짜({shortDate(session.natural)})로</button>}
      <button type="button" className="classroom-text-button" onClick={onDone} disabled={saver.busy}>취소</button>
    </div>
    {saver.message && <p role="alert" className="course-date-edit__error">{saver.message}</p>}
  </form>;
}

function ScheduleStart({ saver, today }) {
  const [value, setValue] = useState(() => nextClassDate(today, DEFAULT_WEEKDAYS, { inclusive: true }));
  return <form className="course-date-edit" onSubmit={async (e) => { e.preventDefault(); await saver.save(newSchedule(value)); }}>
    <label>첫 수업 날짜<input type="date" value={value} onChange={(e) => setValue(e.target.value)} required /></label>
    <p>화·목마다, 한국 공휴일은 건너뛰고 Ch.1~42 수업 14회의 날짜를 자동으로 만들어요. 마지막 수업 날은 시험도 함께, 그다음 수업은 휴강이에요.</p>
    <div className="course-date-edit__actions"><button className="classroom-button" disabled={saver.busy}>{saver.busy ? '저장 중…' : '일정 만들기'}</button></div>
    {saver.message && <p role="alert" className="course-date-edit__error">{saver.message}</p>}
  </form>;
}

const STATUS_TEXT = { done: '완료', today: '오늘', upcoming: '' };

/** 코스 탭 — owner(root)가 있으면 일정 편집이 열린다. schedule = 저장값(학생은 코스 라우트가 준 값). */
export default function CourseSchedule({ course, teamKey, user, root, schedule }) {
  const owner = canTeachClass(user, root);
  const stored = owner ? getTeam(root.processed_json?.metadata)?.schedule || null : schedule || null;
  const total = course.days.length;
  const [today] = useState(() => kstToday());
  const cur = useMemo(() => currentSchedule(stored, total, today), [stored, total, today]);
  const saver = useScheduleSaver({ user, teamKey, stored });
  const [editing, setEditing] = useState(null);
  const built = cur?.built || null;
  const next = built ? scheduleProgress(built, today).next : null;
  const drills = course.days.reduce((s, d) => s + dayProgress(d).drills, 0);
  const ranges = course.days.map((d) => d.range);

  return <section className="course-list" aria-label="챕터 목록">
    <div className="course-list__head">
      <div><h2>{course.title}</h2><p>Ch.1~{total * 3} · 수업 {total}회{drills < total * 30 ? ` · 예문 ${drills}/${total * 30} 입력` : ''}</p></div>
      <Link className="classroom-button classroom-button--quiet" href={`/class/${teamKey}/test`}>테스트 · 10문제</Link>
    </div>

    {built ? <>
      <ProgressBar built={built} today={today} round={built.round} ranges={ranges} />
      <CourseCalendar key={`${built.round}-${built.sessions[0].date}`} built={built} today={today} teamKey={teamKey} ranges={ranges} />
      {owner && built.uncovered.length > 0 && <p className="course-test-note" role="note">{built.uncovered.join('·')}년 공휴일 정보가 아직 없어요 — 그해 날짜는 공휴일을 건너뛰지 않으니 필요한 수업은 날짜를 직접 옮겨 주세요.</p>}
    </> : owner ? <ScheduleStart saver={saver} today={today} />
      : <p className="course-pending">선생님이 일정을 정하면 수업 날짜와 달력이 여기에 표시돼요.</p>}

    <ol className="course-days">
      {course.days.map((d, i) => {
        const s = built?.sessions[i] || null;
        const status = s ? sessionStatus(s.date, today) : null;
        const isTest = s && s.day === total;
        const isNext = s && next && next.day === s.day;
        return <li key={d.day} className={`course-day${status ? ` course-day--${status}` : ''}${isNext ? ' course-day--next' : ''}`}>
          {s && <div className="course-day__date">
            <b>{shortDate(s.date)}</b>
            {STATUS_TEXT[status] && <span className="course-chip">{STATUS_TEXT[status]}</span>}
            {isNext && <span className="course-chip course-chip--next">다음 수업</span>}
            {isTest && <span className="course-chip course-chip--test">수업 + 시험</span>}
            {s.moved && <span className="course-chip">옮김</span>}
            {s.holiday && <span className="course-chip course-chip--holiday">{s.holiday} 보강</span>}
            {owner && editing !== d.day && <button type="button" className="classroom-text-button course-day__edit" onClick={() => { saver.setMessage(''); setEditing(d.day); }}>날짜 변경</button>}
          </div>}
          {owner && s && editing === d.day && <DateEditor schedule={cur.schedule} total={total} session={s} saver={saver} onDone={() => setEditing(null)} range={d.range} />}
          <Link className="course-day__body" href={`/class/${teamKey}/course/${d.day}`}>
            <span className="course-day__head"><b>{d.range}</b>{inputBadge(d)}</span>
            <span className="course-day__chapters">
              {d.chapters.map((c) => <span key={c.n} className="course-day__ch">
                <span className="course-day__n">Ch.{c.n}</span>
                <span lang="ja" className="course-day__jp">{c.jp[0]}</span>
                <span className="course-day__ko"><Hi text={c.titleHi || c.title} /></span>
              </span>)}
            </span>
          </Link>
        </li>;
      })}
      {built && <li className={`course-day course-day--break${sessionStatus(built.breakDate, today) === 'done' ? ' course-day--done' : ''}`}>
        <div className="course-day__date"><b>{shortDate(built.breakDate)}</b><span className="course-chip course-chip--break">휴강</span></div>
        <p className="course-day__note">시험 다음 수업은 쉬어요. 다음 바퀴(Ch.1~3)는 {shortDate(built.nextStart)}에 시작해요.</p>
      </li>}
    </ol>
  </section>;
}

/**
 * 수업 홈 「코스」 탭 — 팀에 코스가 연결돼 있을 때만. 교재 문장은 서버 전용이라 오너도 코스 라우트를 거친다
 * 오너(root를 넘긴 쪽)에게만 일정 편집이 열린다.
 * (오너 뷰의 「API 라우트 0」은 RLS로 읽는 자료 행 얘기다 — 코스는 자료 행이 아니다. 오너 경로는 로그인 Bearer라
 * 해제 토큰·SHARE_LINK_SECRET 없이 열린다).
 */
export function CourseTab({ teamKey, user, root = null }) {
  const q = useClassCourse(teamKey, user?.id);
  if (q.isLoading) return <p role="status">코스를 불러오는 중…</p>;
  if (q.error) return <div className="classroom-notice" role="alert">{courseErrorText(q.error)} <button onClick={() => q.refetch()}>다시 불러오기</button></div>;
  return <CourseSchedule course={q.data.course} teamKey={teamKey} user={user} root={root} schedule={q.data.team?.schedule} />;
}
