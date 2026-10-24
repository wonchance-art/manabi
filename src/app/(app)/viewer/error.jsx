'use client';

import { useEffect } from 'react';
import { reloadOnceForChunkError } from '@/lib/chunkReload';
import { retryRouteError, isChunkLoadError } from '@/lib/chunkReload'; // 조각 오류의 「다시 시도」 = 문서 새로 받기

export default function ViewerError({ error, reset }) {
  useEffect(() => { console.error('ViewerError:', error); reloadOnceForChunkError(error); }, [error]);

  const isNotFound = error?.message?.includes('not found') || error?.message?.includes('찾을 수 없');
  // 조각(ChunkLoadError)을 못 받은 것도 연결 문제다 — 끊긴 채 지연 부품을 열면 「자료를 불러오지 못했어요」로 떠 자료가 망가진 듯 보였다(OFFLINE-SWEEP-001 P9).
  const isNetwork = isChunkLoadError(error) || error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('Failed to fetch');
  const isAnalyzing = error?.message?.includes('analyzing') || error?.message?.includes('분석');

  const config = isNotFound
    ? { icon: '', title: '자료를 찾을 수 없어요', desc: '삭제됐거나 잘못된 링크일 수 있어요.' }
    : isNetwork
    ? { icon: '', title: '인터넷 연결을 확인해 주세요', desc: '연결되면 다시 시도해 주세요.' }
    : isAnalyzing
    ? { icon: '', title: 'AI가 아직 분석하고 있어요', desc: '분석에는 수십 초가 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.' }
    : { icon: '', title: '자료를 불러오지 못했어요', desc: '잠시 후 다시 시도해 주세요.' };

  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
        {config.title}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
        {config.desc}
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button className="btn btn--primary btn--md" onClick={() => retryRouteError(error, reset)}>다시 시도</button>
        <button className="btn btn--ghost btn--md" onClick={() => window.location.href = '/materials'}>
          자료 목록으로
        </button>
      </div>
    </div>
  );
}
