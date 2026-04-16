'use client';

import { useEffect } from 'react';

// 루트 레이아웃 자체가 실패할 때만 호출됨. 반드시 <html><body>를 직접 렌더링해야 함.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: '40px 24px',
          background: '#0b0d12', color: '#e5e7eb', textAlign: 'center',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>💥</div>
          <h1 style={{ fontSize: '1.6rem', margin: '0 0 8px' }}>앱이 예상치 못한 오류로 중단됐어요</h1>
          <p style={{ color: '#9ca3af', marginBottom: 28, maxWidth: 460, lineHeight: 1.6 }}>
            문제가 반복되면 페이지를 새로고침하거나 잠시 후 다시 방문해주세요.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={reset}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
            <a
              href="/"
              style={{
                padding: '10px 20px', borderRadius: 8,
                border: '1px solid #374151', color: '#e5e7eb', textDecoration: 'none',
              }}
            >
              홈으로
            </a>
          </div>
          {error?.digest && (
            <p style={{ marginTop: 24, fontSize: '0.75rem', color: '#6b7280' }}>
              오류 ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
