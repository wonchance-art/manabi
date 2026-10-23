'use client';

import { useEffect } from 'react';
import { reloadOnceForChunkError } from '@/lib/chunkReload';

// PDF 라우트 전용 에러 바운더리 — 원문·스택은 콘솔에만 남기고 화면에는 정해진 안내만 낸다(WALL-001).
export default function PdfError({ error, reset }) {
  useEffect(() => { console.error('PdfError:', error); reloadOnceForChunkError(error); }, [error]);

  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
        PDF를 열지 못했어요
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px' }}>
        잠시 후 다시 시도해 주세요.
      </p>
      <button className="btn btn--primary btn--md" onClick={reset}>다시 시도</button>
      {error?.digest && (
        <p style={{ marginTop: 20, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          오류 ID: {error.digest}
        </p>
      )}
    </div>
  );
}
