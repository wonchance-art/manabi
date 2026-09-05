'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { ratingFromSignal, registerLessonCards } from '../lib/learn/sandwichCards';

const pickedKey = (lang, slug, userId) => userId ? `sandwich-selfcheck:${userId}:${lang}:${slug}` : `sandwich-selfcheck:${lang}:${slug}`;

/**
 * ④ 재노출 자가 체크. 게스트는 기존 로컬 카드 등록을 유지한다.
 * 로그인 사용자의 단어 등록은 출처를 저장하는 별도 버튼에서 처리한다.
 * 서버 렌더와의 hydration 일치를 위해 저장된 선택은 mount 후에만 반영.
 */
export default function SandwichSelfCheck({ lang, slug, options, vocabs }) {
  const { user } = useAuth();
  const [picked, setPicked] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    try {
      setPicked(localStorage.getItem(pickedKey(lang, slug, user?.id)));
    } catch { /* 게스트 저장 실패는 조용히 무시 */ }
  }, [lang, slug, user?.id]);

  const onPick = (opt) => {
    const res = user ? null : registerLessonCards(lang, slug, vocabs, { rating: ratingFromSignal(opt.fsrsSignal) });
    try {
      localStorage.setItem(pickedKey(lang, slug, user?.id), String(opt.value));
    } catch { /* no-op */ }
    setPicked(String(opt.value));
    setSummary(res);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {(options ?? []).map((opt, j) => {
          const active = picked === String(opt.value);
          return (
            <button
              key={j}
              type="button"
              onClick={() => onPick(opt)}
              aria-pressed={active}
              style={{
                flex: 1, padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4,
                border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--bg-muted)' : 'var(--bg-secondary)',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {picked && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
          {user ? '스스로 확인한 결과를 기록했어요. 단어는 복습에 담기 버튼으로 저장해 주세요.' : '선택이 복습 신호로 저장됐어요'}
          {summary ? ` · 이 레슨 단어 카드 ${summary.added > 0 ? `${summary.added}개 등록` : '등록 확인'} 완료` : ''}
        </p>
      )}
    </div>
  );
}
