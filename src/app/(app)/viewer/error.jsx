'use client';

import { useEffect } from 'react';

export default function ViewerError({ error, reset }) {
  useEffect(() => { console.error('ViewerError:', error); }, [error]);

  const isNotFound = error?.message?.includes('not found') || error?.message?.includes('찾을 수 없');
  const isNetwork = error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('Failed to fetch');
  const isAnalyzing = error?.message?.includes('analyzing') || error?.message?.includes('분석');

  const config = isNotFound
    ? { icon: '🔍', title: '자료를 찾을 수 없습니다', desc: '삭제되었거나 잘못된 링크일 수 있어요.' }
    : isNetwork
    ? { icon: '📡', title: '네트워크 연결 오류', desc: '인터넷 연결을 확인한 후 다시 시도해주세요.' }
    : isAnalyzing
    ? { icon: '⏳', title: 'AI가 아직 분석 중입니다', desc: '잠시 후 다시 시도해주세요. 분석에는 수십 초가 걸릴 수 있어요.' }
    : { icon: '📖', title: '콘텐츠를 불러올 수 없습니다', desc: error?.message || '텍스트 뷰어에서 오류가 발생했습니다.' };

  return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{config.icon}</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
        {config.title}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
        {config.desc}
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button className="btn btn--primary btn--md" onClick={reset}>다시 시도</button>
        <button className="btn btn--ghost btn--md" onClick={() => window.location.href = '/materials'}>
          자료 목록으로
        </button>
      </div>
    </div>
  );
}
