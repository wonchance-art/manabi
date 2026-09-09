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
import Button from '../components/Button';
import MaterialGroupCard from '../components/MaterialGroupCard';
import { LANG_NAME_KO } from '../lib/constants';
import { getTeam, dayLabel, listDayNotes, localViewerHref, toPlainText, TEAM_PW_MIN } from '../lib/classBoard';
import { fetchTeamRoot, fetchDayNotes, fetchBookChapters, chapterLabel } from '../lib/classTeamQueries';
import {
  readUnlock, clearUnlock, readIndexCache, isBannerOff, setBannerOff, unlockTeam, fetchTeamIndex,
  fetchTeamMaterial, ensureSharedCopy, copyIsStale,
} from '../lib/classClient';
import { listSharedCopies, copyDaysLeft } from '../lib/sharedStore';
import { claimSharedCopies, findExistingCopies } from '../lib/sharedCopy';

const RELOCK_MSG = '암호를 다시 입력해 주세요 — 선생님이 바꿨거나 30일이 지났어요.';
const errMsg = (err) => (err?.status === 429 ? '잠시 후 다시 시도해 주세요.' : err?.message || '알 수 없는 오류');

async function copyToClipboard(text, toast, done) {
  try { await navigator.clipboard.writeText(text); toast(done, 'success'); }
  catch { toast('복사하지 못했어요 — 브라우저에서 클립보드를 허용해 주세요.', 'warning'); }
}

