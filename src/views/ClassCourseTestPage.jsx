'use client';

/**
 * 수업 코스 테스트 `/class/[team]/test` (오너 확정 2026-10-08).
 *
 *   시험 — 코스 전체 예문에서 10문제(classCourse.buildTestSheet). 한국어만 띄우고 일본어로 답한다.
 *          판정은 사람이 한다(대면 시험 = 선생님, 혼자 = 스스로). 8문제 이상 합격. 기록은 남기지 않는다.
 *          시험지 번호(?sheet=)가 같으면 같은 시험지 — 다시 치기·다른 학생에게 같은 문제.
 *   연습 — 범위(전체/Day) · 방향(한→일/일→한) · 정답 보고 스스로 판정 · 모른 것만 다시.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { useTTS } from '../lib/useTTS';
import { canTeachClass } from '../lib/classWorkspace';
import { fetchTeamRoot } from '../lib/classTeamQueries';
import { useClassCourse, courseErrorText } from '../lib/classCourseClient';
import {
  coursePool, buildTestSheet, newSheetNo, passMark, siblingChapters, shuffled, seededRandom, TEST_SIZE,
} from '../lib/classCourse';
import { currentSchedule, kstToday, shortDate } from '../lib/classSchedule';
import { ClassroomShell, ClassroomState } from '../components/classroom/ClassroomUI';
import { CoursePending, SpeakButton, Ja, TextbookOriginal, FixNote } from '../components/classroom/ClassCourseUI';

const WARN_SEC = 5, LATE_SEC = 10;
const dots = (lv) => '●'.repeat(lv) + '○'.repeat(3 - lv);
const LEVEL = { 1: '쉬움', 2: '보통', 3: '어려움' };

function useElapsed(running, key) {
  const [sec, setSec] = useState(0);
  const startRef = useRef({ key: null, at: 0 });
  useEffect(() => {
    // 문제가 바뀔 때만 0으로 — 모범답을 펼치면 멈춘 채 걸린 시간을 보여 준다.
    if (startRef.current.key !== key) { startRef.current = { key, at: Date.now() }; setSec(0); }
    if (!running) return undefined;
    const t = setInterval(() => setSec(Math.floor((Date.now() - startRef.current.at) / 1000)), 250);
    return () => clearInterval(t);
  }, [running, key]);
  return sec;
}

function Timer({ sec }) {
  const cls = sec >= LATE_SEC ? ' course-timer--late' : sec >= WARN_SEC ? ' course-timer--warn' : '';
  return <span className={`course-timer${cls}`} aria-label={`경과 ${sec}초`}>⏱ {sec}초</span>;
}

function rangeLabel(pool) {
  const days = [...new Set(pool.map((x) => x.day))].sort((a, b) => a - b);
  if (!days.length) return '없음';
  return days.length === days[days.length - 1] - days[0] + 1 ? `Day ${days[0]}~${days[days.length - 1]}` : `Day ${days.join('·')}`;
}

function TestMode({ course, pool, teacher, speak }) {
  const router = useRouter();
  const search = useSearchParams();
  const urlSheet = Number(search.get('sheet'));
  const [sheetNo, setSheetNo] = useState(() => (urlSheet >= 1000 && urlSheet <= 9999 ? urlSheet : newSheetNo()));
  const [exclude, setExclude] = useState([]);
  const [phase, setPhase] = useState('ready'); // ready | run | done
  const [at, setAt] = useState(0);
  const [marks, setMarks] = useState({});
  const [revealed, setRevealed] = useState(false);
  const sheet = useMemo(() => buildTestSheet(pool, course.families, { seed: sheetNo, exclude }), [pool, course.families, sheetNo, exclude]);
  const size = sheet.items.length;
  const item = sheet.items[at];
  const sec = useElapsed(phase === 'run' && !revealed, `${sheetNo}-${at}`);
  const titleOf = useMemo(() => new Map(course.days.flatMap((d) => d.chapters.map((c) => [c.n, c.title]))), [course]);

  const setUrl = (no) => router.replace(`?mode=test&sheet=${no}`, { scroll: false });
  const start = () => { setMarks({}); setAt(0); setRevealed(false); setPhase('run'); setUrl(sheetNo); };
  const judge = useCallback((ok) => {
    if (!item) return;
    setMarks((m) => ({ ...m, [item.id]: ok }));
    setRevealed(false);
    if (at + 1 >= size) setPhase('done'); else setAt(at + 1);
  }, [item, at, size]);
  const again = () => { setMarks({}); setAt(0); setRevealed(false); setPhase('run'); };
  const fresh = () => { const no = newSheetNo(); setExclude(sheet.items.map((x) => x.id)); setSheetNo(no); setUrl(no); setMarks({}); setAt(0); setRevealed(false); setPhase('ready'); };

  // 선생님 키보드 — Space 모범답 · 1/O 통과 · 2/X 실패
  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (phase !== 'run' || e.target?.closest?.('input,select,textarea')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed((v) => !v); }
    else if (e.key === '1' || e.key.toLowerCase() === 'o') judge(true);
    else if (e.key === '2' || e.key.toLowerCase() === 'x') judge(false);
  };
  useEffect(() => {
    const on = (e) => keyRef.current?.(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  if (pool.length < TEST_SIZE) {
    return <CoursePending what={`시험에 쓸 교재 예문 (지금 ${pool.length}개 — ${TEST_SIZE}개 이상 필요)`} total={course.days.length * 30} />;
  }
  const score = sheet.items.filter((x) => marks[x.id]).length;
  const need = passMark(size);

  if (phase === 'ready') {
    return <div className="course-card">
      <div className="course-card__top"><span>시험지 #{sheetNo}</span><span>{size}문제 · {need}문제 이상 합격</span></div>
      <p className="course-card__prompt">한국어 문장을 보고 바로 일본어로 말해 보세요.</p>
      <p className="course-line__ko">뜻과 의도가 맞으면 통과예요. 비슷한 패턴으로 답해도 뜻이 맞으면 통과로 봐요. {teacher ? 'Space로 모범답, 1·O는 통과, 2·X는 실패예요.' : '혼자 볼 때는 모범답과 비교해 스스로 판정하세요.'}</p>
      <div className="course-actions"><button className="classroom-button" onClick={start}>시험 시작</button><button className="classroom-button classroom-button--quiet" onClick={fresh}>다른 시험지</button></div>
    </div>;
  }

  if (phase === 'done') {
    const passed = score >= need;
    return <div className="course-card">
      <div className="course-result">
        <span className="classroom-eyebrow">시험지 #{sheetNo}</span>
        <div className="course-result__score">{score} / {size}</div>
        <span className={`course-result__verdict course-result__verdict--${passed ? 'pass' : 'fail'}`}>{passed ? '합격' : `불합격 — ${need}문제 이상 필요`}</span>
      </div>
      <ol className="course-review">{sheet.items.map((x, k) => <li key={x.id}>
        <span className="course-line__no">{k + 1}</span>
        <span>{x.ko}</span>
        <button type="button" className={`course-mark course-mark--${marks[x.id] ? 'pass' : 'fail'}`} aria-label={`${k + 1}번 판정 바꾸기`} onClick={() => setMarks((m) => ({ ...m, [x.id]: !m[x.id] }))}>{marks[x.id] ? '○ 통과' : '✕ 실패'}</button>
        <span className="course-review__ja"><Ja ja={x.ja} yomi={x.yomi} /> · Ch.{x.n}</span>
      </li>)}</ol>
      <p className="course-keys">판정을 눌러 고칠 수 있어요. 결과는 저장되지 않아요.</p>
      <div className="course-actions"><button className="classroom-button classroom-button--quiet" onClick={again}>같은 시험지 다시</button><button className="classroom-button" onClick={fresh}>새 시험지</button></div>
    </div>;
  }

  const sibs = siblingChapters(item.n, course.families);
  return <div className="course-card">
    <div className="course-card__top"><span>{at + 1} / {size} · 시험지 #{sheetNo}</span><Timer sec={sec} /></div>
    <div className="course-test-meta">{revealed && <span>Ch.{item.n}</span>}<span className="course-dots" aria-label={`난이도 ${LEVEL[item.lv]}`}>{dots(item.lv)}</span></div>
    <p className="course-card__prompt">{item.ko}</p>
    {revealed ? <div className="course-answer">
      <div className="course-answer__ja"><Ja ja={item.ja} yomi={item.yomi} /> <SpeakButton text={item.ja} speak={speak} /></div>
      <TextbookOriginal text={item.textbook} />
      <FixNote note={item.note} />
      <p>목표 패턴: <span lang="ja">{item.pattern}</span> (Ch.{item.n} {item.title})</p>
      {sibs.length > 0 && <p>비슷한 패턴({sibs.map((n) => `Ch.${n} ${titleOf.get(n) || ''}`.trim()).join(' · ')})으로 답해도 뜻이 맞으면 통과</p>}
    </div> : <div className="course-actions" style={{ margin: '0 0 18px' }}><button type="button" className="classroom-button classroom-button--quiet" onClick={() => setRevealed(true)}>{teacher ? '모범답 보기 (선생님)' : '모범답 보기'}</button></div>}
    <div className="course-judge"><button type="button" className="course-judge__pass" onClick={() => judge(true)}>○ 통과</button><button type="button" className="course-judge__fail" onClick={() => judge(false)}>✕ 실패</button></div>
    {teacher && <p className="course-keys">Space 모범답 · 1(O) 통과 · 2(X) 실패</p>}
  </div>;
}

function PracticeMode({ course, pool, speak }) {
  const days = useMemo(() => [...new Set(pool.map((x) => x.day))].sort((a, b) => a - b), [pool]);
  const [range, setRange] = useState('all');
  const [dir, setDir] = useState('ko2ja');
  const [round, setRound] = useState(() => newSheetNo());
  const [onlyIds, setOnlyIds] = useState(null);
  const deck = useMemo(() => {
    const base = pool.filter((x) => (range === 'all' || String(x.day) === range) && (!onlyIds || onlyIds.includes(x.id)));
    return shuffled(base, seededRandom(round));
  }, [pool, range, onlyIds, round]);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(false);
  const [missed, setMissed] = useState([]);
  const reset = (ids = null) => { setOnlyIds(ids); setAt(0); setShown(false); setMissed([]); setRound(newSheetNo()); };

  if (pool.length === 0) return <CoursePending what="연습에 쓸 교재 예문" total={course.days.length * 30} />;
  const opts = <div className="course-practice-opts">
    <label>범위<select value={range} onChange={(e) => { setRange(e.target.value); reset(); }}><option value="all">전체 ({pool.length}문장)</option>{days.map((d) => <option key={d} value={String(d)}>Day {d}</option>)}</select></label>
    <label>방향<select value={dir} onChange={(e) => { setDir(e.target.value); reset(); }}><option value="ko2ja">한국어 → 일본어</option><option value="ja2ko">일본어 → 한국어</option></select></label>
  </div>;

  if (at >= deck.length) {
    return <>{opts}<div className="course-card"><div className="course-result">
      <span className="classroom-eyebrow">연습 끝</span>
      <div className="course-result__score">{deck.length - missed.length} / {deck.length}</div>
      <p className="course-line__ko">기록은 남지 않아요.</p>
    </div><div className="course-actions">
      {missed.length > 0 && <button className="classroom-button" onClick={() => reset(missed)}>모른 것만 다시 ({missed.length})</button>}
      <button className="classroom-button classroom-button--quiet" onClick={() => reset()}>처음부터</button>
    </div></div></>;
  }

  const x = deck[at];
  const next = (knew) => { if (!knew) setMissed((m) => [...m, x.id]); setShown(false); setAt(at + 1); };
  const ko2ja = dir === 'ko2ja';
  return <>{opts}<div className="course-card">
    <div className="course-card__top"><span>{at + 1} / {deck.length}</span><span>Day {x.day} · Ch.{x.n}</span></div>
    {ko2ja ? <p className="course-card__prompt">{x.ko}</p> : <p className="course-card__prompt" lang="ja"><Ja ja={x.ja} yomi={x.yomi} /> <SpeakButton text={x.ja} speak={speak} /></p>}
    {shown ? <div className="course-answer">
      {ko2ja ? <div className="course-answer__ja"><Ja ja={x.ja} yomi={x.yomi} /> <SpeakButton text={x.ja} speak={speak} /></div> : <div className="course-answer__ko">{x.ko}</div>}
      <TextbookOriginal text={x.textbook} />
      <FixNote note={x.note} />
      <p>패턴: <span lang="ja">{x.pattern}</span> (Ch.{x.n} {x.title})</p>
    </div> : <div className="course-actions" style={{ margin: '0 0 18px' }}><button type="button" className="classroom-button classroom-button--quiet" onClick={() => setShown(true)}>정답 보기</button></div>}
    <div className="course-judge"><button type="button" className="course-judge__pass" onClick={() => next(true)}>○ 알았어요</button><button type="button" className="course-judge__fail" onClick={() => next(false)}>✕ 다시 볼래요</button></div>
  </div></>;
}

export default function ClassCourseTestPage() {
  const { team: teamKey } = useParams();
  const search = useSearchParams();
  const { user, loading } = useAuth();
  const { speak } = useTTS();
  const q = useClassCourse(teamKey, user?.id, !loading);
  const { data: root } = useQuery({
    queryKey: ['class-root', user?.id, teamKey],
    queryFn: () => fetchTeamRoot(user.id, teamKey),
    enabled: !!user?.id && !!teamKey,
  });
  const teacher = canTeachClass(user, root);
  const [mode, setMode] = useState(() => search.get('mode') || null);
  const course = q.data?.course;
  const pool = useMemo(() => (course ? coursePool(course) : []), [course]);

  if (loading || q.isLoading) return <ClassroomState title="코스를 불러오고 있어요." />;
  if (q.error) return <ClassroomState title={courseErrorText(q.error)}><Link className="classroom-button" href={`/class/${teamKey}`}>수업 홈으로</Link></ClassroomState>;

  const active = mode || (teacher ? 'test' : 'practice');
  const testDate = currentSchedule(q.data.team?.schedule, course.days.length, kstToday())?.built.testDate;
  const total = course.days.length * 30;
  return <ClassroomShell lang="Japanese" teamHome>
    <div className="course-back-row"><Link className="classroom-back" href={`/class/${teamKey}?view=course`}>← 코스 목록</Link></div>
    <header className="course-head"><span className="classroom-eyebrow">{course.title}</span><h1>테스트</h1></header>
    <div className="course-test-modes" role="group" aria-label="테스트 종류">
      <button type="button" aria-pressed={active === 'test'} onClick={() => setMode('test')}>{teacher ? '시험 (10문제)' : '모의 시험 (10문제)'}</button>
      <button type="button" aria-pressed={active === 'practice'} onClick={() => setMode('practice')}>연습</button>
    </div>
    <div className="course-test-meta"><span>출제 범위: {rangeLabel(pool)}</span><span>예문 {pool.length}/{total} 입력</span>{testDate && <span>시험일 {shortDate(testDate)} (Day {course.days.length} 수업 날)</span>}</div>
    {active === 'test' && pool.length >= TEST_SIZE && <SheetNote pool={pool} course={course} />}
    {active === 'test' ? <TestMode course={course} pool={pool} teacher={teacher} speak={speak} /> : <PracticeMode course={course} pool={pool} speak={speak} />}
  </ClassroomShell>;
}

/** 입력된 범위가 좁아 출제 규칙을 풀었을 때만 알린다(시험지 번호와 무관하게 범위로 판정). */
function SheetNote({ pool, course }) {
  const note = useMemo(() => buildTestSheet(pool, course.families, { seed: 1 }).note, [pool, course.families]);
  return note ? <p className="course-test-note" role="note">{note} 교재 예문이 더 들어오면 Day마다 한 문제씩, 모두 다른 패턴으로 나와요.</p> : null;
}
