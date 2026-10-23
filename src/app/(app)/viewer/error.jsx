'use client';

import { useEffect } from 'react';
import { reloadOnceForChunkError } from '@/lib/chunkReload';
import { retryRouteError } from '@/lib/chunkReload'; // 조각 오류의 「다시 시도」 = 문서 새로 받기

export default function ViewerError({ error, reset }) {
  useEffect(() => { console.error('ViewerError:', error); reloadOnceForChunkError(error); }, [error]);

  const isNotFound = error?.message?.includes('not found') || error?.message?.includes('찾을 수 없');
  const isNetwork = error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('Failed to fetch');
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
