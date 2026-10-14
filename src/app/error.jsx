'use client';

import { useEffect } from 'react';
import Link from 'next/link';
// (app) 레이아웃 밖이라 셸 CSS가 따라오지 않는다 — Layout과 같은 순서로 직접 불러온다.
import '@/components/books/reading-shell.css';
import '@/components/web/web-shell.css';

export default function RouteError({ error, reset }) {
  useEffect(() => {
    console.error('[route-error]', error);
  }, [error]);

  // 원문(error.message)은 화면에 내지 않는다 — 운영 서버 컴포넌트 오류는 늘 영어 안내문이고(WALL-001), 내부 사정을 드러낸다.
  // 원문은 콘솔과 오류 ID(digest)로만 남기고, 원문은 네트워크 오류 분기 판정에만 쓴다.
  const isNetwork = /network|fetch|timeout|load/i.test(error?.message || '');

  // 루트 오류 화면은 (app) 레이아웃 밖이라 v2 셸 토큰을 직접 입는다(COLOR-V2-UNIFY-001).
  return (
    <div className="manabi-app"><div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '70vh', padding: '40px 24px',
      color: 'var(--text-primary)', textAlign: 'center',
    }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
        {isNetwork ? '인터넷 연결을 확인해 주세요' : '문제가 발생했어요'}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 420, lineHeight: 1.6 }}>
        {isNetwork
          ? '연결이 불안정한 것 같아요. 잠시 후 다시 시도해 주세요.'
          : '잠시 후 다시 시도해 주세요. 문제가 계속되면 아래 오류 ID를 알려 주세요.'}
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
    </div></div>
  );
}
