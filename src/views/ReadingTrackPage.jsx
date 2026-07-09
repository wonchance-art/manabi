'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';
import { logReviewEvents } from '../lib/reviewEvents';
import { enqueueGrammarReview } from '../lib/grammarSrs';
import {
  READING_LANG,
  readingSlug,
  loadPassedTexts,
  markReadingPassedLocal,
  markReadingPassedRemote,
  pullReadingProgress,
  buildNodes,
  nodeStates,
  computeTrackProgress,
} from '../lib/readingProgress';
import ReadingTextView, { ReadingDrillView } from './ReadingTextView';

/**
 * 독해 트랙 페이지 — "도쿄 도착"(JA N5 파일럿).
 * 글 목록(동선 순·순차 잠금·드릴 포함) → 글/드릴 뷰어 전환. 진도 헤더.
 * 기록: user_ref_progress(rt: slug) + localStorage Set + review_events + 글 단위 grammar_review.
 */
export default function ReadingTrackPage({ track }) {
  const { user } = useAuth();
  const [passedSet, setPassedSet] = useState(() => new Set());
  const [active, setActive] = useState(null); // 열려 있는 노드 id (null = 목록)

  // 로컬 로드 + 로그인 시 서버 병합(rt: 행만 — 챕터 진도 오염 0)
  useEffect(() => {
    setPassedSet(loadPassedTexts());
    if (user?.id) {
      pullReadingProgress(user.id).then((changed) => {
        if (changed) setPassedSet(loadPassedTexts());
      });
    }
  }, [user?.id]);

  const nodes = useMemo(() => (track ? buildNodes(track) : []), [track]);
  const stated = useMemo(() => nodeStates(nodes, passedSet), [nodes, passedSet]);
  const progress = useMemo(
    () => (track ? computeTrackProgress(track, passedSet) : null),
    [track, passedSet]
  );

  if (!track) {
    return (
      <div className="page-container" style={{ maxWidth: 720 }}>
        <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>트랙을 불러올 수 없어요.</p>
      </div>
    );
  }

  const activeNode = active ? stated.find((n) => n.id === active) : null;

  // 통과 시점 기록 배선 — 로컬 Set·서버 upsert·review_events·글 단위 SRS 큐
  function handlePass(node, events) {
    const next = markReadingPassedLocal(node.id);
    setPassedSet(next);
    if (user?.id) {
      markReadingPassedRemote(user.id, node.id);
      logReviewEvents(user.id, events); // lang:'ja', source:'reading' — rung 미연결(vocab 전용)
      // 글 단위 재검증: grammar_review 에 rt: slug 등록(드릴은 글 단위 SRS 대상 아님)
      if (node.kind === 'text') enqueueGrammarReview(user.id, READING_LANG, readingSlug(node.id));
    }
  }

  // ── 글/드릴 뷰어 ──
  if (activeNode) {
    if (activeNode.kind === 'text') {
      return (
        <div className="page-container" style={{ maxWidth: 720 }}>
          <ReadingTextView
            text={activeNode.ref}
            onPass={(events) => handlePass(activeNode, events)}
            onBack={() => setActive(null)}
          />
        </div>
      );
    }
    return (
      <div className="page-container" style={{ maxWidth: 720 }}>
        <ReadingDrillView
          drill={activeNode.ref}
          drillId={activeNode.id}
          onPass={(events) => handlePass(activeNode, events)}
          onBack={() => setActive(null)}
        />
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Link href="/lessons?lang=Japanese" className="chip">← 교재</Link>
        <span className="chip" style={{ background: 'var(--warning)', color: '#fff', fontWeight: 700 }}>파일럿</span>
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '6px 0 2px' }}>{track.title}</h1>
      <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
        실존 지명 여행 이야기를 쉬운 것부터 차례로 — 글을 다 읽고 문형 문항을 통과하면 다음 글이 열려요.
      </p>

      {/* 진도 헤더 */}
      {progress && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, fontSize: '0.9rem', fontWeight: 600 }}>
          글 {progress.textsPassed}/{progress.textsTotal} · 문형 {progress.patternsCovered}/{progress.patternsTotal} · 예상 잔여 ~{progress.weeksRemaining}주
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stated.map((n) => {
          const locked = n.status === 'locked';
          const passed = n.status === 'passed';
          const isDrill = n.kind === 'drill';
          const label = isDrill
            ? n.ref.title
            : `글 ${n.order} · ${n.ref.title}`;
          const mark = passed ? '✓' : locked ? '🔒' : '›';
          return (
            <li key={n.id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => setActive(n.id)}
                className="card"
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.5 : 1,
                  border: isDrill ? '1px dashed var(--border)' : undefined,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '1rem', width: 20, textAlign: 'center', color: passed ? 'var(--success, #4caf50)' : 'var(--text-muted)' }}>{mark}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span lang="ja" style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem' }}>{label}</span>
                  {isDrill ? (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>드릴 · 통과 요건</span>
                  ) : (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {n.ref.situation}{n.ref.newPatterns?.length ? ` · 신규 문형 ${n.ref.newPatterns.length}` : ''}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
