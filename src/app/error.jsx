'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportError } from '../lib/reportError';

export default function RouteError({ error, reset }) {
  useEffect(() => {
    reportError(error, { src: 'route-error', digest: error?.digest });
  }, [error]);

  const isNetwork = /network|fetch|timeout|load/i.test(error?.message || '');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '70vh', padding: '40px 24px',
      color: 'var(--text-primary)', textAlign: 'center',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
        {isNetwork ? '네트워크 연결을 확인해주세요' : '문제가 발생했어요'}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 420, lineHeight: 1.6 }}>
        {isNetwork
          ? '인터넷 연결이 불안정한 것 같아요. 잠시 후 다시 시도해주세요.'
          : (error?.message || '예상치 못한 오류가 발생했습니다.')}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn--primary btn--md" onClick={reset}>
          다시 시도
        </button>
        <Link href="/" className="btn btn--ghost btn--md">
          홈으로
        </Link>
      </div>
      {error?.digest && (
        <p style={{ marginTop: 20, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          오류 ID: {error.digest}
        </p>
      )}
    </div>
  );
}
