'use client';

/**
 * 수업 코스 챕터 페이지 `/class/[team]/course/[n]` — 수업 한 회차 = 챕터 3개(Ch.1~3 …), 경로 숫자는 회차 순번.
 *
 *   제목(Ch.1~3 · 날짜) → 문화 한 장 → 함께 읽고 연습(교재 대화) → 오늘의 패턴(공식 · 한 줄 핵심 · ✕/○)
 *   → 예문 연습(챕터별 10) → 테스트 · 앞뒤 회차
 *
 * 디자인은 일본어 교재 화면(textbook-reader·N5 교재)의 문법을 따른다: 패턴 단위 테두리 → 연한 공식 상자 →
 * 짧은 설명 → 제목이 테두리 안에 있는 예문 상자, ✕/○ 대조 줄. 본문 밖 장식은 두지 않는다(오너 결정 2026-10-08).
 * 설명은 한 줄에 한 가지 — 줄이 넘어가면 집중이 떨어진다(classCourse.test.js가 글자 폭을 잰다).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { useTTS } from '../lib/useTTS';
import { getTeam, todayKey } from '../lib/classBoard';
import { canTeachClass, classWorkspaceHref } from '../lib/classWorkspace';
import { fetchTeamRoot, fetchBookChapters } from '../lib/classTeamQueries';
import { readIndexCache } from '../lib/classClient';
import { useClassCourse, courseErrorText } from '../lib/classCourseClient';
import { currentSchedule, kstToday, shortDate, sessionStatus } from '../lib/classSchedule';
import { ClassroomShell, ClassroomState } from '../components/classroom/ClassroomUI';
import { CoursePending, SpeakButton, Ja, HideToggle, Masked, TextbookOriginal, FixNote, Hi } from '../components/classroom/ClassCourseUI';

function useViewerHref(teamKey, user, order) {
  const { data: root } = useQuery({
    queryKey: ['class-root', user?.id, teamKey],
    queryFn: () => fetchTeamRoot(user.id, teamKey),
    enabled: !!user?.id && !!teamKey,
  });
  const owned = canTeachClass(user, root);
  const team = owned ? getTeam(root.processed_json?.metadata) : null;
  const { data: ownerChapters = [] } = useQuery({
    queryKey: ['class-book-chapters', user?.id, team?.bookKey],
    queryFn: () => fetchBookChapters(team.bookKey),
    enabled: owned && !!team?.bookKey,
    staleTime: 60 * 1000,
  });
  const chapters = owned ? ownerChapters : (readIndexCache(teamKey)?.index?.chapters || []);
  const chapter = chapters.find((c) => Number(c.order) === Number(order));
  if (!chapter) return null;
  return owned ? classWorkspaceHref(chapter.id, teamKey, todayKey()) : `/class/${teamKey}?open=${encodeURIComponent(chapter.id)}`;
}

/** 가리기 상태 — 모드를 바꾸면 줄마다 펼친 것도 초기화. */
function useMask() {
  const [mode, setMode] = useState('both');
  const [shown, setShown] = useState(() => new Set());
  return {
    mode,
    pick: (v) => { setMode(v); setShown(new Set()); },
    hidden: (side, id) => mode === `hide-${side}` && !shown.has(id),
    reveal: (id) => setShown((s) => new Set(s).add(id)),
  };
}

