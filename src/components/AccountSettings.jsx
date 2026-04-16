'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { friendlyToastMessage } from '../lib/errorMessage';
import Button from './Button';
import ConfirmModal from './ConfirmModal';

export default function AccountSettings({ user, toast, signOut }) {
  const [pwMode, setPwMode] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPw.length < 8) { toast('새 비밀번호는 8자 이상이어야 해요', 'warning'); return; }
    if (newPw !== confirmPw) { toast('새 비밀번호 확인이 일치하지 않아요', 'warning'); return; }

    setSubmitting(true);
    try {
      // Supabase는 현재 비밀번호 재확인이 기본으론 없음 — 재로그인 없이 updateUser 가능
      // 그래도 UX 상 현재 비번 확인 (signInWithPassword 재시도)
      if (currentPw) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPw,
        });
        if (reauthErr) {
          toast('현재 비밀번호가 일치하지 않아요', 'error');
          setSubmitting(false);
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast('비밀번호가 변경됐어요', 'success');
      setPwMode(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast('변경 실패 — ' + friendlyToastMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExportMyData() {
    setExportMsg('데이터 수집 중...');
    try {
      const [
        { data: profile },
        { data: vocab },
        { data: materials },
        { data: progress },
        { data: notes },
        { data: writings },
        { data: pdfs },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('user_vocabulary').select('*').eq('user_id', user.id),
        supabase.from('reading_materials').select('*').eq('owner_id', user.id),
        supabase.from('reading_progress').select('*').eq('user_id', user.id),
        supabase.from('grammar_notes').select('*').eq('user_id', user.id),
        supabase.from('writing_practice').select('*').eq('user_id', user.id),
        supabase.from('uploaded_pdfs').select('*').eq('owner_id', user.id),
      ]);

      const bundle = {
        exported_at: new Date().toISOString(),
        user: { id: user.id, email: user.email },
        profile, vocab, materials, progress, notes, writings, pdfs,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anatomy-studio_${user.email}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(null);
      toast('내 데이터를 JSON으로 내보냈어요', 'success');
    } catch (err) {
      setExportMsg(null);
      toast('내보내기 실패 — ' + friendlyToastMessage(err), 'error');
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      // 클라이언트에서 auth.admin.deleteUser 불가 — 서버 라우트 필요
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '삭제 실패');
      toast('계정이 삭제됐어요. 안녕히 가세요 👋', 'info', 4000);
      await signOut();
    } catch (err) {
      toast('삭제 실패 — ' + friendlyToastMessage(err), 'error');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  return (
    <>
      <div className="card mypage-section" style={{ marginBottom: 16 }}>
        <h2 className="mypage-section__title" style={{ fontSize: '0.9rem', marginBottom: 10 }}>
          🔐 계정
        </h2>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          이메일: <strong style={{ color: 'var(--text-secondary)' }}>{user.email}</strong>
        </div>

        {!pwMode ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" onClick={() => setPwMode(true)}>
              🔑 비밀번호 변경
            </Button>
            <Button size="sm" variant="ghost" onClick={handleExportMyData} disabled={!!exportMsg}>
              📥 내 데이터 내보내기
            </Button>
            <Button size="sm" variant="ghost" style={{ color: 'var(--danger)' }} onClick={() => setDeleteConfirm(true)}>
              🗑️ 계정 삭제
            </Button>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="password"
              placeholder="현재 비밀번호 (확인용, 선택)"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              className="form-input"
              autoComplete="current-password"
            />
            <input
              type="password"
              placeholder="새 비밀번호 (8자 이상)"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className="form-input"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <input
              type="password"
              placeholder="새 비밀번호 확인"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              className="form-input"
              autoComplete="new-password"
              required
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? '변경 중...' : '변경'}
              </Button>
              <Button
                type="button" size="sm" variant="ghost"
                onClick={() => { setPwMode(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}
              >
                취소
              </Button>
            </div>
          </form>
        )}

        {exportMsg && (
          <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 8 }}>
            ⏳ {exportMsg}
          </div>
        )}
      </div>

      {/* 계정 삭제 확인 */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--danger)' }}>⚠️ 계정 삭제</h3>
            <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 14 }}>
              이 작업은 <strong>되돌릴 수 없습니다</strong>. 수집한 모든 단어, 자료, 기록이 영구 삭제돼요.
              공용(public)으로 공유한 자료는 익명 사용자로 남을 수 있습니다.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              계속하려면 아래에 <strong>삭제</strong>를 입력하세요:
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={e => setDeleteText(e.target.value)}
              className="form-input"
              placeholder="삭제"
              style={{ marginBottom: 14 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setDeleteConfirm(false)} disabled={deleting} style={{ flex: 1 }}>
                취소
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteText !== '삭제'}
                style={{ flex: 2, background: 'var(--danger)' }}
              >
                {deleting ? '삭제 중...' : '영구 삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
