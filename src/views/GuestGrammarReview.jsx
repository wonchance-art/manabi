'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GrammarReviewSession from './GrammarReviewSession';
import { loadGuestDrillQueue } from '../lib/drillSrs';

/**
 * 비로그인 복습 — 기기(localStorage) 큐로 세션을 돌린다.
 *
 * 이전에는 게스트에게 "복습 대기 N개"라고 해놓고 빈 화면을 보여 줬다(#884에서 문구는 고쳤다).
 * 여기서는 그 큐를 실제로 풀 수 있게 한다. 문항 조립은 서버에 맡긴다 — 드릴을 찾으려면
 * 언어별 전 챕터 레지스트리가 필요한데, 그걸 클라이언트로 내리면 콘텐츠 번들을 통째로 받게 된다.
 *
 * 저장은 이 기기에만 남는다. 그 사실과 로그인 이점은 세션 위에 한 줄로 알린다.
 */
export default function GuestGrammarReview() {
  const [state, setState] = useState({ phase: 'loading', items: [] });

  useEffect(() => {
    let alive = true;
    const now = new Date().toISOString();
    const due = loadGuestDrillQueue().filter((row) => row?.next_review_at && row.next_review_at <= now);
    if (due.length === 0) {
      setState({ phase: 'ready', items: [] });
      return () => { alive = false; };
    }
    fetch('/api/review/drills', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rows: due }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!alive) return;
        setState({ phase: 'ready', items: Array.isArray(data?.items) ? data.items : [] });
      })
      .catch(() => {
        if (alive) setState({ phase: 'error', items: [] });
      });
    return () => { alive = false; };
  }, []);

  if (state.phase === 'loading') {
    // 첫 렌더는 서버와 같은 모양이어야 한다 — 큐는 마운트 후에만 읽을 수 있다.
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>문법 복습</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>이 기기에 쌓인 복습을 불러오는 중…</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>문법 복습</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          복습 문항을 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <p
        role="note"
        style={{
          maxWidth: 640, margin: '0 auto', padding: '10px 14px',
          fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6,
        }}
      >
        이 기기에 쌓인 복습이에요.{' '}
        <Link href="/auth" prefetch={false} style={{ fontWeight: 600, color: 'var(--accent-text, #2d6a4f)' }}>
          로그인하면 기기 간에 이어집니다 →
        </Link>
      </p>
      <GrammarReviewSession items={state.items} />
    </>
  );
}
