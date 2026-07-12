'use client';

/**
 * 챕터 편집 진입 바 — ReferenceChapterPage 하단에 항상 마운트되는 작은 클라이언트 컴포넌트.
 *
 * 일반 유저 페이로드를 늘리지 않으려고 챕터 데이터는 props로 받지 않는다(lang·slug·overridden만).
 * 무거운 에디터(ChapterEditor)는 바 클릭 시에만 dynamic import(ssr:false)로 로드해
 * 챕터 페이지 First Load JS 증가를 막는다.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '../../lib/AuthContext';

// 무거운 에디터는 지연 로드 — 바 클릭 전까지 번들에 포함되지 않는다.
const ChapterEditor = dynamic(() => import('./ChapterEditor'), { ssr: false });

export default function ChapterEditorBar({ lang, slug, overridden = false }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          padding: '10px 12px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 999,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          }}
        >
          {overridden && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--accent)',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--accent-soft, rgba(120,120,255,0.12))',
                whiteSpace: 'nowrap',
              }}
            >
              수정본 적용 중
            </span>
          )}
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setOpen(true)}
          >
            ✏️ 이 챕터 편집
          </button>
        </div>
      </div>

      {open && <ChapterEditor lang={lang} slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}
