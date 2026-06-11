'use client';

import { useEffect, useState } from 'react';
import RefSpeak from './RefSpeak';
import { JaText } from '../views/refShared';

/**
 * 패턴 체크 — 챕터 끝 회상 연습.
 * 한국어 번역을 보고 원어 문장을 입으로 만들어본 뒤, 탭해서 정답 확인.
 * 확인 후 맞음/틀림 자가 채점 — 전 문항 채점 시 결과를 localStorage에 기록해
 * 다음 방문 때 지난 결과를 보여준다 (다시 볼 챕터 판단용).
 * items: [{ ko, main, pron }]
 */
export default function RefPatternCheck({ items, lang, storageKey, slug }) {
  const [revealed, setRevealed] = useState(() => new Set());
  const [marks, setMarks] = useState(() => new Map()); // index → 'o' | 'x'
  const [lastResult, setLastResult] = useState(null);

  // 지난 결과 불러오기
  useEffect(() => {
    if (!storageKey || !slug) return;
    try {
      const map = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (map[slug]) setLastResult(map[slug]);
    } catch {}
  }, [storageKey, slug]);

  if (!items?.length) return null;

  function toggle(i) {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function mark(i, val) {
    setMarks(prev => {
      const next = new Map(prev);
      next.set(i, val);
      // 전 문항 채점 완료 → 결과 저장
      if (next.size === items.length && storageKey && slug) {
        const right = [...next.values()].filter(v => v === 'o').length;
        try {
          const map = JSON.parse(localStorage.getItem(storageKey) || '{}');
          map[slug] = { right, total: items.length, at: Date.now() };
          localStorage.setItem(storageKey, JSON.stringify(map));
        } catch {}
      }
      return next;
    });
  }

  const allOpen = revealed.size === items.length;
  const done = marks.size === items.length;
  const rightCount = [...marks.values()].filter(v => v === 'o').length;

  return (
    <section className="card fr-section fr-check">
      <h2 className="fr-section__heading">
        <span aria-hidden="true">✍️</span> 패턴 체크
        <button
          type="button"
          className="fr-check__toggle-all"
          onClick={() => setRevealed(allOpen ? new Set() : new Set(items.map((_, i) => i)))}
        >
          {allOpen ? '모두 가리기' : '모두 보기'}
        </button>
      </h2>
      <p className="fr-check__lead">
        한국어를 보고 이 챕터의 패턴으로 문장을 만들어보세요. 떠올린 뒤 탭해서 확인!
        {lastResult && !done && (
          <span className="fr-check__last"> · 지난 결과 {lastResult.right}/{lastResult.total}</span>
        )}
      </p>
      <ol className="fr-check__list">
        {items.map((item, i) => {
          const open = revealed.has(i);
          const m = marks.get(i);
          return (
            <li key={i} className="fr-check__item">
              <span className="fr-check__ko">{item.ko}</span>
              <button
                type="button"
                className={`fr-check__answer ${open ? 'is-open' : ''}`}
                onClick={() => toggle(i)}
                aria-expanded={open}
              >
                {open ? (
                  <span className="fr-check__main" lang={item.langCode}>
                    {item.langCode === 'ja' ? (
                      <JaText ja={item.main} yomi={item.pron} />
                    ) : (
                      <>
                        {item.main}
                        {item.pron && <span className="fr-check__pron"> {item.pron}</span>}
                      </>
                    )}
                  </span>
                ) : (
                  <span className="fr-check__hidden">정답 보기</span>
                )}
              </button>
              {open && <RefSpeak text={item.main} lang={lang} size="xs" />}
              {open && (
                <span className="fr-check__grade" role="group" aria-label="자가 채점">
                  <button
                    type="button"
                    className={`fr-check__grade-btn ${m === 'o' ? 'is-on--o' : ''}`}
                    onClick={() => mark(i, 'o')}
                    aria-pressed={m === 'o'}
                  >
                    맞음
                  </button>
                  <button
                    type="button"
                    className={`fr-check__grade-btn ${m === 'x' ? 'is-on--x' : ''}`}
                    onClick={() => mark(i, 'x')}
                    aria-pressed={m === 'x'}
                  >
                    틀림
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {done && (
        <p className="fr-check__result">
          이번 결과 <strong>{rightCount}/{items.length}</strong>
          {rightCount < items.length ? ' — 틀린 패턴은 위 섹션에서 한 번 더 확인해보세요.' : ' — 완벽해요! 🎉'}
        </p>
      )}
    </section>
  );
}
