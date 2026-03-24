import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
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
          <button className="gnb__profile-btn" title="로그인">
            G
          </button>
        </div>
      </header>

      <main className="app-layout">
        <Outlet />
      </main>
    </>
  );
}
