'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/useTheme';
import { useState, useEffect } from 'react';
import OnboardingModal from './OnboardingModal';
import NotificationBell from './NotificationBell';
import TourGuide from './TourGuide';

export default function Layout({ children }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [showTour, setShowTour] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

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

  // Show tour once for onboarded users who haven't seen it
  useEffect(() => {
    if (profile?.onboarded && !localStorage.getItem('as_tour_done')) {
      setShowTour(true);
    }
  }, [profile?.onboarded]);

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

  const navLinks = [
    ...(user ? [{ href: '/home', icon: '🏠', label: '홈' }] : []),
    { href: '/guide',     icon: '📚', label: '가이드' },
    { href: '/materials', icon: '📰', label: '자료' },
    { href: '/vocab',     icon: '⭐', label: '단어장' },
    { href: '/leaderboard', icon: '🏆', label: '랭킹' },
    { href: '/forum',     icon: '💬', label: '포럼' },
  ];

  const mobileNavLinks = [
    ...(user ? [{ href: '/home', icon: '🏠', label: '홈' }] : []),
    { href: '/materials', icon: '📰', label: '자료' },
    { href: '/vocab',     icon: '⭐', label: '단어장' },
    { href: '/leaderboard', icon: '🏆', label: '랭킹' },
    ...(user ? [{ href: '/profile', icon: '👤', label: '마이' }] : [{ href: '/auth', icon: '👤', label: '로그인' }]),
  ];

  return (
    <>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <header className="gnb" role="banner">
        <Link href="/" className="gnb__logo" aria-label="Anatomy Studio 홈">
          <span className="gnb__logo-icon" aria-hidden="true">🧬</span>
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
              <span className="gnb__link-icon" aria-hidden="true">{l.icon}</span>
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
            <span className="gnb__link-icon">🛡️</span>
            <span>관리</span>
          </Link>
        )}

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>

        <div className="gnb__actions">
          {user ? (
            <div className="gnb__user-area">
              <NotificationBell />
              {profile?.streak_count > 0 && (
                <div className="gnb__streak">
                  🔥 {profile.streak_count}
                </div>
              )}
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
        <div className="offline-banner" role="alert">
          📡 인터넷 연결이 끊겼습니다. 일부 기능이 제한될 수 있어요.
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
            <span className="mobile-nav__icon" aria-hidden="true">{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      <main className="app-layout" role="main" id="main-content">
        {children}
      </main>

      {profile && profile.onboarded === false && <OnboardingModal />}
      {showTour && <TourGuide onDone={() => setShowTour(false)} />}
    </>
  );
}