function TeamHeader({ name, lang, sub, right }) {
  return (
    <div className="page-header page-header--row">
      <div>
        <h1 className="page-header__title">🏫 {name}{lang ? ` · ${LANG_NAME_KO[lang] || lang}` : ''}</h1>
        {sub && <p className="page-header__subtitle">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** S0 — 해제 전에는 팀 이름·존재를 보여주지 않는다(틀림·없음 동일 응답의 화면판). index를 받지 않는다. */
function LockedView({ pw, setPw, busy, message, onSubmit }) {
  return (
    <div className="page-container" style={{ maxWidth: 480 }}>
      <div className="page-header">
        <h1 className="page-header__title">🏫 수업 자료</h1>
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
  const team = getTeam(root.processed_json?.metadata);
  const { data: chapters = [] } = useQuery({
    queryKey: ['book-chapters', team.bookKey],
    queryFn: () => fetchBookChapters(team.bookKey),
    enabled: !!team.bookKey,
    staleTime: 1000 * 60,
  });
  const { data: noteRows = [] } = useQuery({
    queryKey: ['class-notes', user.id, teamKey],
    queryFn: () => fetchDayNotes(user.id, teamKey),
  });
  const notes = useMemo(() => listDayNotes(noteRows, teamKey), [noteRows, teamKey]);
  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/class/${teamKey}` : `/class/${teamKey}`;

  async function copyNote(id) {
    const { data, error } = await supabase.from('reading_materials').select('*').eq('id', id).maybeSingle();
    if (error || !data) { toast('정리본을 못 읽었어요.', 'error'); return; }
    await copyToClipboard(toPlainText(data), toast, '정리본을 복사했어요 — 카톡에 붙여 넣으세요.');
  }

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <TeamHeader name={team.name} lang={team.lang} sub="선생님 화면 — 학생은 링크 + 암호로 같은 목록을 봐요" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <Link href={`/class/${teamKey}/live`} className="btn btn--primary btn--sm">📱 입력판 열기</Link>
        <Link href={`/class/${teamKey}/board`} className="btn btn--secondary btn--sm">🖥 태블릿 판 열기</Link>
        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(shareLink, toast, '링크를 복사했어요.')}>🔗 링크 복사</Button>
        <Link href="/class" className="btn btn--ghost btn--sm">⚙ 설정 · 암호</Link>
      </div>
      {team.bookKey && (
        <MaterialGroupCard
          open
          icon="📘"
          title={chapters[0]?.title?.split(' — ')[0] || '교재'}
          meta={team.bookTotal ? `${team.bookTotal}과 중 ${chapters.length}과까지` : `${chapters.length}과`}
          rows={chapters.map((c) => ({
            key: c.id,
            onClick: () => router.push(`/viewer/${c.id}`),
            lead: c.order,
            title: chapterLabel(c.title),
            right: <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.status === 'completed' ? '분석됨' : ''}</span>,
          }))}
          footer={team.bookTotal && chapters.length < team.bookTotal ? `${chapters.length + 1}~${team.bookTotal}과는 아직 올라오지 않았어요` : null}
        />
      )}
      <NotesList notes={notes} onOpen={(n) => router.push(`/viewer/${n.id}`)} onCopy={(n) => copyNote(n.id)} />
    </div>
  );
}

function NotesList({ notes, onOpen, onCopy, right = null, dim = () => false }) {
  return (
    <div className="card" style={{ padding: '12px 14px', marginTop: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>📝 수업 정리</div>
      {notes.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>아직 수업 정리가 없어요 — 첫 수업 뒤에 생겨요.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {notes.map((n) => (
            <div key={n.id} className="group-card__row" role="button" tabIndex={0} aria-disabled={dim(n) || undefined}
              style={dim(n) ? { opacity: 0.5 } : undefined}
              onClick={() => onOpen(n)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(n))}>
              <span className="group-card__lead">{dayLabel(n.day)}</span>
              <span className="group-card__rowtitle">{n.lines != null ? `${n.lines}개` : n.title}</span>
              {right?.(n)}
              <button type="button" className="btn btn--ghost btn--sm" title="평문 복사" aria-label="정리본 평문 복사"
                onClick={(e) => { e.stopPropagation(); onCopy(n); }}>📋</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const { data: claimed, refetch: refetchClaimed } = useQuery({
    queryKey: ['class-claimed', user?.id],
    queryFn: () => findExistingCopies(supabase, user.id),
    enabled: !!user?.id,
  });
  const claimedMap = claimed || new Map();
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
    if (user) {
      const mine = claimedMap.get(String(id));
      if (mine) { router.push(`/viewer/${mine}`); return; }
      if (offline) { toast('온라인에서 담을 수 있어요.', 'warning'); return; }
      setRow(id, true);
      try {
        const payload = await fetchTeamMaterial(teamKey, unlock.token, id);
        const r = await claimSharedCopies(supabase, user.id, { materials: [payload] });
        const newId = r.byId.get(String(id));
        await refetchClaimed();
        if (newId) router.push(`/viewer/${newId}`);
      } catch (err) {
        if (err?.status === 401) relock(RELOCK_MSG); else toast('담지 못했어요 — ' + errMsg(err), 'error');
      } finally { setRow(id, false); }
      return;
    }
    const existing = copies.get(id);
    if (existing && !copyIsStale(existing, entry)) { router.push(localViewerHref(id, teamKey)); return; }
    if (offline) { toast(existing ? '사본이 낡았지만 오프라인이라 그대로 열어요.' : '온라인에서 받아야 해요.', existing ? 'info' : 'warning'); if (existing) router.push(localViewerHref(id, teamKey)); return; }
    setRow(id, true);
    try {
      await ensureSharedCopy(teamKey, unlock.token, entry);
      await refreshCopies();
      router.push(localViewerHref(id, teamKey));
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
      await copyToClipboard(toPlainText(copy.material), toast, '정리본을 복사했어요.');
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
        const payload = await fetchTeamMaterial(teamKey, unlock.token, e.id);
        await claimSharedCopies(supabase, user.id, { materials: [payload] });
        n += 1;
      }
      await refetchClaimed();
      toast(`${n}개를 내 자료로 담았어요.`, 'success');
    } catch (err) {
      await refetchClaimed();
      toast(`${n}개 담은 뒤 멈췄어요 — ` + errMsg(err), 'warning');
    } finally { setBusy(false); }
  }

  if (phase === 'loading') return null;
  if (phase === 'locked') return <LockedView pw={pw} setPw={setPw} busy={busy} message={lockMessage} onSubmit={handleUnlock} />;

  const team = index?.team || { key: teamKey, name: unlock?.name || teamKey };
  const chapters = index?.chapters || [];
  const notes = index?.notes || [];
  const unclaimedCount = user ? [...chapters, ...notes].filter((e) => !claimedMap.has(String(e.id))).length : 0;

  const chip = (entry) => {
    if (rowBusy[entry.id]) return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user ? '담는 중…' : '받는 중…'}</span>;
    if (user) {
      return claimedMap.has(String(entry.id))
        ? <span style={{ fontSize: '0.72rem', color: 'var(--accent-text)' }}>✓ 내 자료</span>
        : <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>↓ 담기</span>;
    }
    const c = copies.get(entry.id);
    if (!c) return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{offline ? '온라인에서 받기' : '·'}</span>;
    if (copyIsStale(c, entry)) return <span style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>● 새 버전</span>;
    return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⬇ {copyDaysLeft(c)}일</span>;
  };
  const dim = (entry) => !user && offline && !copies.get(entry.id);

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <TeamHeader
        name={team.name}
        lang={team.lang}
        right={user && unclaimedCount > 0 ? <Button size="sm" disabled={busy || offline} onClick={claimAll}>📥 전부 내 자료로 ({unclaimedCount})</Button> : null}
      />
      {!user && !bannerOff && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-md)', background: 'var(--primary-glow)', border: '1px solid var(--primary)', fontSize: '0.82rem' }}>
          <span style={{ flex: 1, minWidth: 200 }}>로그인하면 이 교재와 수업 정리가 내 자료로 담겨요</span>
          <Link href={`/auth?from=${encodeURIComponent(`/class/${teamKey}`)}`} className="btn btn--primary btn--sm">로그인 →</Link>
          <button type="button" className="btn btn--ghost btn--sm" aria-label="닫기" onClick={() => { setBannerOff(teamKey); setBannerOffState(true); }}>✕</button>
        </div>
      )}
      {offline && <p role="status" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>오프라인 — 받아 둔 사본만 열려요.</p>}

      {team.bookKey && (
        <MaterialGroupCard
          open
          icon="📘"
          title={team.bookTitle || '교재'}
          meta={team.bookTotal ? `${team.bookTotal}과 중 ${chapters.length}과까지` : `${chapters.length}과`}
          rows={chapters.map((c) => ({
            key: c.id,
            onClick: () => { if (!dim(c)) openEntry(c); },
            lead: c.order,
            title: chapterLabel(c.title),
            right: chip(c),
          }))}
          footer={team.bookTotal && chapters.length < team.bookTotal
            ? `${chapters.length + 1}~${team.bookTotal}과는 아직 올라오지 않았어요`
            : (!user ? '탭하면 받아서 열어요 · 사본은 7일 뒤 지워져요' : null)}
        />
      )}
      <NotesList notes={notes} onOpen={(n) => { if (!dim(n)) openEntry(n); }} onCopy={copyNotePlain} right={chip} dim={dim} />
    </div>
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
  if (loading || (user && rootLoading)) return null;
  const owned = !!user && !!root && root.owner_id === user.id;
  if (owned) return <OwnerView root={root} user={user} teamKey={teamKey} toast={toast} />;
  return <StudentView teamKey={teamKey} user={user} toast={toast} />;
}
