import { useState } from 'react';

export default function MaterialsPage() {
  const [tab, setTab] = useState('public');

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">📰 자료실</h1>
        <p className="page-header__subtitle">AI가 해부한 원문 텍스트를 읽고 학습하세요</p>
      </div>

      {/* Public / Private Toggle */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-full)', width: 'fit-content', marginBottom: '28px' }}>
        <button
          onClick={() => setTab('public')}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.875rem',
            fontWeight: 500,
            background: tab === 'public' ? 'var(--accent)' : 'transparent',
            color: tab === 'public' ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          🌐 Public
        </button>
        <button
          onClick={() => setTab('private')}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.875rem',
            fontWeight: 500,
            background: tab === 'private' ? 'var(--primary)' : 'transparent',
            color: tab === 'private' ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          🔒 Private
        </button>
      </div>

      {tab === 'public' ? (
        <div className="feature-grid">
          <div className="feature-card">
            <span className="feature-card__icon">📖</span>
            <h3 className="feature-card__title">커뮤니티 도서관</h3>
            <p className="feature-card__desc">
              운영자와 유저들이 큐레이션한 우수 아티클, 원서 발췌문을 열람할 수 있습니다.
            </p>
            <br />
            <span className="badge badge--coming-soon">🚧 Sprint 3</span>
          </div>
        </div>
      ) : (
        <div className="feature-grid">
          <div className="feature-card">
            <span className="feature-card__icon">📝</span>
            <h3 className="feature-card__title">나만의 자료 추가</h3>
            <p className="feature-card__desc">
              인터넷 기사나 원서 텍스트를 붙여넣으면 AI가 형태소 분석을 수행합니다.
            </p>
            <br />
            <span className="badge badge--coming-soon">🚧 Sprint 3</span>
          </div>
        </div>
      )}
    </div>
  );
}
