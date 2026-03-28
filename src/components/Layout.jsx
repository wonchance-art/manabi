'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/useTheme';
import OnboardingModal from './OnboardingModal';
import NotificationBell from './NotificationBell';

export default function Layout({ children }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

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
    { href: '/forum',     icon: '💬', label: '포럼' },
  ];

  return (
    <>
      <header className="gnb">
        <Link href="/" className="gnb__logo">
          <span className="gnb__logo-icon">🧬</span>
          <span>Anatomy Studio</span>
        </Link>

        <nav className="gnb__nav">
          {navLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`gnb__link ${pathname === l.href || pathname.startsWith(l.href + '/') ? 'active' : ''}`}
            >
              <span className="gnb__link-icon">{l.icon}</span>
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
        >
          {theme === 'dark' ? '☀️' : '🌙'}
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

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        {navLinks.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`mobile-nav__link ${pathname === l.href || pathname.startsWith(l.href + '/') ? 'active' : ''}`}
          >
            <span className="mobile-nav__icon">{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      <main className="app-layout">
        {children}
      </main>

      {profile && profile.onboarded === false && <OnboardingModal />}
    </>
  );
}
