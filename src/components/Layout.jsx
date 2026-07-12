'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/useTheme';
import { useState, useEffect } from 'react';
import OnboardingModal from './OnboardingModal';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/ToastContext';

// 미완성 기능 임시 숨김 — true로 바꾸면 학습·클래스 내비가 함께 복원된다.
const SHOW_UNFINISHED_NAV = false;

export default function Layout({ children }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
  // 학습 월드(/world)는 전체 로그인 유저에게 개방된 정식 기능이므로
  // SHOW_UNFINISHED_NAV 플래그와 무관하게 로그인 유저 네비에 노출한다.
  const navLinks = [
    ...(user ? [
      { href: '/home', label: '홈' },
      ...(SHOW_UNFINISHED_NAV ? [{ href: '/learn', label: '학습' }] : []),
      { href: '/world', label: '월드' },
    ] : []),
    { href: '/lessons',   label: '교재' },
    { href: '/vocab',     label: '어휘' },
    { href: '/materials', label: '자료' },
    ...(user && SHOW_UNFINISHED_NAV ? [{ href: '/cohorts', label: '클래스' }] : []),
  ];

  const mobileNavLinks = [
    ...(user ? [
      { href: '/home', label: '홈' },
      ...(SHOW_UNFINISHED_NAV ? [{ href: '/learn', label: '학습' }] : []),
      { href: '/world', label: '월드' },
    ] : []),
    { href: '/lessons',   label: '교재' },
    { href: '/vocab',     label: '어휘' },
    { href: '/materials', label: '자료' },
    ...(user ? [] : [{ href: '/auth', label: '로그인' }]),
  ];

  return (
    <>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <header className="gnb" role="banner">
        <Link href="/" className="gnb__logo" aria-label="Anatomy Studio 홈">
          <span>Anatomy Studio</span>
        </Link>

        <nav className="gnb__nav" aria-label="메인 내비게이션">
          {navLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`gnb__link ${pathname === l.href || pathname.startsWith(l.href + '/') ? 'active' : ''}`}
              aria-current={pathname === l.href ? 'page' : undefined}
            >
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>

        {isAdmin && (
          <Link
            href="/admin"
            className={`gnb__link ${pathname.startsWith('/admin') ? 'active' : ''}`}
            style={{ color: '#ff922b' }}
          >
            <span>관리</span>
          </Link>
        )}

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-pressed={theme === 'dark'}
        >
          <span aria-hidden="true">◐</span>
        </button>

        <div className="gnb__actions">
          {user ? (
            <div className="gnb__user-area">
              <button
                className="gnb__profile-btn"
                onClick={() => router.push('/profile')}
                title={profile?.display_name || user.email}
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
          인터넷 연결이 끊겼습니다. 일부 기능이 제한될 수 있어요.
        </div>
      )}

      {/* 이메일 미검증 안내 */}
      {needsEmailConfirm && (
        <div
          role="status"
          style={{
            background: 'var(--warning-bg, #fef3c7)',
            color: 'var(--warning-text, #92400e)',
            borderBottom: '1px solid var(--warning-border, #fde68a)',
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
            className={`mobile-nav__link ${pathname === l.href || pathname.startsWith(l.href + '/') ? 'active' : ''}`}
            aria-current={pathname === l.href ? 'page' : undefined}
          >
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      <main className="app-layout" role="main" id="main-content">
        {children}
      </main>

      {profile && profile.onboarded === false && <OnboardingModal />}
    </>
  );
}