function Dialogue({ lines, speak }) {
  const m = useMask();
  return <section id="read" className="tb-section" aria-labelledby="read-title">
    <div className="tb-box">
      <header className="tb-box__head"><h2 id="read-title">함께 읽고 연습</h2>{lines.length > 0 && <HideToggle value={m.mode} onChange={m.pick} />}</header>
      {lines.length === 0 ? <CoursePending what="교재 대화 스크립트" /> : <ol className="tb-lines">
        {lines.map((l, k) => <li key={k} className="tb-line">
          <span className="tb-line__who" aria-label={`${l.who || ''} 말`}>{l.who || ''}</span>
          <div className="tb-line__body">
            <div className="tb-line__ja"><Masked hidden={m.hidden('ja', k)} onReveal={() => m.reveal(k)} label="일본어"><Ja ja={l.ja} yomi={l.yomi} /></Masked></div>
            {l.ko && <div className="tb-line__ko"><Masked hidden={m.hidden('ko', k)} onReveal={() => m.reveal(k)} label="한국어">{l.ko}</Masked></div>}
          </div>
          <SpeakButton text={l.ja} speak={speak} />
        </li>)}
      </ol>}
    </div>
  </section>;
}

function PatternUnit({ c }) {
  const b = c.brief;
  return <article id={`ch-${c.n}`} className="tb-unit">
    <h3 className="tb-unit__title"><span className="tb-unit__n">Ch.{c.n}</span><span>{c.title}</span></h3>
    <div className="tb-formula">
      {c.jp.map((form, k) => <div key={k} className="tb-formula__ja"><Ja ja={form} yomi={c.jpYomi?.[k]} /></div>)}
      {b?.form && <p className="tb-formula__how"><span>만드는 법</span>{b.form}</p>}
    </div>
    {b?.points?.length > 0 && <ul className="tb-points">{b.points.map((p, k) => <li key={k}><Hi text={p} /></li>)}</ul>}
    {b?.ng && b?.ok && <div className="tb-contrast" role="group" aria-label="틀리기 쉬운 곳">
      <div className="tb-contrast__row tb-contrast__row--ng"><span className="tb-contrast__mark" aria-label="틀림">✕</span><span lang="ja">{b.ng}</span></div>
      <div className="tb-contrast__row tb-contrast__row--ok"><span className="tb-contrast__mark" aria-label="맞음">○</span><span lang="ja">{b.ok}</span></div>
    </div>}
    {c.alts?.length > 0 && <p className="tb-alt"><span>비슷한 표현</span>{c.alts.map((a, k) => <span key={k} className="tb-alt__item"><Ja ja={a.ja} yomi={a.yomi} /><small>{a.reg}</small></span>)}</p>}
  </article>;
}

function Patterns({ chapters }) {
  return <section id="patterns" className="tb-section" aria-labelledby="patterns-title">
    <h2 id="patterns-title" className="tb-section__title">오늘의 패턴</h2>
    {chapters.map((c) => <PatternUnit key={c.n} c={c} />)}
  </section>;
}

function Drills({ chapters, speak }) {
  const m = useMask();
  const any = chapters.some((c) => c.drills.length > 0);
  return <section id="drills" className="tb-section" aria-labelledby="drills-title">
    <div className="tb-section__row"><h2 id="drills-title" className="tb-section__title">예문 연습</h2>{any && <HideToggle value={m.mode} onChange={m.pick} />}</div>
    {chapters.map((c) => <div key={c.n} className="tb-box">
      <header className="tb-box__head"><h3><span className="tb-unit__n">Ch.{c.n}</span><span lang="ja">{c.jp[0]}</span></h3></header>
      {c.drills.length === 0 ? <CoursePending what="교재 예문" total={10} /> : <ol className="tb-lines">
        {c.drills.map((d, k) => {
          const id = `${c.n}-${k}`;
          return <li key={id} className="tb-line">
            <span className="tb-line__no">{k + 1}</span>
            <div className="tb-line__body">
              {!m.hidden('ja', id) && <TextbookOriginal text={d.textbook} />}
              <div className="tb-line__ja"><Masked hidden={m.hidden('ja', id)} onReveal={() => m.reveal(id)} label="일본어"><Ja ja={d.ja} yomi={d.yomi} /></Masked></div>
              <div className="tb-line__ko"><Masked hidden={m.hidden('ko', id)} onReveal={() => m.reveal(id)} label="한국어">{d.ko}</Masked></div>
              <FixNote note={d.note} />
            </div>
            <SpeakButton text={d.ja} speak={speak} />
          </li>;
        })}
      </ol>}
    </div>)}
  </section>;
}

