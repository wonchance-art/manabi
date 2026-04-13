'use client';

export default function OfflinePage() {
  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📡</div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>인터넷에 연결되지 않았어요</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        네트워크 연결을 확인한 후 다시 시도해주세요.
      </p>
      <button onClick={() => window.location.reload()} className="btn btn--primary btn--md">
        다시 시도
      </button>
    </div>
  );
}
