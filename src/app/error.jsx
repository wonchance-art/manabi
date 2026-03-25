'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '40px 24px',
      background: 'var(--bg-primary)', color: 'var(--text-primary)', textAlign: 'center',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>⚠️</div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>오류가 발생했습니다</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '400px' }}>
        {error?.message || '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
      </p>
      <button className="btn btn--primary btn--md" onClick={reset}>
        다시 시도
      </button>
    </div>
  );
}