function Culture({ c, speak }) {
  return <aside className="tb-culture" aria-label="문화·여행 이야기">
    <p className="tb-culture__place">🗾 {c.place}</p>
    <h2 className="tb-culture__title">{c.title}</h2>
    <ul className="tb-points tb-points--plain">{(c.facts || []).map((f, k) => <li key={k}><Hi text={f} /></li>)}</ul>
    {c.phrase && <p className="tb-culture__phrase"><Ja ja={c.phrase.ja} yomi={c.phrase.yomi} /><SpeakButton text={c.phrase.ja} speak={speak} /><span>{c.phrase.ko}</span></p>}
  </aside>;
}

export default function ClassCourseDayPage() {
  const { team: teamKey, day: param } = useParams();
  const { user, loading } = useAuth();
  const { speak } = useTTS();
  const q = useClassCourse(teamKey, user?.id, !loading);
  const course = q.data?.course;
  const idx = useMemo(() => (course ? course.days.findIndex((d) => String(d.day) === String(param)) : -1), [course, param]);
  const unit = idx >= 0 ? course.days[idx] : null;
  const viewerHref = useViewerHref(teamKey, user, unit?.day);

  if (loading || q.isLoading) return <ClassroomState title="코스를 불러오고 있어요." />;
  if (q.error) return <ClassroomState title={courseErrorText(q.error)}><Link className="classroom-button" href={`/class/${teamKey}`}>수업 홈으로</Link></ClassroomState>;
  if (!unit) return <ClassroomState title="없는 챕터예요."><Link className="classroom-button" href={`/class/${teamKey}?view=course`}>챕터 목록</Link></ClassroomState>;

  const prev = course.days[idx - 1], next = course.days[idx + 1];
  const today = kstToday();
  const session = currentSchedule(q.data.team?.schedule, course.days.length, today)?.built.sessions[idx] || null;
  const status = session ? sessionStatus(session.date, today) : null;
  const isTest = idx === course.days.length - 1;
  return <ClassroomShell lang="Japanese" teamHome>
    <div className="tb-page">
      <nav className="tb-top"><Link href={`/class/${teamKey}?view=course`}>← 챕터 목록</Link><Link href={`/class/${teamKey}/test`}>테스트</Link></nav>
      <header className="tb-head">
        <h1>{unit.range}</h1>
        <p className="tb-head__meta">
          {session && <b>{shortDate(session.date)}</b>}
          {status === 'today' && <span className="course-chip course-chip--next">오늘</span>}
          {status === 'done' && <span className="course-chip">완료</span>}
          {isTest && <span className="course-chip course-chip--test">수업 + 시험</span>}
        </p>
        <ol className="tb-head__toc">{unit.chapters.map((c) => <li key={c.n}><a href={`#ch-${c.n}`}><span>Ch.{c.n}</span>{c.title}</a></li>)}</ol>
      </header>

      {unit.culture && <Culture c={unit.culture} speak={speak} />}
      {viewerHref && <p className="tb-viewer"><Link href={viewerHref}>📖 본문을 뷰어로 읽기</Link></p>}

      <Dialogue lines={unit.dialogue} speak={speak} />
      <Patterns chapters={unit.chapters} />
      <Drills chapters={unit.chapters} speak={speak} />

      <footer className="tb-foot">
        <Link className="classroom-button" href={`/class/${teamKey}/test`}>테스트 보기 · 10문제</Link>
        <nav className="tb-pager" aria-label="챕터 이동">
          {prev ? <Link href={`/class/${teamKey}/course/${prev.day}`}>← {prev.range}</Link> : <span />}
          {next ? <Link href={`/class/${teamKey}/course/${next.day}`}>{next.range} →</Link> : <span />}
        </nav>
      </footer>
    </div>
  </ClassroomShell>;
}
