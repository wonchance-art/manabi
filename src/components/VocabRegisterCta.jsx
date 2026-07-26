'use client';

import { useState } from 'react';
import { registerLessonCards } from '../lib/learn/sandwichCards';

/** ⑤ 산출 단계 — 레슨 어휘를 단어장(카드)에 담는 명시적 버튼 */
export default function VocabRegisterCta({ lang, slug, vocabs }) {
  const [done, setDone] = useState(null);
  const count = (vocabs ?? []).length;
  if (count === 0) return null;

  const onClick = () => {
    const res = registerLessonCards(lang, slug, vocabs, {});
    setDone(res);
  };

  return (
    <div style={{ margin: '4px 0 16px' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={Boolean(done)}
        className="btn btn--sm"
        style={{ fontWeight: 600 }}
      >
        {done
          ? `단어장에 담김 ✓${done.added > 0 ? ` (새 단어 ${done.added}개)` : ' (이미 전부 있음)'}`
          : `이 레슨 단어 ${count}개 단어장에 담기`}
      </button>
    </div>
  );
}
