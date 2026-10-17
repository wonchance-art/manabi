'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { readCompleteLegacyRows } from '../lib/legacyReviewSync';
import { failureMessage } from '../lib/errorMessage';
import Button from './Button';

const EXPORT_KEYS = ['profile', 'vocab', 'materials', 'progress', 'notes', 'writings', 'pdfs'];

// 내보내기는 전부여야 한다 — PostgREST 기본 상한(1000행)에 조용히 잘리지 않게 정본 완전 조회(id 순 page ·
// exact count)로 읽고, 결과는 unwrapAccountExportResults가 읽는 { data } / { error } 모양으로 돌려준다.
function exportRows(table, ownerColumn, ownerId, pageSize = 1000) {
  return readCompleteLegacyRows(() => supabase.from(table).select('*', { count: 'exact' }).eq(ownerColumn, ownerId), { pageSize })
    .then(data => ({ data, error: null }), error => ({ data: null, error }));
}

export function unwrapAccountExportResults(results) {
  const failed = results
    .map((result, index) => (!result || result.error) ? EXPORT_KEYS[index] : null)
    .filter(Boolean);
  if (failed.length > 0) {
    throw new Error(`데이터를 불러오지 못했어요: ${failed.join(', ')}`);
  }
  return Object.fromEntries(EXPORT_KEYS.map((key, index) => [key, results[index]?.data ?? null]));
}

// 이메일·비밀번호로 로그인할 수 있는 계정인지 — Google로만 가입한 계정은 확인할 현재 비밀번호가 없다.
export function hasPasswordLogin(user) {
  if (Array.isArray(user?.identities) && user.identities.length > 0) {
    return user.identities.some(identity => identity?.provider === 'email');
  }
  const providers = user?.app_metadata?.providers;
  return Array.isArray(providers) ? providers.includes('email') : user?.app_metadata?.provider === 'email';
}

export default function AccountSettings({ user, toast, signOut }) {
  const passwordLogin = hasPasswordLogin(user);
  const [pwMode, setPwMode] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);
  const deleteDialogRef = useRef(null);
  const deletingRef = useRef(false);
  const deleteTitleId = useId();

  deletingRef.current = deleting;

  useEffect(() => {
    if (!deleteConfirm) return undefined;
    const previousFocus = document.activeElement;
    const dialog = deleteDialogRef.current;
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusInitial = window.setTimeout(() => dialog?.querySelector('[data-dialog-initial-focus]')?.focus(), 0);
    function onKeyDown(event) {
      if (event.key === 'Escape' && !deletingRef.current) {
        event.preventDefault();
        setDeleteConfirm(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog?.querySelectorAll(focusableSelector) || [])].filter(el => !el.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusInitial);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [deleteConfirm]);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPw.length < 8) { toast('새 비밀번호는 8자 이상이어야 해요', 'warning'); return; }
    if (newPw !== confirmPw) { toast('새 비밀번호 확인이 일치하지 않아요', 'warning'); return; }
    // 잠금 풀린 기기를 남이 만져도 비밀번호를 바꿔 계정을 가져가지 못하게, 이메일 계정은 현재 비밀번호를 반드시 확인한다.
    if (passwordLogin && !currentPw) { toast('현재 비밀번호를 입력해 주세요', 'warning'); return; }

    setSubmitting(true);
    try {
      // Supabase updateUser는 현재 비밀번호를 묻지 않는다 — 같은 계정으로 다시 로그인해 확인한다.
      if (passwordLogin) {
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
      toast(passwordLogin ? '비밀번호가 변경됐어요' : '비밀번호를 만들었어요. 이제 이메일로도 로그인할 수 있어요', 'success');
      setPwMode(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast(failureMessage(passwordLogin ? '비밀번호를 바꾸지 못했어요.' : '비밀번호를 만들지 못했어요.', err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExportMyData() {
    setExportMsg('데이터 모으는 중…');
    try {
      const exportResults = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        exportRows('user_vocabulary', 'user_id', user.id),
        // 자료 행은 본문·분석 JSON이 커서 page를 작게 나눈다.
        exportRows('reading_materials', 'owner_id', user.id, 100),
        exportRows('reading_progress', 'user_id', user.id),
        exportRows('grammar_notes', 'user_id', user.id),
        exportRows('writing_practice', 'user_id', user.id),
        exportRows('uploaded_pdfs', 'owner_id', user.id),
      ]);
      const { profile, vocab, materials, progress, notes, writings, pdfs } = unwrapAccountExportResults(exportResults);

      const bundle = {
        exported_at: new Date().toISOString(),
        user: { id: user.id, email: user.email },
        profile, vocab, materials, progress, notes, writings, pdfs,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manabi_${user.email}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(null);
      toast('내 데이터를 JSON으로 내보냈어요', 'success');
    } catch (err) {
      setExportMsg(null);
      toast(failureMessage('데이터를 내보내지 못했어요.', err), 'error');
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
      if (!res.ok) throw new Error(json.error || 'account delete failed');
      toast('계정이 삭제됐어요. 안녕히 가세요.', 'info', 4000);
      await signOut();
    } catch (err) {
      toast(failureMessage('계정을 삭제하지 못했어요.', err), 'error');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  return (
    <>
      <div className="card mypage-section" style={{ marginBottom: 16 }}>
        <h2 className="mypage-section__title" style={{ fontSize: '0.9rem', marginBottom: 10 }}>
          계정
        </h2>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          이메일: <strong style={{ color: 'var(--text-secondary)' }}>{user.email}</strong>
        </div>

        {!pwMode ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" onClick={() => setPwMode(true)}>
              {passwordLogin ? '비밀번호 변경' : '비밀번호 만들기'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleExportMyData} disabled={!!exportMsg}>
              내 데이터 내보내기
            </Button>
            <Button size="sm" variant="ghost" style={{ color: 'var(--danger)' }} onClick={() => setDeleteConfirm(true)}>
              계정 삭제
            </Button>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {passwordLogin ? (
              <input
                type="password"
                placeholder="현재 비밀번호"
                aria-label="현재 비밀번호"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                className="form-input"
                autoComplete="current-password"
                required
              />
            ) : (
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Google로 가입한 계정이에요. 비밀번호를 만들면 이메일로도 로그인할 수 있어요.
              </p>
            )}
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
                {submitting ? '저장 중…' : passwordLogin ? '변경' : '만들기'}
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
          <div style={{ fontSize: '0.78rem', color: 'var(--primary-light)', marginTop: 8 }}>
            {exportMsg}
          </div>
        )}
      </div>

      {/* 계정 삭제 확인 */}
      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => !deleting && setDeleteConfirm(false)}
          role="presentation"
        >
          <div
            ref={deleteDialogRef}
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 440 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
          >
            <h3 id={deleteTitleId} style={{ margin: '0 0 8px', color: 'var(--danger)' }}>계정 삭제</h3>
            <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 14 }}>
              이 작업은 <strong>되돌릴 수 없어요</strong>. 수집한 모든 단어, 자료, 기록이 영구 삭제돼요.
              공용(public)으로 공유한 자료는 익명 사용자로 남을 수 있어요.
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
              data-dialog-initial-focus
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
                {deleting ? '삭제 중…' : '영구 삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
