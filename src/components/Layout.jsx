import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function Layout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

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
        <div className="gnb__logo">
          <span className="gnb__logo-icon">🧬</span>
          <span>Anatomy Studio</span>
        </div>

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

        <div className="gnb__actions">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.display_name || user.email}
              </span>
              <button className="gnb__profile-btn" onClick={handleAuthClick} title="로그아웃">
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

      <main className="app-layout">
        <Outlet />
      </main>
    </>
  );
}
