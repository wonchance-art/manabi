'use client';

/**
 * 팀 페이지 `/class/[team]` (v2-AB R2 — #1077 5603827169 §6 · 팀 페이지 상세 5604199672).
 *
 *   S0 잠김(암호 — 팀 이름을 보여주지 않는다) → S1 목록(비로그인: 사본으로 local: 뷰어) →
 *   S4 목록(로그인 학생: 담긴 건 정식 뷰어, 아니면 즉시 복제) · S5 오너 뷰(RLS 직접, API 라우트 0)
 *   S7 — 401은 잠김으로, 오프라인은 목록 캐시 + 사본 있는 행만.
 *
 * 받기는 이 페이지만 한다(`?open=<id>`도 여기서 받고 뷰어로 보낸다) — local: 뷰어는 네트워크 0.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { ClassroomShell,ClassroomState,ClassCover } from '../components/classroom/ClassroomUI';
import {canTeachClass,startingChapter,classWorkspaceHref} from '../lib/classWorkspace';
import ClassTeamSettings from '../components/classroom/ClassTeamSettings';
import { classroomPlainText } from '../lib/classroomModel';
import Button from '../components/Button';
import MaterialGroupCard from '../components/MaterialGroupCard';
import { LANG_NAME_KO } from '../lib/constants';
import { getTeam, todayKey, dayLabel, listDayNotes, localViewerHref, TEAM_PW_MIN } from '../lib/classBoard';
import { fetchTeamRoot, fetchDayNotes, fetchBookChapters, chapterLabel } from '../lib/classTeamQueries';
import {
  readUnlock, clearUnlock, readIndexCache, isBannerOff, setBannerOff, unlockTeam, fetchTeamIndex,
  ensureSharedCopy, copyIsStale,
} from '../lib/classClient';
import { listSharedCopies, copyDaysLeft } from '../lib/sharedStore';
import { findExistingCopies } from '../lib/sharedCopy';
import { requestClassCopy, studentReaderHref } from '../lib/classCopyClient';
import ClassRemoteHistory from '../components/classroom/ClassRemoteHistory';
import ClassStudyHistory from '../components/classroom/ClassStudyHistory';
import {classHistoryEntries} from '../lib/classStudyHistory';
import ClassSaveResume from '../components/classroom/ClassSaveResume';
import {classEntryHref,cacheClassSource} from '../lib/classHistoryNavigation';

const RELOCK_MSG = '암호를 다시 입력해 주세요 — 선생님이 바꿨거나 30일이 지났어요.';
const errMsg = (err) => (err?.status === 429 ? '잠시 후 다시 시도해 주세요.' : err?.message || '알 수 없는 오류');

async function copyToClipboard(text, toast, done) {
  try { await navigator.clipboard.writeText(text); toast(done, 'success'); }
  catch { toast('복사하지 못했어요 — 브라우저에서 클립보드를 허용해 주세요.', 'warning'); }
}

function TeamHeader({ name, lang, sub, right }) {
  return (
    <header className="class-team-heading">
      <div><span className="classroom-eyebrow">MANABI CLASS{lang?` · ${LANG_NAME_KO[lang]||lang}`:''}</span><h1>{name}</h1>{sub&&<p>{sub}</p>}</div>{right}
    </header>
  );
}

/** S0 — 해제 전에는 팀 이름·존재를 보여주지 않는다(틀림·없음 동일 응답의 화면판). index를 받지 않는다. */
function LockedView({ pw, setPw, busy, message, onSubmit }) {
  return (
    <div className="page-container" style={{ maxWidth: 480 }}>
      <div className="page-header">
        <h1 className="page-header__title">수업 자료</h1>
        <p className="page-header__subtitle">선생님께 받은 암호를 입력하세요.</p>
      </div>
      <form className="card" onSubmit={onSubmit} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="암호"
            autoComplete="off"
            aria-label="팀 암호"
            autoFocus
          />
          <Button type="submit" size="md" disabled={busy || pw.trim().length < TEAM_PW_MIN}>{busy ? '여는 중…' : '열기'}</Button>
        </div>
        {message
          ? <p role="alert" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--danger)' }}>{message}</p>
          : <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>이 기기에서는 한 번만 입력해요.</p>}
      </form>
    </div>
  );
}

