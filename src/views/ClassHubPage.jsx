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
import { hashPassword, makeSalt, validatePassword } from '../lib/classPassword';

const LANG_OPTIONS = ['Japanese', 'Chinese', 'English', 'French'];

async function fetchTeamRows(userId) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('id, title, owner_id, created_at, processed_json')
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

  const { data: teamRows = [], isLoading } = useQuery({
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
    const key = draft.key.trim().toLowerCase();
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
      const { error } = await supabase.from('reading_materials').insert(row);
      if (error) throw error;
      setRevealed({ key, name: row.processed_json.metadata.team.name, password: draft.password });
      setDraft({ key: '', name: '', lang: 'Japanese', bookKey: '', bookTotal: '', password: '' });
      setCreating(false);
      refresh();
    } catch (err) {
      toast('팀 만들기 실패 — ' + (err?.message || '알 수 없는 오류'), 'error');
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
      const { error } = await supabase.from('reading_materials')
        .update({ processed_json: next, title: `[${next.metadata.team.name}] 팀 설정` })
        .eq('id', editing.id);
      if (error) throw error;
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
      const { error } = await supabase.from('reading_materials').update({ processed_json: next }).eq('id', pwTarget.id);
      if (error) throw error;
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

  if (loading) return null;
  if (!user || !isAdmin) {
    return (
      <div className="page-container" style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>🏫 수업 자료</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          수업 팀 페이지는 선생님께 받은 링크로 들어가요.
        </p>
        {!user && <Link href="/auth?from=%2Fclass" className="btn btn--secondary btn--md">로그인 →</Link>}
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">🏫 수업 팀</h1>
          <p className="page-header__subtitle">팀마다 교재·암호·오늘의 수업 판. 학생은 링크 + 암호로 들어와요.</p>
        </div>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>{creating ? '닫기' : '+ 새 팀'}</Button>
      </div>

      {revealed && (
        <div className="card" role="status" style={{ padding: '14px 16px', marginBottom: 14, border: '1px solid var(--primary)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔑 {revealed.name} 암호는 지금만 보여요 — 카톡에 붙여 두세요</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.9rem' }}>
            <code style={{ fontSize: '1.05rem', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>{revealed.password}</code>
            <Button size="sm" variant="secondary" onClick={() => copyText(revealed.password, toast, '암호')}>암호 복사</Button>
            <Button size="sm" variant="secondary" onClick={() => copyText(shareLink(revealed.key), toast, '링크')}>링크 복사</Button>
            <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>닫기</Button>
          </div>
        </div>
      )}

      {creating && (
        <form className="card" onSubmit={handleCreate} style={{ padding: '16px 18px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="team-key">팀 키 (링크 주소)</label>
              <input id="team-key" className="form-input" value={draft.key} onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))} placeholder="a" autoComplete="off" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="team-name">팀 이름</label>
              <input id="team-name" className="form-input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="A팀" />
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
              <label className="form-label" htmlFor="team-total">교재 총 과 수 (선택 · 「41과 중 12과까지」 표시용)</label>
              <input id="team-total" className="form-input" type="number" min={1} value={draft.bookTotal} onChange={(e) => setDraft((d) => ({ ...d, bookTotal: e.target.value }))} placeholder="41" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="team-pw">암호 ({TEAM_PW_MIN}자 이상 · 지금만 보여요)</label>
              <input id="team-pw" className="form-input" value={draft.password} onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))} autoComplete="off" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button size="sm" variant="ghost" type="button" onClick={() => setCreating(false)}>취소</Button>
            <Button size="sm" type="submit" disabled={busy}>{busy ? '만드는 중…' : '팀 만들기'}</Button>
          </div>
        </form>
      )}

      {isLoading ? null : teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🏫</div>
          <p>아직 팀이 없어요 — [+ 새 팀]으로 첫 팀을 만들어요.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {teams.map((t) => {
            const book = t.bookKey ? bookByKey.get(t.bookKey) : null;
            const notes = listDayNotes(teamRows, t.key);
            return (
              <div key={t.key} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.05rem' }}>{t.name}</strong>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {LANG_NAME_KO[t.lang] || t.lang} · {book ? `《${book.title || '제목 없는 교재'}》 ${book.lastOrder}과${t.bookTotal ? ` / ${t.bookTotal}과` : ''}` : '교재 없음'}
                    {' '}· 정리 {notes.length}일치{notes[0] ? ` (최근 ${dayLabel(notes[0].day)})` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <Link href={`/class/${t.key}/live`} className="btn btn--primary btn--sm">📱 입력판</Link>
                  <Link href={`/class/${t.key}/board`} className="btn btn--secondary btn--sm">🖥 태블릿 판</Link>
                  <Link href={`/class/${t.key}`} className="btn btn--secondary btn--sm">🏫 팀 페이지</Link>
                  <Button size="sm" variant="ghost" onClick={() => copyText(shareLink(t.key), toast, '링크')}>🔗 링크 복사</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPwTarget(t); setPwDraft(''); }}>🔑 암호 바꾸기</Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>⚙ 설정</Button>
                </div>
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
                        <label className="form-label">팀 이름</label>
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
              </div>
            );
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
    </div>
  );
}
