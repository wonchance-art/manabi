'use client';

/**
 * 내 정보의 계정 묶음 · 맨 아래 계정 삭제 (PROFILE-REDESIGN-001 시안 A).
 *
 *   계정
 *   ┌ 로그인 방법                       이메일 ┐
 *   │ 비밀번호                        바꾸기 › │  → 시트(현재 비밀번호 확인 — AUTH-GUIDE-001 H)
 *   │ 내 데이터           JSON 파일로 내보내기 › │  → 바로 내려받기(표 7개 정본 완전 조회)
 *   └ 로그아웃                                ┘  → AuthContext 관문(AUTH-ROUTER-REFRESH-001)
 *   …
 *   계정 삭제                                     ← 맨 아래 따로. 확인창 「계정을 영구 삭제할까요?」 + 「삭제」 입력
 *
 * 이메일은 위 「나」 칸에 한 번만 둔다(예전에는 두 번 나왔다). 위험 동작은 일상 동작과 떨어뜨려 맨 아래에 둔다(설계 P10).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { readCompleteLegacyRows } from '../lib/legacyReviewSync';
import { failureMessage } from '../lib/errorMessage';
import { signInMethods } from '../lib/profileSummary';
import { isPasswordPwned } from '../lib/pwnedPassword';
import { PWNED_PASSWORD_MESSAGE } from '../lib/authErrors';
import { ProfileGroup, ProfileRow, ProfileSheet } from './profile/ProfileParts';

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
  const [exportMsg, setExportMsg] = useState(null);
  const pwAction = passwordLogin ? '바꾸기' : '만들기';

  function closePassword() {
    setPwMode(false);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPw.length < 8) { toast('새 비밀번호는 8자 이상이어야 해요', 'warning'); return; }
    if (newPw !== confirmPw) { toast('새 비밀번호 확인이 일치하지 않아요', 'warning'); return; }
    // 잠금 풀린 기기를 남이 만져도 비밀번호를 바꿔 계정을 가져가지 못하게, 이메일 계정은 현재 비밀번호를 반드시 확인한다.
    if (passwordLogin && !currentPw) { toast('현재 비밀번호를 입력해 주세요', 'warning'); return; }

    setSubmitting(true);
    try {
      // 유출 목록에 있는 새 비밀번호는 현재 비밀번호 확인 · 변경 전에 막는다(PWNED-PASSWORD-001). 입력은 그대로 둔다.
      // 확인하지 못하면(null) 막지 않는다.
      if (await isPasswordPwned(newPw) === true) { toast(PWNED_PASSWORD_MESSAGE, 'warning'); return; }
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
      toast(passwordLogin ? '비밀번호를 바꿨어요' : '비밀번호를 만들었어요. 이제 이메일로도 로그인할 수 있어요', 'success');
      closePassword();
    } catch (err) {
      toast(failureMessage(passwordLogin ? '비밀번호를 바꾸지 못했어요.' : '비밀번호를 만들지 못했어요.', err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExportMyData() {
    if (exportMsg) return;
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

  return (
    <>
      <ProfileGroup title="계정">
        <ProfileRow label="로그인 방법" value={signInMethods(user)} ariaLabel={`로그인 방법, ${signInMethods(user)}`} />
        <ProfileRow label="비밀번호" value={pwAction} dialog onClick={() => setPwMode(true)} ariaLabel={`비밀번호 ${pwAction}`} />
        <ProfileRow label="내 데이터" value={exportMsg || 'JSON 파일로 내보내기'} onClick={handleExportMyData} busy={!!exportMsg}
          ariaLabel={exportMsg ? `내 데이터, ${exportMsg}` : '내 데이터 JSON 파일로 내보내기'} />
        <ProfileRow label="로그아웃" chevron={false}
          onClick={() => signOut() /* 서버 렌더 버리기는 AuthContext 관문(AUTH-ROUTER-REFRESH-001) */} />
      </ProfileGroup>

      {pwMode && (
        <ProfileSheet title={`비밀번호 ${pwAction}`} onClose={closePassword} busy={submitting}
          lead={passwordLogin ? null : 'Google로 가입한 계정이에요. 비밀번호를 만들면 이메일로도 로그인할 수 있어요.'}
          actions={<>
            <button type="button" className="pf-pill" onClick={closePassword} disabled={submitting}>취소</button>
            <button type="submit" form="pf-password-form" className="pf-pill pf-pill--fill" disabled={submitting}>
              {submitting ? '저장 중…' : pwAction}
            </button>
          </>}>
          <form id="pf-password-form" onSubmit={handleChangePassword}>
            {/* 아이디 칸 — 비밀번호 관리자가 어느 계정의 비밀번호인지 알게(화면에는 숨김) */}
            <input type="email" name="username" autoComplete="username" value={user.email || ''} readOnly hidden />
            {passwordLogin && (
              <div className="pf-field">
                <label htmlFor="pf-current-password">현재 비밀번호</label>
                <input id="pf-current-password" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                  className="form-input" autoComplete="current-password" required />
              </div>
            )}
            <div className="pf-field">
              <label htmlFor="pf-new-password">새 비밀번호(8자 이상)</label>
              <input id="pf-new-password" type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                className="form-input" autoComplete="new-password" required minLength={8} />
            </div>
            <div className="pf-field">
              <label htmlFor="pf-confirm-password">새 비밀번호 확인</label>
              <input id="pf-confirm-password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                className="form-input" autoComplete="new-password" required />
            </div>
          </form>
        </ProfileSheet>
      )}
    </>
  );
}

/** 계정 삭제 — 화면 맨 아래 따로. 「삭제」를 입력해야 「영구 삭제」가 눌린다(약하게 하지 않는다). 삭제 뒤 같은 signOut 관문을 지난다. */
export function AccountDelete({ toast, signOut }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deleteDialogRef = useRef(null);
  const deletingRef = useRef(false);
  const deleteTitleId = useId();
  const deleteDescId = useId();
  const deleteInputId = useId();

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
      <p className="pf-delete">
        <button type="button" aria-haspopup="dialog" onClick={() => { setDeleteText(''); setDeleteConfirm(true); }}>계정 삭제</button>
      </p>

      {/* 계정 삭제 확인 */}
      {deleteConfirm && (
        <div
          className="scrim pf-scrim"
          onClick={() => !deleting && setDeleteConfirm(false)}
          role="presentation"
        >
          <div
            ref={deleteDialogRef}
            className="pf-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
            aria-describedby={deleteDescId}
          >
            <div className="pf-sheet__head">
              <h2 id={deleteTitleId} className="pf-danger-title">계정을 영구 삭제할까요?</h2>
            </div>
            <p id={deleteDescId} className="pf-sheet__lead">
              담은 단어 · 자료 · 학습 기록이 모두 지워지고 되돌릴 수 없어요. 공개로 공유한 자료는 익명으로 남을 수 있어요.
            </p>
            <div className="pf-field">
              <label htmlFor={deleteInputId}>확인을 위해 아래에 ‘삭제’를 입력해 주세요.</label>
              <input
                id={deleteInputId}
                type="text"
                value={deleteText}
                onChange={e => setDeleteText(e.target.value)}
                className="form-input"
                placeholder="삭제"
                autoComplete="off"
                autoFocus
                data-dialog-initial-focus
              />
            </div>
            <div className="pf-sheet__actions">
              <button type="button" className="pf-pill" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                취소
              </button>
              <button
                type="button"
                className="pf-pill pf-pill--danger"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteText !== '삭제'}
              >
                {deleting ? '삭제 중…' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
