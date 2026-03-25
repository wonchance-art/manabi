'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/useTheme';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {profile?.streak_count > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'rgba(255, 146, 43, 0.15)', padding: '4px 10px',
                  borderRadius: 'var(--radius-full)', color: '#ff922b',
                  fontSize: '0.85rem', fontWeight: 700
                }}>
                  🔥 {profile.streak_count}
                </div>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.display_name || user.email}
              </span>
              <button
                className="gnb__profile-btn"
                onClick={() => router.push('/profile')}
                title="마이페이지"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: 'white', border: 'none' }}
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
    </>
  );
}
