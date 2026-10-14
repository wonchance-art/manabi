'use client';

import { useEffect } from 'react';

// 루트 레이아웃 자체가 실패할 때만 호출됨. 반드시 <html><body>를 직접 렌더링해야 함.
// 스타일시트가 없을 수 있어 색은 값으로 둔다 — v2 셸과 같은 값(종이 F6F4EE·글자 252721·로즈 994A5A, COLOR-V2-UNIFY-001).
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
          background: '#f6f4ee', color: '#252721', textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '1.6rem', margin: '0 0 8px' }}>앱이 예상치 못한 오류로 중단됐어요</h1>
          <p style={{ color: '#65675f', marginBottom: 28, maxWidth: 460, lineHeight: 1.6 }}>
            문제가 반복되면 페이지를 새로고침하거나 잠시 후 다시 방문해 주세요.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={reset}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#994a5a', color: '#fff', fontWeight: 600, cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
            {/* 루트 레이아웃이 깨진 상태라 클라이언트 라우터를 믿을 수 없다 — 문서 전체를 새로 받는
                하드 내비게이션이 의도다(<Link>로 바꾸면 깨진 트리 안에서 소프트 전환을 시도한다). */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: '10px 20px', borderRadius: 8,
                border: '1px solid #d7d5cd', color: '#252721', textDecoration: 'none',
              }}
            >
              홈으로
            </a>
          </div>
          {error?.digest && (
            <p style={{ marginTop: 24, fontSize: '0.75rem', color: '#65675f' }}>
              오류 ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
