'use client';

/**
 * 수업 코스 Day 페이지 `/class/[team]/course/[day]` (오너 확정 2026-10-08).
 *
 *   🗾 문화 카드 → 함께 읽고 연습(대화 스크립트) → 오늘의 패턴(설명) → 예문 연습(패턴별 10)
 *   → 테스트 입구 · 이전/다음 Day (한→일 번역 칸은 오너 결정으로 없앴다 2026-10-08)
 *
 * 교재 문장이 아직 없는 칸은 「아직 입력되지 않았어요」로 자리를 지킨다. 본문을 뷰어로 읽는 길은
 * 수업 교재(책 묶음)의 Day번째 과가 있을 때만 열린다 — 학생은 수업 홈의 받기 경로(`?open=`)를 탄다.
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
import { refInline, Callout } from './refShared';
import { ClassroomShell, ClassroomState } from '../components/classroom/ClassroomUI';
import { CoursePending, SpeakButton, Ja, HideToggle, Masked, TextbookOriginal, FixNote } from '../components/classroom/ClassCourseUI';

const CIRCLED = ['①', '②', '③'];

function useViewerHref(teamKey, user, day) {
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
  const chapter = chapters.find((c) => Number(c.order) === Number(day));
  if (!chapter) return { href: null, owned };
  return { href: owned ? classWorkspaceHref(chapter.id, teamKey, todayKey()) : `/class/${teamKey}?open=${encodeURIComponent(chapter.id)}`, owned };
}

function Dialogue({ lines, speak }) {
  const [mode, setMode] = useState('both');
  const [shown, setShown] = useState(() => new Set());
  const reveal = (k) => setShown((s) => new Set(s).add(k));
  const pick = (v) => { setMode(v); setShown(new Set()); };
  return <section id="read" className="course-section" aria-labelledby="read-title">
    <div className="course-section__head"><h2 id="read-title">함께 읽고 연습</h2>{lines.length > 0 && <HideToggle value={mode} onChange={pick} />}</div>
    {lines.length === 0 ? <CoursePending what="교재 대화 스크립트" /> : <ol className="course-lines">
      {lines.map((l, k) => <li key={k} className="course-line">
        <span className="course-line__who">{l.who || ''}</span>
        <div>
          <div className="course-line__ja"><Masked hidden={mode === 'hide-ja' && !shown.has(k)} onReveal={() => reveal(k)} label="일본어"><Ja ja={l.ja} yomi={l.yomi} /></Masked></div>
          {l.ko && <div className="course-line__ko"><Masked hidden={mode === 'hide-ko' && !shown.has(k)} onReveal={() => reveal(k)} label="한국어">{l.ko}</Masked></div>}
        </div>
        <SpeakButton text={l.ja} speak={speak} />
      </li>)}
    </ol>}
  </section>;
}

function Patterns({ chapters }) {
  return <section id="patterns" className="course-section" aria-labelledby="patterns-title">
    <div className="course-section__head"><h2 id="patterns-title">오늘의 패턴</h2></div>
    {chapters.map((c, i) => <article key={c.n} id={`ch-${c.n}`} className="course-pattern">
      <h3><span className="course-num">{CIRCLED[i]} Ch.{c.n}</span>{c.title}</h3>
      <div className="course-pattern__formula">
        {c.jp.map((form, k) => <Ja key={k} ja={form} yomi={c.jpYomi?.[k]} />)}
        <p>{c.ko.join('  /  ')}</p>
      </div>
      {c.explain && <p className="course-pattern__explain">{refInline(c.explain)}</p>}
      {c.pitfall && <Callout kind="pitfall" text={c.pitfall} />}
      {c.alts?.length > 0 && <div className="course-alts">{c.alts.map((a, k) => <div key={k}><span className="course-tag">{a.reg}</span><Ja ja={a.ja} yomi={a.yomi} /> <span className="course-line__ko">{a.ko}</span></div>)}</div>}
      {c.examples?.length > 0 && <details className="course-examples"><summary>참고 예문 {c.examples.length}개 (교재 외)</summary>
        <ul className="course-lines">{c.examples.map((ex, k) => <li key={k} className="course-line"><span /><div><div className="course-line__ja"><Ja ja={ex.ja} yomi={ex.yomi} /></div><div className="course-line__ko">{ex.ko}</div></div><span /></li>)}</ul>
      </details>}
    </article>)}
  </section>;
}

function Drills({ chapters, speak }) {
  const [mode, setMode] = useState('both');
  const [shown, setShown] = useState(() => new Set());
  const reveal = (k) => setShown((s) => new Set(s).add(k));
  const pick = (v) => { setMode(v); setShown(new Set()); };
  const any = chapters.some((c) => c.drills.length > 0);
  return <section id="drills" className="course-section" aria-labelledby="drills-title">
    <div className="course-section__head"><h2 id="drills-title">예문 연습</h2>{any && <HideToggle value={mode} onChange={pick} />}</div>
    {chapters.map((c, i) => <div key={c.n}>
      <h3><span className="course-num">{CIRCLED[i]}</span><span lang="ja">{c.jp[0]}</span></h3>
      {c.drills.length === 0 ? <CoursePending what="교재 예문" total={10} /> : <ol className="course-drills">
        {c.drills.map((d, k) => {
          const id = `${c.n}-${k}`;
          return <li key={id} className="course-line">
            <span className="course-line__no">{k + 1}</span>
            <div>
              {!(mode === 'hide-ja' && !shown.has(id)) && <TextbookOriginal text={d.textbook} />}
              <div className="course-line__ja"><Masked hidden={mode === 'hide-ja' && !shown.has(id)} onReveal={() => reveal(id)} label="일본어"><Ja ja={d.ja} yomi={d.yomi} /></Masked></div>
              <div className="course-line__ko"><Masked hidden={mode === 'hide-ko' && !shown.has(id)} onReveal={() => reveal(id)} label="한국어">{d.ko}</Masked></div>
              <FixNote note={d.note} />
            </div>
            <SpeakButton text={d.ja} speak={speak} />
          </li>;
        })}
      </ol>}
    </div>)}
  </section>;
}

export default function ClassCourseDayPage() {
  const { team: teamKey, day: dayParam } = useParams();
  const { user, loading } = useAuth();
  const { speak } = useTTS();
  const q = useClassCourse(teamKey, user?.id, !loading);
  const course = q.data?.course;
  const idx = useMemo(() => (course ? course.days.findIndex((d) => String(d.day) === String(dayParam)) : -1), [course, dayParam]);
  const day = idx >= 0 ? course.days[idx] : null;
  const viewer = useViewerHref(teamKey, user, day?.day);

  if (loading || q.isLoading) return <ClassroomState title="코스를 불러오고 있어요." />;
  if (q.error) return <ClassroomState title={courseErrorText(q.error)}><Link className="classroom-button" href={`/class/${teamKey}`}>수업 홈으로</Link></ClassroomState>;
  if (!day) return <ClassroomState title="없는 Day예요."><Link className="classroom-button" href={`/class/${teamKey}?view=course`}>코스 목록</Link></ClassroomState>;

  const prev = course.days[idx - 1], next = course.days[idx + 1];
  const today = kstToday();
  const session = currentSchedule(q.data.team?.schedule, course.days.length, today)?.built.sessions[idx] || null;
  const isTest = idx === course.days.length - 1;
  const home = `/class/${teamKey}?view=course`;
  return <ClassroomShell lang="Japanese" teamHome>
    <div className="course-back-row"><Link className="classroom-back" href={home}>← 코스 목록</Link><Link className="classroom-text-button" href={`/class/${teamKey}/test`}>🎯 테스트</Link></div>
    <header className="course-head">
      <span className="classroom-eyebrow">{course.title}</span>
      <h1>Day {day.day} <small>{day.range}</small></h1>
      {(session || isTest) && <p className="course-head__date">
        {session && <b>{shortDate(session.date)}</b>}
        {session && sessionStatus(session.date, today) === 'today' && <span className="course-chip course-chip--next">오늘</span>}
        {session && sessionStatus(session.date, today) === 'done' && <span className="course-chip">완료</span>}
        {isTest && <span className="course-chip course-chip--test">수업 + 시험</span>}
      </p>}
      <ol className="course-toc">{day.chapters.map((c, i) => <li key={c.n}><a href={`#ch-${c.n}`}><span>{CIRCLED[i]} Ch.{c.n}</span><span>{c.title}</span></a></li>)}</ol>
    </header>

    {day.culture && <aside className="course-culture" aria-label="문화·여행 이야기">
      <span className="classroom-eyebrow">🗾 {day.culture.place}</span>
      <h2>{day.culture.title}</h2>
      <p>{refInline(day.culture.body)}</p>
      {day.culture.phrase && <div className="course-culture__phrase"><Ja ja={day.culture.phrase.ja} yomi={day.culture.phrase.yomi} /><span className="course-line__ko">{day.culture.phrase.ko}</span><SpeakButton text={day.culture.phrase.ja} speak={speak} /></div>}
    </aside>}

    {viewer.href
      ? <div className="course-viewer-link"><span>📖 본문을 뷰어로 읽으면 단어를 눌러 뜻을 보고 저장할 수 있어요.</span><Link className="classroom-button classroom-button--quiet" href={viewer.href}>뷰어로 읽기 →</Link></div>
      : viewer.owned ? <div className="course-viewer-link"><span>📖 수업 교재(책 묶음)에 {day.day}과를 올리면 여기서 뷰어로 바로 열려요.</span></div> : null}

    <Dialogue lines={day.dialogue} speak={speak} />
    <Patterns chapters={day.chapters} />
    <Drills chapters={day.chapters} speak={speak} />

    <div className="course-cta"><p>Day 1~{course.days.length} 전체 예문에서 10문제 · 8문제 이상이면 합격</p><Link className="classroom-button" href={`/class/${teamKey}/test`}>🎯 테스트 보기</Link></div>
    <nav className="course-pager" aria-label="Day 이동">
      {prev ? <Link href={`/class/${teamKey}/course/${prev.day}`}><small>← 이전</small>Day {prev.day} · {prev.range}</Link> : <span />}
      {next ? <Link href={`/class/${teamKey}/course/${next.day}`}><small>다음 →</small>Day {next.day} · {next.range}</Link> : <span />}
    </nav>
  </ClassroomShell>;
}