/** S5 — 오너: 암호·토큰 없이 RLS 직접. 같은 카드·같은 목록에 내 뷰어 링크. */
function OwnerView({ root, user, teamKey, toast }) {
  const router = useRouter();
  const routeSearch=useSearchParams();
  const [tab,setTab]=useState(()=>routeSearch.get('view')==='history'?'notes':'book');
  const team = getTeam(root.processed_json?.metadata);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const settingsButton=useRef(null);
  const { data: chapters = [], error:chaptersError, isLoading:chaptersLoading, refetch:retryChapters } = useQuery({
    queryKey: ['class-book-chapters', user.id, team.bookKey],
    queryFn: () => fetchBookChapters(team.bookKey),
    enabled: !!team.bookKey,
    staleTime: 1000 * 60,
  });
  const { data: noteRows = [], error: notesError, isLoading: notesLoading, refetch: retryNotes } = useQuery({
    queryKey: ['class-notes', user.id, teamKey],
    queryFn: () => fetchDayNotes(user.id, teamKey),
  });
  const notes = useMemo(() => listDayNotes(noteRows, teamKey), [noteRows, teamKey]);
  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/class/${teamKey}` : `/class/${teamKey}`;

  async function copyNote(id) {
    const { data, error } = await supabase.from('reading_materials').select('*').eq('id', id).maybeSingle();
    if (error || !data) { toast('정리본을 못 읽었어요.', 'error'); return; }
    await copyToClipboard(classroomPlainText(data), toast, '정리본을 복사했어요 — 카톡에 붙여 넣으세요.');
  }

  const coverageQuery=useQuery({queryKey:['class-coverage',root.id],queryFn:async()=>{const {data,error}=await supabase.from('class_teaching_coverage').select('day,material_ids').eq('root_id',root.id).order('day',{ascending:false});if(error)throw error;return data||[];}});
  const history=notes.map(n=>({...n,entries:classHistoryEntries(noteRows.find(r=>String(r.id)===String(n.id)),chapters.map(c=>c.id))}));
  const latest=notes[0];
  const back=`/class/${teamKey}${tab==='notes'?'?view=history':''}`;
  const start=startingChapter(team,chapters);
  const openHref=id=>tab==='book'?classWorkspaceHref(id,teamKey,todayKey()):`/viewer/${id}?returnTo=${encodeURIComponent(back)}`;
  const startHref=start?classWorkspaceHref(start.id,teamKey,todayKey()):`/class/${teamKey}/live`;
  return <ClassroomShell lang={team.lang} teamHome>
    <header className="class-team-heading"><div><span className="classroom-eyebrow">MANABI CLASS · {LANG_NAME_KO[team.lang]}</span><h1>{team.name}</h1></div><div className="class-team-actions"><button className="classroom-text-button" onClick={()=>copyToClipboard(shareLink,toast,'수업 링크를 복사했어요.')}>학생 초대</button><button ref={settingsButton} className="classroom-text-button" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(v=>!v)}>설정</button></div></header>
    {settingsOpen&&<ClassTeamSettings root={root} user={user} onClose={()=>{setSettingsOpen(false);settingsButton.current?.focus();}}/>}
    {tab==='book'&&<section className="class-team-start" aria-label="수업 시작"><ClassCover team={team} small/><div><span className="classroom-eyebrow">{dayLabel(todayKey())} 수업</span><h2>{start?chapterLabel(start.title):team.bookKey?'교재를 확인하고 있어요':'교재 없이 함께 배우기'}</h2><p>{start?'교재를 펼친 채 뜻을 확인하고, 오늘 배운 표현을 남깁니다.':'표현을 입력해 설명하고 수업 기록에 남길 수 있어요.'}</p>{!chaptersError&&!chaptersLoading&&<Link className="classroom-button" href={startHref}>{team.chapterId&&start?'수업 이어하기':'수업 시작'} <span aria-hidden="true">→</span></Link>}{chaptersLoading&&<p role="status">교재를 불러오는 중…</p>}{chaptersError&&<p role="alert">교재를 불러오지 못했어요. <button className="classroom-text-button" onClick={()=>retryChapters()}>다시 확인</button></p>}</div></section>}
    <div className="classroom-tabs" aria-label="수업 자료 종류"><button aria-pressed={tab==='book'} onClick={()=>setTab('book')}>교재</button><button aria-pressed={tab==='notes'} onClick={()=>setTab('notes')}>수업 기록 {notes.length||''}</button></div>
    {tab==='notes'?<>
      {notesLoading?<p role="status">수업 노트를 불러오는 중…</p>:notesError?<div className="classroom-notice" role="alert">노트를 불러오지 못했어요. <button onClick={()=>retryNotes()}>다시 불러오기</button></div>:latest&&<Link href={openHref(latest.id)} className="classroom-featured-note"><span className="classroom-eyebrow">최근 수업 노트</span><h2>{dayLabel(latest.day)}에 함께 배운 것들.</h2><p>{latest.title}</p><b>노트 읽기 →</b></Link>}
      {!notesLoading&&!notesError&&<ClassStudyHistory notes={history} coverage={coverageQuery.data||[]} chapters={chapters} onOpen={n=>router.push(classEntryHref(openHref(n.id),teamKey,n))} onCopy={n=>copyNote(n.id)}/>}</>
      :team.bookKey?<MaterialGroupCard open title={chapters[0]?.title?.split(' — ')[0]||'수업 교재'} meta={`공유된 ${chapters.length}과${team.bookTotal?` · 전체 ${team.bookTotal}과`:''}`} rows={chapters.map(c=>({key:c.id,onClick:()=>router.push(openHref(c.id)),lead:c.order,title:chapterLabel(c.title),right:String(c.id)===team.chapterId?<span>이어서 볼 과</span>:null}))}/>:<div className="classroom-empty"><b>자유롭게 배우는 수업입니다.</b><p>교재를 연결하면 이곳에서 바로 펼쳐볼 수 있어요.</p><button className="classroom-button classroom-button--quiet" onClick={()=>setSettingsOpen(true)}>교재 연결</button></div>}
  </ClassroomShell>;
}

function NotesList({notes,onOpen,onCopy,right=null,dim=()=>false}) {
  return <section className="classroom-note-list" aria-label="날짜별 수업 노트">
    {!notes.length?<div className="classroom-empty"><b>첫 수업 노트를 기다리고 있어요.</b><p>수업에서 입력한 표현이 날짜별로 모입니다.</p></div>:notes.map(n=><div className="classroom-note-row" key={n.id}><button disabled={dim(n)} onClick={()=>onOpen(n)}><time dateTime={n.day}>{dayLabel(n.day)}</time><strong>{n.lines!=null?`함께 배운 표현 ${n.lines}개`:n.title}</strong>{right?.(n)}</button><button className="classroom-text-button" aria-label={`${dayLabel(n.day)} 노트 복사`} onClick={()=>onCopy(n)}>복사</button></div>)}
  </section>;
}

/** S0·S1·S4·S7 — 학생(비로그인·로그인). */
function StudentView({ teamKey, user, toast }) {
  const router = useRouter();
  const search = useSearchParams();
  const [phase, setPhase] = useState('loading'); // loading | locked | ready
  const [unlock, setUnlock] = useState(null);
  const [index, setIndex] = useState(null);
  const [lockMessage, setLockMessage] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [copies, setCopies] = useState(() => new Map());
  const [rowBusy, setRowBusy] = useState({});
  const [choice,setChoice]=useState(null);
  const [studentTab,setStudentTab]=useState(()=>search.get('day')||search.get('view')==='history'?'notes':'book');
  const [bannerOff, setBannerOffState] = useState(true);

  const refreshCopies = useCallback(async () => {
    const list = await listSharedCopies();
    setCopies(new Map(list.map((e) => [e.id, e])));
  }, []);

  const relock = useCallback((message) => {
    clearUnlock(teamKey);
    setUnlock(null);
    setIndex(null);
    setPhase('locked');
    setLockMessage(message || '');
  }, [teamKey]);

  // 진입 — 토큰이 있으면 목록(온라인) 또는 목록 캐시(오프라인). 없으면 잠김.
  useEffect(() => {
    let alive = true;
    (async () => {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setOffline(isOffline);
      setBannerOffState(isBannerOff(teamKey));
      await refreshCopies();
      const u = readUnlock(teamKey);
      if (!alive) return;
      if (!u) { setPhase('locked'); return; }
      const cached = readIndexCache(teamKey)?.index || null;
      if (isOffline) {
        setUnlock(u);
        if (cached) { setIndex(cached); setPhase('ready'); }
        else { setPhase('locked'); setLockMessage('오프라인이라 목록을 못 받았어요 — 연결되면 다시 열어 주세요.'); }
        return;
      }
      try {
        const idx = await fetchTeamIndex(teamKey, u.token);
        if (!alive) return;
        setUnlock(u); setIndex(idx); setPhase('ready');
      } catch (err) {
        if (!alive) return;
        if (err?.status === 401) relock(RELOCK_MSG);
        else if (cached) { setUnlock(u); setIndex(cached); setPhase('ready'); }
        else { setPhase('locked'); setLockMessage(err?.status === 503 ? '지금은 열 수 없어요 — 설정을 준비 중이에요.' : '목록을 못 받았어요. 잠시 후 다시 열어 주세요.'); }
      }
    })();
    const onClaimed = () => { refreshCopies(); };
    window.addEventListener('manabi:shared-claimed', onClaimed);
    return () => { alive = false; window.removeEventListener('manabi:shared-claimed', onClaimed); };
  }, [teamKey, refreshCopies, relock]);

  // S4 — 로그인 학생: 이미 내 자료로 담긴 원본(source_ref → 내 id)
  const { data: claimed, error: claimedError, refetch: refetchClaimed } = useQuery({
    queryKey: ['class-claimed', user?.id],
    queryFn: () => findExistingCopies(supabase, user.id),
    enabled: !!user?.id,
  });
  const claimedMap = useMemo(() => claimed || new Map(), [claimed]);
  const {data:recentActivity=[]}=useQuery({queryKey:['class-reading-activity',user?.id,teamKey],enabled:!!user?.id,
    queryFn:async()=>{const {data,error}=await supabase.from('library_reading_activity').select('context,opened_at').eq('owner_id',user.id).order('opened_at',{ascending:false}).limit(100);if(error)throw error;return data||[];}});

  useEffect(() => {
    if (!user?.id) return undefined;
    const on = () => { refetchClaimed(); };
    window.addEventListener('manabi:shared-claimed', on);
    return () => window.removeEventListener('manabi:shared-claimed', on);
  }, [user?.id, refetchClaimed]);

  async function handleUnlock(e) {
    e.preventDefault();
    if (pw.trim().length < TEAM_PW_MIN) { setLockMessage(`암호는 ${TEAM_PW_MIN}자 이상이에요.`); return; }
    setBusy(true);
    setLockMessage('');
    try {
      const data = await unlockTeam(teamKey, pw);
      setUnlock(readUnlock(teamKey));
      setIndex(data.index);
      setPhase('ready');
      setPw('');
    } catch (err) {
      setLockMessage(err?.status === 429 ? '잠시 후 다시 시도해 주세요.'
        : err?.status === 503 ? '지금은 열 수 없어요 — 설정을 준비 중이에요.'
          : '암호가 맞지 않거나 없는 팀이에요.');
    } finally {
      setBusy(false);
    }
  }

  const setRow = (id, v) => setRowBusy((b) => ({ ...b, [id]: v }));

  /** 행 열기 — 로그인이면 복제본(정식 뷰어), 아니면 사본(local: 뷰어). 받기는 여기서만. */
  const openEntry = useCallback(async (entry) => {
    if (!unlock) return;
    const id = entry.id;
    const destination=href=>classEntryHref(href,teamKey,entry);
    if (user) {
      if (offline) { const mine=claimedMap.get(String(id));if(mine)router.push(destination(studentReaderHref(mine,teamKey,entry.day)));else toast('온라인에서 처음 열 수 있어요.','warning');return; }
      setRow(id,true);
      try {
        const result=await requestClassCopy(teamKey,id,'open');
        if(result.state==='choose'){setChoice({entry,candidates:result.candidates});return;}
        await refetchClaimed();
        if(result.copyId)router.push(destination(studentReaderHref(result.copyId,teamKey,entry.day)));
      }catch(err){if(err?.status===401)relock(RELOCK_MSG);else toast(err.message,'error');}
      finally{setRow(id,false);}return;
    }
    const existing = copies.get(id);
    cacheClassSource(sessionStorage,teamKey,entry);
    if (offline && existing && !copyIsStale(existing, entry)) { router.push(destination(localViewerHref(id, teamKey))); return; }
    if (offline) { toast(existing ? '사본이 낡았지만 오프라인이라 그대로 열어요.' : '온라인에서 받아야 해요.', existing ? 'info' : 'warning'); if (existing) router.push(destination(localViewerHref(id, teamKey))); return; }
    setRow(id, true);
    try {
      await ensureSharedCopy(teamKey, unlock.token, entry, {refresh:true});
      await refreshCopies();
      router.push(destination(localViewerHref(id, teamKey)));
    } catch (err) {
      if (err?.status === 401) relock(RELOCK_MSG); else toast('받지 못했어요 — ' + errMsg(err), 'error');
    } finally { setRow(id, false); }
  }, [unlock, user, claimedMap, offline, teamKey, copies, router, toast, refetchClaimed, refreshCopies, relock]);

  // `?open=<id>` — local: 뷰어의 이전/다음 과가 여기를 거친다(받기 단일 소유). 한 번만.
  const openedRef = useRef(null);
  useEffect(() => {
    const wanted = search.get('open');
    if (phase !== 'ready' || !index || !wanted || openedRef.current === wanted) return;
    const entry = [...(index.chapters || []), ...(index.notes || [])].find((c) => String(c.id) === String(wanted));
    if (!entry) return;
    openedRef.current = wanted;
    openEntry(entry);
  }, [phase, index, search, openEntry]);

  async function copyNotePlain(n) {
    if (!unlock) return;
    try {
      const copy = await ensureSharedCopy(teamKey, unlock.token, n);
      await refreshCopies();
      await copyToClipboard(classroomPlainText(copy.material), toast, '정리본을 복사했어요.');
    } catch (err) { toast('복사하지 못했어요 — ' + errMsg(err), 'error'); }
  }

  async function claimAll() {
    if (!unlock || !user || !index) return;
    const all = [...(index.chapters || []), ...(index.notes || [])].filter((e) => !claimedMap.has(String(e.id)));
    if (all.length === 0) return;
    setBusy(true);
    let n = 0;
    try {
      for (const e of all) {
        const result=await requestClassCopy(teamKey,e.id,'open');
        if(!result.copyId)throw new Error('기존 사본을 먼저 선택해야 하는 자료가 있어요.');
        n += 1;
      }
      await refetchClaimed();
      toast(`${n}개를 내 자료로 담았어요.`, 'success');
    } catch (err) {
      await refetchClaimed();
      toast(`${n}개 담은 뒤 멈췄어요 — ` + errMsg(err), 'warning');
    } finally { setBusy(false); }
  }

  if (phase === 'loading') return <ClassroomState title="수업을 불러오고 있어요."/>;
  if (phase === 'locked') return <LockedView pw={pw} setPw={setPw} busy={busy} message={lockMessage} onSubmit={handleUnlock} />;

  const team = index?.team || { key: teamKey, name: unlock?.name || teamKey };
  const chapters = index?.chapters || [];
  const notes = index?.notes || [];
  const allEntries=chapters;
  const recent=recentActivity.map(a=>allEntries.find(e=>String(claimedMap.get(String(e.id)))===String(a.context?.materialId))).find(Boolean);
  const featured=recent||chapters.find(c=>String(c.id)===String(team.chapterId))||chapters[0]||notes[0];

  const unclaimedCount = user ? [...chapters, ...notes].filter((e) => !claimedMap.has(String(e.id))).length : 0;

  const chip = (entry) => {
    if (rowBusy[entry.id]) return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user ? '담는 중…' : '받는 중…'}</span>;
    if (user) {
      return claimedMap.has(String(entry.id))
        ? <span style={{ fontSize: '0.72rem', color: 'var(--accent-text)' }}>✓ 내 자료</span>
        : <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>읽기 시작 →</span>;
    }
    const c = copies.get(entry.id);
    if (!c) return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{offline ? '온라인에서 받기' : '·'}</span>;
    if (copyIsStale(c, entry)) return <span style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>● 새 버전</span>;
    return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⬇ {copyDaysLeft(c)}일</span>;
  };
  const dim = (entry) => !user && offline && !copies.get(entry.id);

  return (
    <ClassroomShell lang={team.lang} teamHome>
      <TeamHeader
        name={team.name}
        lang={team.lang}
        right={user && unclaimedCount > 0 ? <details><summary>보관 옵션</summary><Button size="sm" disabled={busy || offline} onClick={claimAll}>남은 자료 모두 보관 ({unclaimedCount})</Button></details> : null}
      />
      {!user && !bannerOff && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-md)', background: 'var(--primary-glow)', border: '1px solid var(--primary)', fontSize: '0.82rem' }}>
          <span style={{ flex: 1, minWidth: 200 }}>로그인하면 여는 자료를 내 서재에 보관해요</span>
          <Link href={`/auth?from=${encodeURIComponent(`/class/${teamKey}`)}`} className="btn btn--primary btn--sm">로그인 →</Link>
          <button type="button" className="btn btn--ghost btn--sm" aria-label="닫기" onClick={() => { setBannerOff(teamKey); setBannerOffState(true); }}>✕</button>
        </div>
      )}
      {offline && <p role="status" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>오프라인 — 받아 둔 사본만 열려요.</p>}

      {featured&&studentTab==='book'&&<button className="classroom-featured-note" onClick={()=>openEntry(featured)} disabled={!!rowBusy[featured.id]}><span className="classroom-eyebrow">{recent?'이어서 공부하기':featured.day?'최근 수업 노트':'수업 교재'}</span><h2>{featured.day?`${dayLabel(featured.day)} 수업 노트`:chapterLabel(featured.title)}</h2><p>{recent?'읽던 위치에서 계속 공부하세요.':'한 표현씩, 내 언어로 만들어 보세요.'}</p><b>{rowBusy[featured.id]?'자료 확인 중…':recent?'이어 읽기 →':'읽기 시작 →'}</b>{user&&<small>처음 여는 자료는 내 서재에 보관됩니다.</small>}</button>}
      {claimedError&&<p role="alert">내 자료 목록을 확인하지 못했어요. <button onClick={()=>refetchClaimed()}>다시 확인</button></p>}
      {choice&&<div className="classroom-notice" role="group" aria-label="기존 사본 선택"><b>사용할 사본을 선택하세요.</b><p>다른 사본은 삭제하지 않습니다.</p>{choice.candidates.map(c=><button key={c.id} disabled={busy} onClick={async()=>{setBusy(true);try{const r=await requestClassCopy(teamKey,choice.entry.id,'open',{preferred:c.id});if(r.copyId)router.push(classEntryHref(studentReaderHref(r.copyId,teamKey,choice.entry.day),teamKey,choice.entry));setChoice(null);}catch(e){toast(e.message,'error');}finally{setBusy(false);}}}>{c.title} · {new Date(c.createdAt).toLocaleDateString('ko-KR')}</button>)}<button onClick={()=>setChoice(null)}>나중에</button></div>}
      <div className="classroom-tabs" aria-label="수업 자료 종류"><button aria-pressed={studentTab==='book'} onClick={()=>setStudentTab('book')}>교재</button><button aria-pressed={studentTab==='notes'} onClick={()=>setStudentTab('notes')}>수업 기록</button></div>
      {studentTab==='notes'&&<ClassRemoteHistory team={teamKey} user={user} chapters={chapters} onOpen={n=>{if(!dim(n))openEntry(n);}} onCopy={copyNotePlain} disabled={dim}/>}
      {studentTab==='book'&&!team.bookKey&&<div className="classroom-empty"><p>아직 연결된 교재가 없어요. 수업 기록에서 함께 배운 표현을 확인하세요.</p></div>}
      {studentTab==='book'&&team.bookKey && (
        <MaterialGroupCard open
          title={team.bookTitle || '교재'}
          meta={`공유된 ${chapters.length}과${team.bookTotal?` · 전체 ${team.bookTotal}과`:""}`}
          rows={chapters.map((c) => ({
            key: c.id,
            onClick: () => { if (!dim(c)) openEntry(c); },
            lead: c.order,
            title: chapterLabel(c.title),
            right: chip(c),
          }))}
          footer={team.bookTotal && chapters.length < team.bookTotal
            ? `아직 공유되지 않은 과가 있어요`
            : (!user ? '탭하면 받아서 열어요 · 사본은 7일 뒤 지워져요' : null)}
        />
      )}

    </ClassroomShell>
  );
}

export default function ClassTeamPage() {
  const { team: teamKey } = useParams();
  const { user, loading } = useAuth();
  const toast = useToast();
  const { data: root, isLoading: rootLoading } = useQuery({
    queryKey: ['class-root', user?.id, teamKey],
    queryFn: () => fetchTeamRoot(user.id, teamKey),
    enabled: !!user?.id && !!teamKey,
  });
  if (loading || (user && rootLoading)) return <ClassroomState title="수업을 불러오고 있어요."/>;
  const owned = canTeachClass(user,root);
  if (owned) return <><ClassSaveResume user={user}/><OwnerView root={root} user={user} teamKey={teamKey} toast={toast} /></>;
  return <><ClassSaveResume user={user}/><StudentView teamKey={teamKey} user={user} toast={toast} /></>;
}
