'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/useTheme';
import { useState, useEffect, useRef } from 'react';
import OnboardingModal from './OnboardingModal';
import './books/reading-shell.css';
import './web/web-shell.css';
import { MAIN_NAV, navigationOwner, isFocusedReadingRoute } from '@/lib/webNavigation';
import './web/focused-reader.css';
import { librarySearchHref } from '@/lib/libraryReturn';
import VersionBadge from './VersionBadge';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/ToastContext';

// 미완성 기능 임시 숨김 — true로 바꾸면 학습·클래스 내비가 함께 복원된다.

function ReaderSiteMenu({ isAdmin }) {
  const ref = useRef(null);
  const pathname = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  useEffect(() => {
    const closeOutside = e => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    const closeWithKey = e => {
      if (e.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary').focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithKey);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeWithKey); };
  }, []);
  return <details ref={ref} className="reader-site-menu">
    <summary>메뉴 <span aria-hidden="true">≡</span></summary>
    <nav aria-label="읽기 화면 내비게이션" onClick={e => { if (e.target.closest('a')) ref.current.open = false; }}>
      {MAIN_NAV.map(item => <Link key={item.href} href={item.href} prefetch={item.prefetch}>{item.label}</Link>)}
      {isAdmin && <Link href="/class" prefetch={false}>수업</Link>}
      {isAdmin && <Link href="/admin" prefetch={false}>관리</Link>}
    </nav>
  </details>;
}

export default function Layout({ children }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const focusedReading = isFocusedReadingRoute(pathname);
  const isNavActive = href => navigationOwner(pathname) === href;
  const { theme, toggleTheme } = useTheme();
  const [isOffline, setIsOffline] = useState(false);
  const [resendingConfirm, setResendingConfirm] = useState(false);
  const toast = useToast();

  // 이메일 미검증 사용자 감지 (Supabase에서 confirm 필수가 꺼진 경우)
  const needsEmailConfirm = !!user && user.email && !user.email_confirmed_at && !user.confirmed_at;

  async function resendConfirmation() {
    if (!user?.email || resendingConfirm) return;
    setResendingConfirm(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw error;
      toast('인증 메일을 다시 보냈어요. 받은편지함을 확인해주세요.', 'success');
    } catch (err) {
      toast('재발송 실패 — ' + (err?.message || '잠시 후 다시 시도'), 'error');
    } finally {
      setResendingConfirm(false);
    }
  }

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    setIsOffline(!navigator.onLine);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // 미전송 복습 동기화(v2-N R2) — 앱 진입과 온라인 복귀 두 시점에.
  // 큐가 비어 있으면 IndexedDB 한 번 읽고 끝이라 상시 재실행이 싸다.
  // 화면에는 성공했을 때만 한 줄 — 오프라인 중에는 조용하다(오너 선택 '안 A').
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const sync = async () => {
      try {
        const [{ flushReviews }, { persistVocabGrade }] = await Promise.all([
          import('../lib/reviewOutbox'),
          import('../lib/fsrs'),
        ]);
        const r = await flushReviews(supabase, user.id, { persist: persistVocabGrade });
        if (!alive || r.sent === 0) return;
        toast(`복습 ${r.sent}개를 저장했어요.`, 'success');
        // 대기 수를 띄우는 화면(단어장)이 다시 세게 한다 — 폴링 대신 신호.
        window.dispatchEvent(new CustomEvent('manabi:outbox-flushed'));
      } catch { /* 큐를 못 써도 학습은 계속된다 */ }
    };
    sync();
    window.addEventListener('online', sync);
    return () => { alive = false; window.removeEventListener('online', sync); };
  }, [user?.id, toast]);

  // 팀 사본 복제(v2-AB R2) — 로그인하면 기기 사본(팀 페이지에서 받아 둔 교재·정리본)을 내 자료로
  // 복제하고, 담으려던 단어를 복제본에서 담는다. 어디서 로그인하든(가입 경로 포함) 같은 효과.
  // 사본 0·대기 0이면 IndexedDB 한 번 읽고 끝. 실패는 조용히 — 학습을 막지 않는다.
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const [{ listSharedCopies, deleteSharedCopy }, { claimSharedCopies }, { readPendingSave, clearPendingSave }] = await Promise.all([
          import('../lib/sharedStore'),
          import('../lib/sharedCopy'),
          import('../lib/classClient'),
        ]);
        const copies = await listSharedCopies();
        const pending = readPendingSave();
        if (copies.length === 0 && !pending) return;
        const r = await claimSharedCopies(supabase, user.id, { materials: copies.map((c) => c.material), pending });
        if (!alive) return;
        for (const c of copies) await deleteSharedCopy(c.id);
        if (r.saved) clearPendingSave();
        if (r.copied > 0 || r.saved) {
          toast(`팀 자료 ${r.copied}개를 내 자료로 담았어요${r.saved ? ` · 「${r.savedWord}」도 담았어요` : ''}`, 'success', 6000);
        }
        window.dispatchEvent(new CustomEvent('manabi:shared-claimed'));
      } catch { /* 복제를 못 해도 학습은 계속된다 — 다음 로그인·팀 페이지에서 다시 */ }
    })();
    return () => { alive = false; };
  }, [user?.id, toast]);

  // 복습 알림 스케줄러
  useEffect(() => {
    if (!user) return;
    const check = () => {
      const hour = localStorage.getItem('as_reminder_hour');
      if (!hour) return;
      const now = new Date();
      const currentHour = now.getHours();
      const todayKey = now.toISOString().slice(0, 10);
      const lastSent = localStorage.getItem('as_reminder_last_sent');
      if (parseInt(hour) === currentHour && lastSent !== todayKey) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('복습할 시간이에요', {
            body: '오늘의 단어를 복습하고 스트릭을 유지하세요.',
            icon: '/favicon.ico',
            tag: 'as-review-reminder',
          });
          localStorage.setItem('as_reminder_last_sent', todayKey);
        }
      }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [user]);

  async function handleAuthClick() {
    if (user) {
      await signOut();
      router.push('/auth');
    } else {
      router.push('/auth');
    }
  }

  const displayChar =
    profile?.display_name?.[0] ||
    user?.email?.[0]?.toUpperCase() ||
    '?';

  // 핵심 네비게이션만 노출 — 부가 기능(가이드·통계)은 프로필 안쪽으로
  // 학습 월드(/world)는 개발 동결(2026-07 피벗)로 내비에서 내렸다 — 라우트는 유지, 직행 URL로만.
  const navLinks = MAIN_NAV;
  const mobileNavLinks = MAIN_NAV;

  return (
    <div className={`manabi-app${focusedReading ? ' manabi-app--reading' : ''}`}>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <header className="gnb" role="banner">
        <Link href="/home" prefetch={false} className="gnb__logo" aria-label="manabi 오늘">
          <span>manabi<span className="manabi-brand-dot" aria-hidden="true" /></span>
        </Link>

        <nav className="gnb__nav" aria-label="메인 내비게이션">
          {navLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={l.prefetch}
              className={`gnb__link ${isNavActive(l.href) ? 'active' : ''}`}
              aria-current={isNavActive(l.href) ? 'page' : undefined}
            >
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>

        {/* 수업 팀 허브(v2-AB R1) — 오너(관리자)만. 학생은 팀 링크로 들어온다. */}
        {isAdmin && (
          <Link
            href="/class"
            prefetch={false}
            className={`gnb__link ${pathname.startsWith('/class') ? 'active' : ''}`}
          >
            <span>수업</span>
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            className={`gnb__link ${pathname.startsWith('/admin') ? 'active' : ''}`}
            style={{ color: 'var(--admin-accent)' }}
          >
            <span>관리</span>
          </Link>
        )}

        {/* 배포 버전 배지(v2-J) — 관리자·?v=1일 때만 DOM에 나타난다(그 밖엔 null) */}
        <VersionBadge />

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-pressed={theme === 'dark'}
        >
          <span aria-hidden="true">◐</span>
        </button>

        {focusedReading && <ReaderSiteMenu isAdmin={isAdmin} />}
        <Link href={librarySearchHref(user)} prefetch={false} className="manabi-search-link" aria-label="자료 검색">⌕<span>검색</span></Link>
        <div className="gnb__actions">
          {user ? (
            <div className="gnb__user-area">
              <button
                className="gnb__profile-btn"
                onClick={() => router.push('/profile')}
                title={profile?.display_name || user.email}
                aria-label="내 계정"
              >
                {displayChar}
              </button>
            </div>
          ) : (
            <button
              className="gnb__profile-btn"
              onClick={handleAuthClick}
              title="로그인"
              style={{ background: 'var(--bg-elevated)', fontSize: '0.75rem' }}
            >
              로그인
            </button>
          )}
        </div>
      </header>

      {/* 오프라인 배너 */}
      {isOffline && (
        <div className="offline-banner" role="alert" aria-live="assertive">
          인터넷 연결이 끊겼습니다. 저장해 둔 자료·단어장은 그대로 볼 수 있어요.
        </div>
      )}

      {/* 이메일 미검증 안내 */}
      {needsEmailConfirm && (
        <div
          role="status"
          style={{
            background: 'var(--notice-bg)',
            color: 'var(--notice-text)',
            borderBottom: '1px solid var(--notice-border)',
            padding: '10px 16px',
            fontSize: '0.85rem',
            textAlign: 'center',
          }}
        >
          이메일 인증이 필요해요 — <strong>{user.email}</strong> 받은편지함을 확인해주세요.{' '}
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={resendingConfirm}
            style={{
              background: 'transparent', border: 'none',
              color: 'inherit', textDecoration: 'underline',
              cursor: resendingConfirm ? 'default' : 'pointer',
              fontWeight: 600, marginLeft: 4,
            }}
          >
            {resendingConfirm ? '발송 중...' : '인증 메일 다시 보내기'}
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav" aria-label="모바일 내비게이션">
        {mobileNavLinks.map(l => (
          <Link
            key={l.href}
            href={l.href}
            prefetch={l.prefetch}
            className={`mobile-nav__link ${isNavActive(l.href) ? 'active' : ''}`}
            aria-current={isNavActive(l.href) ? 'page' : undefined}
          >
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      <main className="app-layout" role="main" id="main-content" tabIndex={-1}>
        {children}
      </main>

      {profile && profile.onboarded === false && <OnboardingModal />}
    </div>
  );
}
