'use client';

export default function OfflinePage() {
  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>인터넷 연결을 확인해 주세요</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        이 기기에 받아 둔 자료는 그대로 열 수 있어요. 연결되면 다시 시도해 주세요.
      </p>
      <button onClick={() => window.location.reload()} className="btn btn--primary btn--md">
        다시 시도
      </button>
    </div>
  );
}
