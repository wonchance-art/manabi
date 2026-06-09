'use client';

import { useState } from 'react';
import RefSpeak from './RefSpeak';

/**
 * 패턴 체크 — 챕터 끝 회상 연습.
 * 한국어 번역을 보고 원어 문장을 입으로 만들어본 뒤, 탭해서 정답 확인.
 * items: [{ ko, main, pron }]
 */
export default function RefPatternCheck({ items, lang }) {
  const [revealed, setRevealed] = useState(() => new Set());
  if (!items?.length) return null;

  function toggle(i) {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const allOpen = revealed.size === items.length;

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
      </p>
      <ol className="fr-check__list">
        {items.map((item, i) => {
          const open = revealed.has(i);
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
                    {item.main}
                    {item.pron && <span className="fr-check__pron"> {item.pron}</span>}
                  </span>
                ) : (
                  <span className="fr-check__hidden">정답 보기</span>
                )}
              </button>
              {open && <RefSpeak text={item.main} lang={lang} size="xs" />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
