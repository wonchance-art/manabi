'use client';

import { useEffect } from 'react';

export default function HomeError({ error, reset }) {
  useEffect(() => { console.error('HomeError:', error); }, [error]);

  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🏠</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
        홈 화면을 불러올 수 없습니다
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
        {error?.message || '잠시 후 다시 시도해주세요.'}
      </p>
      <button className="btn btn--primary btn--md" onClick={reset}>다시 시도</button>
    </div>
  );
}
