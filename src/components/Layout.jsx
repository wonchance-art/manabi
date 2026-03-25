import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/useTheme';

export default function Layout() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  async function handleAuthClick() {
    if (user) {
      await signOut();
      navigate('/auth');
    } else {
      navigate('/auth');
    }
  }

  const displayChar = profile?.display_name?.[0]
    || user?.email?.[0]?.toUpperCase()
    || '?';

  return (
    <>
      <header className="gnb">
        <NavLink to="/" className="gnb__logo">
          <span className="gnb__logo-icon">🧬</span>
          <span>Anatomy Studio</span>
        </NavLink>

        <nav className="gnb__nav">
          <NavLink to="/guide" className={({ isActive }) => `gnb__link ${isActive ? 'active' : ''}`}>
            <span className="gnb__link-icon">📚</span>
            <span>가이드</span>
          </NavLink>
          <NavLink to="/materials" className={({ isActive }) => `gnb__link ${isActive ? 'active' : ''}`}>
            <span className="gnb__link-icon">📰</span>
            <span>자료</span>
          </NavLink>
          <NavLink to="/vocab" className={({ isActive }) => `gnb__link ${isActive ? 'active' : ''}`}>
            <span className="gnb__link-icon">⭐</span>
            <span>단어장</span>
          </NavLink>
          <NavLink to="/forum" className={({ isActive }) => `gnb__link ${isActive ? 'active' : ''}`}>
            <span className="gnb__link-icon">💬</span>
            <span>포럼</span>
          </NavLink>
        </nav>

        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `gnb__link ${isActive ? 'active' : ''}`} style={{ color: '#ff922b' }}>
            <span className="gnb__link-icon">🛡️</span>
            <span>관리</span>
          </NavLink>
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
                onClick={() => navigate('/profile')} 
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
        <NavLink to="/guide" className={({ isActive }) => `mobile-nav__link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav__icon">📚</span>
          <span>가이드</span>
        </NavLink>
        <NavLink to="/materials" className={({ isActive }) => `mobile-nav__link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav__icon">📰</span>
          <span>자료</span>
        </NavLink>
        <NavLink to="/vocab" className={({ isActive }) => `mobile-nav__link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav__icon">⭐</span>
          <span>단어장</span>
        </NavLink>
        <NavLink to="/forum" className={({ isActive }) => `mobile-nav__link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav__icon">💬</span>
          <span>포럼</span>
        </NavLink>
      </nav>

      <main className="app-layout">
        <Outlet />
      </main>
    </>
  );
}
