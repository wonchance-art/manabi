'use client';

import { useEffect } from 'react';

// 워커가 받아 둔 적 없는 화면을 끊긴 채 열면 이 화면이 그 주소에 대신 뜬다(public/sw.js navigate 규칙).
// 연결이 돌아오면 같은 주소를 다시 연다 — 브라우저 「인터넷 없음」 화면처럼 손으로 새로 고칠 필요가 없게(OFFLINE-SWEEP-001).
const OFFLINE_RETRY_LINE = '이 기기에 받아 둔 자료는 그대로 열 수 있어요. 연결되면 이 화면을 다시 열어요.';

export default function OfflinePage() {
  useEffect(() => {
    const reopen = () => window.location.reload();
    window.addEventListener('online', reopen);
    return () => window.removeEventListener('online', reopen);
  }, []);
  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      {/* 연결 안내는 위 오프라인 띠(Layout)가 이미 한다 — 같은 「인터넷 연결을 확인해 주세요」를 두 번 쓰지 않고, 여기는 이 화면의 사정을 말한다(P8). */}
      <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>이 화면은 아직 받아 두지 않았어요</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        {OFFLINE_RETRY_LINE}
      </p>
      <button onClick={() => window.location.reload()} className="btn btn--primary btn--md">
        다시 시도
      </button>
    </div>
  );
}
