'use client';

// PDF 라우트 전용 에러 바운더리 — 에러를 삼키지 않고 콘솔에만 출력
export default function PdfError({ error, reset }) {
  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--danger)', marginBottom: 8 }}>PDF 뷰어 에러</h2>
      <pre style={{
        background: 'var(--bg-secondary)', padding: 16, borderRadius: 8,
        fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        maxHeight: 300, overflow: 'auto', marginBottom: 16,
      }}>
        {error?.message}
        {'\n\n'}
        {error?.stack}
      </pre>
      <button className="btn btn--primary btn--sm" onClick={reset}>다시 시도</button>
    </div>
  );
}
