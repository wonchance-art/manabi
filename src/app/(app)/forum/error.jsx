'use client';

import { useEffect } from 'react';

export default function ForumError({ error, reset }) {
  useEffect(() => { console.error('ForumError:', error); }, [error]);

  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>💬</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
        포럼을 불러올 수 없습니다
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
        {error?.message || '포럼에서 오류가 발생했습니다.'}
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button className="btn btn--primary btn--md" onClick={reset}>다시 시도</button>
        <button className="btn btn--ghost btn--md" onClick={() => window.location.href = '/home'}>
          홈으로
        </button>
      </div>
    </div>
  );
}
