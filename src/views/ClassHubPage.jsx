'use client';

/**
 * 수업 팀 허브 `/class` (v2-AB R1 · 팀 페이지 상세 S6, #1077 5604199672) — 오너 전용.
 *
 * 팀을 만들고(키·이름·언어·교재·암호) 설정을 고친다. 팀 = 루트 자료 한 행(metadata.team) — 새 테이블 0.
 * 암호는 **브라우저에서 해시**해 저장한다(평문은 어디에도 남지 않는다). 그래서 오너도 나중에 못 본다 —
 * 생성·변경 모달에서 **그때 한 번만** 보여 주고 복사하게 한다(「암호는 지금만 보여요」).
 * 학생·익명은 여기서 팀 목록을 볼 수 없다 — 팀 링크로 들어온다.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { LANG_NAME_KO } from '../lib/constants';
import { listAppendableBooks } from '../lib/bookAppend';
import {
  listTeams, listDayNotes, buildTeamRootRow, patchTeamRoot, TEAM_KEY_RE, TEAM_PW_MIN, dayLabel,
} from '../lib/classBoard';
import { ClassroomShell,ClassroomState,ClassCover } from '../components/classroom/ClassroomUI';
import ClassroomJoin from '../components/classroom/ClassroomJoin';
import { saveClassroomMetadata } from '../lib/classroomModel';
import { hashPassword, makeSalt, validatePassword } from '../lib/classPassword';

const LANG_OPTIONS = ['Japanese', 'Chinese', 'English', 'French'];

async function fetchTeamRows(userId) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('id, title, raw_text, owner_id, created_at, processed_json')
    .eq('owner_id', userId)
    .not('processed_json->metadata->team', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchBookRows(userId) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('id, created_at, processed_json->metadata->>language, processed_json->metadata->>level, processed_json->metadata->book')
    .eq('owner_id', userId)
    .not('processed_json->metadata->book', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id, created_at: r.created_at,
    processed_json: { metadata: { language: r.language, level: r.level, book: r.book } },
  }));
}

function shareLink(key) {
  if (typeof window === 'undefined') return `/class/${key}`;
  return `${window.location.origin}/class/${key}`;
}

async function copyText(text, toast, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label}를 복사했어요.`, 'success');
  } catch {
    toast(`${label}: ${text}`, 'info', 8000);
  }
}

export default function ClassHubPage() {
  const { user, isAdmin, loading } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: teamRows = [], isLoading, error: teamError, refetch: retryTeams } = useQuery({
    queryKey: ['class-teams', user?.id],
    queryFn: () => fetchTeamRows(user.id),
    enabled: !!user?.id && isAdmin,
  });
  const { data: bookRows = [] } = useQuery({
    queryKey: ['class-books', user?.id],
    queryFn: () => fetchBookRows(user.id),
    enabled: !!user?.id && isAdmin,
  });
  const teams = useMemo(() => listTeams(teamRows), [teamRows]);
  const books = useMemo(() => listAppendableBooks(bookRows), [bookRows]);
  const bookByKey = useMemo(() => new Map(books.map((b) => [b.key, b])), [books]);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ key: '', name: '', lang: 'Japanese', bookKey: '', bookTotal: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(null); // { key, name, password } — 생성·변경 직후 한 번만
  const [editing, setEditing] = useState(null);   // 설정 중인 팀(루트 자료)
  const [editDraft, setEditDraft] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);  // 암호 바꾸는 팀
  const [pwDraft, setPwDraft] = useState('');
  const [pwConfirm, setPwConfirm] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['class-teams', user?.id] });

  async function handleCreate(e) {
    e.preventDefault();
    const key = draft.key;
    if (!draft.name.trim()) { toast('수업 이름을 적어 주세요.', 'warning'); return; }
    if (!TEAM_KEY_RE.test(key)) { toast('팀 키는 소문자·숫자·하이픈 1~16자예요(링크 주소가 돼요).', 'warning'); return; }
    if (teams.some((t) => t.key === key)) { toast('이미 있는 팀 키예요.', 'warning'); return; }
    const pwError = validatePassword(draft.password, TEAM_PW_MIN);
    if (pwError) { toast(pwError, 'warning'); return; }
    setBusy(true);
    try {
      const pwSalt = makeSalt();
      const pwHash = await hashPassword(draft.password, pwSalt);
      const row = buildTeamRootRow({
        key, name: draft.name, lang: draft.lang, bookKey: draft.bookKey || null,
        bookTotal: draft.bookTotal ? Number(draft.bookTotal) : null, pwHash, pwSalt, ownerId: user.id,
      });
      const existing = await supabase.from('reading_materials').select('id').eq('owner_id',user.id).eq('processed_json->metadata->team->>key',key).eq('processed_json->metadata->team->>root','true').maybeSingle();
      if(existing.error) throw existing.error;
      if(!existing.data){const {error}=await supabase.from('reading_materials').insert(row);if(error)throw error;}
      setRevealed({ key, name: row.processed_json.metadata.team.name, password: draft.password });
      setDraft({ key: '', name: '', lang: 'Japanese', bookKey: '', bookTotal: '', password: '' });
      setCreating(false);
      refresh();
    } catch (err) {
      toast('수업 만들기 실패 — ' + (err?.message || '알 수 없는 오류'), 'error');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(team) {
    setEditing(team);
    setEditDraft({ name: team.name, lang: team.lang, bookKey: team.bookKey || '', bookTotal: team.bookTotal ? String(team.bookTotal) : '' });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (!editing || !editDraft) return;
    setBusy(true);
    try {
      const next = patchTeamRoot(editing.material.processed_json, {
        name: editDraft.name.trim() || editing.key,
        lang: editDraft.lang,
        bookKey: editDraft.bookKey || null,
        bookTotal: editDraft.bookTotal ? Number(editDraft.bookTotal) : null,
      });
      await saveClassroomMetadata(supabase,editing.material,next.metadata);
      toast('설정을 저장했어요.', 'success');
      setEditing(null);
      refresh();
    } catch (err) {
      toast('설정 저장 실패 — ' + (err?.message || '알 수 없는 오류'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordChange() {
    setPwConfirm(false);
    if (!pwTarget) return;
    const pwError = validatePassword(pwDraft, TEAM_PW_MIN);
    if (pwError) { toast(pwError, 'warning'); return; }
    setBusy(true);
    try {
      const pwSalt = makeSalt();
      const pwHash = await hashPassword(pwDraft, pwSalt);
      // pwGen 증가 = 기존 해제 토큰 전부 무효(학생 기기는 다시 한 번 입력)
      const next = patchTeamRoot(pwTarget.material.processed_json, { pwHash, pwSalt, pwGen: (pwTarget.pwGen || 0) + 1 });
      await saveClassroomMetadata(supabase,pwTarget.material,next.metadata);
      setRevealed({ key: pwTarget.key, name: pwTarget.name, password: pwDraft });
      setPwTarget(null);
      setPwDraft('');
      refresh();
    } catch (err) {
      toast('암호 변경 실패 — ' + (err?.message || '알 수 없는 오류'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ClassroomState title="수업을 불러오고 있어요."/>;
  if (!isAdmin) return <ClassroomShell><header className="classroom-header"><div><span className="classroom-eyebrow">MANABI / CLASS</span><h1>함께 배우고,<br/>나의 언어로.</h1><p>수업에서 만난 표현을 다시 읽고, 오래 기억하세요.</p></div></header><ClassroomJoin/></ClassroomShell>;
  return (
    <ClassroomShell>
      <header className="classroom-header"><div><span className="classroom-eyebrow">MANABI / CLASS</span><h1>오늘, 함께 배울 것들.</h1><p>한 표현에서 시작해 한 편의 수업 노트로.</p></div>
      <button className="classroom-button" onClick={()=>{if(!creating&&!draft.key)setDraft(d=>({...d,key:'c'+crypto.randomUUID().replaceAll('-','').slice(0,12),password:crypto.randomUUID().replaceAll('-','').slice(0,10)}));setCreating(v=>!v);}}>{creating?'닫기':'+ 새 수업'}</button></header>
      {revealed && (
        <div className="card" role="status" style={{ padding: '14px 16px', marginBottom: 14, border: '1px solid var(--primary)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{revealed.name} 공유 암호 — 지금 복사해 두세요</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.9rem' }}>
            <code style={{ fontSize: '1.05rem', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>{revealed.password}</code>
            <Button size="sm" variant="secondary" onClick={() => copyText(revealed.password, toast, '암호')}>암호 복사</Button>
            <Button size="sm" variant="secondary" onClick={() => copyText(shareLink(revealed.key), toast, '링크')}>링크 복사</Button>
            <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>닫기</Button>
          </div>
        </div>
      )}

      {creating && (
        <form className="classroom-create" onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="team-name">수업 이름</label>
              <input id="team-name" className="form-input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="예: 화요일 일본어" required maxLength={80} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="team-lang">언어</label>
              <select id="team-lang" className="form-input" value={draft.lang} onChange={(e) => setDraft((d) => ({ ...d, lang: e.target.value }))}>
                {LANG_OPTIONS.map((l) => <option key={l} value={l}>{LANG_NAME_KO[l]}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="team-book">교재 (내 책 묶음)</label>
              <select id="team-book" className="form-input" value={draft.bookKey} onChange={(e) => setDraft((d) => ({ ...d, bookKey: e.target.value }))}>
                <option value="">없음</option>
                {books.map((b) => <option key={b.key} value={b.key}>{b.title || '제목 없는 교재'} · {b.count}과</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="team-total">교재 전체 과 수 (선택)</label>
              <input id="team-total" className="form-input" type="number" min={1} value={draft.bookTotal} onChange={(e) => setDraft((d) => ({ ...d, bookTotal: e.target.value }))} placeholder="41" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="team-pw">암호 ({TEAM_PW_MIN}자 이상 · 지금만 보여요)</label>
              <input id="team-pw" className="form-input" value={draft.password} onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))} autoComplete="off" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button size="sm" variant="ghost" type="button" onClick={() => setCreating(false)}>취소</Button>
            <Button size="sm" type="submit" disabled={busy}>{busy ? '만드는 중…' : '수업 만들기'}</Button>
          </div>
        </form>
      )}

      {teamError ? <div className="classroom-notice" role="alert">수업 목록을 불러오지 못했어요. <button onClick={()=>retryTeams()}>다시 불러오기</button></div> : isLoading ? <p role="status">수업을 불러오는 중…</p> : teams.length===0 ? <div className="classroom-empty"><b>첫 수업을 열어 보세요.</b><p>이름과 언어를 정하면 바로 시작할 수 있어요. 교재는 나중에 연결해도 됩니다.</p></div> : (
        <div className="classroom-hub-list">
          {teams.map(t=>{
            const book=t.bookKey?bookByKey.get(t.bookKey):null;
            const notes=listDayNotes(teamRows,t.key);
            return <article key={t.key} className="classroom-team-card" data-language={t.lang}>
              <ClassCover team={t}/><div className="classroom-team-body"><span className="classroom-eyebrow">{LANG_NAME_KO[t.lang]}{notes[0]?` · 최근 수업 ${dayLabel(notes[0].day)}`:' · 새로운 수업'}</span><h2>{t.name}</h2><p>{book?`${book.title||'수업 교재'} · 공유된 ${book.count}과`:'교재 없이 자유롭게 표현을 나누는 수업'}<br/>{notes.length?`수업 노트 ${notes.length}편`:'첫 수업 노트를 기다리고 있어요.'}</p>
              <div className="classroom-actions"><Link href={`/class/${t.key}`} className="classroom-button">수업 열기 →</Link><button className="classroom-text-button" onClick={()=>copyText(shareLink(t.key),toast,'수업 링크')}>학생에게 링크 공유</button></div>
              <details className="classroom-team-settings"><summary>수업 설정</summary><div className="classroom-actions"><Button size="sm" variant="secondary" onClick={()=>openEdit(t)}>이름 · 교재 변경</Button><Button size="sm" variant="ghost" onClick={()=>{setPwTarget(t);setPwDraft('');}}>공유 암호 변경</Button></div>
                {pwTarget?.key === t.key && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                    <input className="form-input" style={{ flex: '1 1 160px' }} value={pwDraft} onChange={(e) => setPwDraft(e.target.value)} placeholder={`새 암호 ${TEAM_PW_MIN}자 이상`} autoComplete="off" />
                    <Button size="sm" disabled={busy} onClick={() => setPwConfirm(true)}>바꾸기</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPwTarget(null)}>취소</Button>
                  </div>
                )}
                {editing?.key === t.key && editDraft && (
                  <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">수업 이름</label>
                        <input className="form-input" value={editDraft.name} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
                      </div>
                      <div className="form-field">
                        <label className="form-label">언어</label>
                        <select className="form-input" value={editDraft.lang} onChange={(e) => setEditDraft((d) => ({ ...d, lang: e.target.value }))}>
                          {LANG_OPTIONS.map((l) => <option key={l} value={l}>{LANG_NAME_KO[l]}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">교재</label>
                        <select className="form-input" value={editDraft.bookKey} onChange={(e) => setEditDraft((d) => ({ ...d, bookKey: e.target.value }))}>
                          <option value="">없음</option>
                          {books.map((b) => <option key={b.key} value={b.key}>{b.title || '제목 없는 교재'} · {b.count}과</option>)}
                        </select>
                      </div>
                      <div className="form-field">
                        <label className="form-label">교재 총 과 수</label>
                        <input className="form-input" type="number" min={1} value={editDraft.bookTotal} onChange={(e) => setEditDraft((d) => ({ ...d, bookTotal: e.target.value }))} />
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>팀 키(<code>{t.key}</code>)는 링크 주소라 바꿀 수 없어요.</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>취소</Button>
                      <Button size="sm" type="submit" disabled={busy}>저장</Button>
                    </div>
                  </form>
                )}
              </details></div></article>;
          })}
        </div>
      )}

      <ConfirmModal
        open={pwConfirm}
        title="암호 바꾸기"
        message="암호를 바꾸면 학생들의 기기에서 해제가 풀려 다시 한 번 입력하게 돼요. 새 암호는 바꾼 직후 한 번만 보여요."
        confirmLabel="바꾸기"
        variant="primary"
        onConfirm={handlePasswordChange}
        onCancel={() => setPwConfirm(false)}
      />
    </ClassroomShell>
  );
}
