'use client';

import { useEffect } from 'react';
import { reloadOnceForChunkError } from '@/lib/chunkReload';
import { retryRouteError } from '@/lib/chunkReload'; // 조각 오류의 「다시 시도」 = 문서 새로 받기

export default function HomeError({ error, reset }) {
  useEffect(() => { console.error('HomeError:', error); reloadOnceForChunkError(error); }, [error]);

  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
        배움 화면을 불러오지 못했어요
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
        잠시 후 다시 시도해 주세요.
      </p>
      <button className="btn btn--primary btn--md" onClick={() => retryRouteError(error, reset)}>다시 시도</button>
    </div>
  );
}
