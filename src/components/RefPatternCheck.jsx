'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RefSpeak from './RefSpeak';
import { JaText } from '../views/refShared';
import { useAuth } from '../lib/AuthContext';
import { syncCheckRemote } from '../lib/refProgress';

/** 통과 기준 — 정답률 80% 이상 */
export function isPassed(result) {
  if (!result || !result.total) return false;
  if (typeof result.passed === 'boolean') return result.passed;
  return result.right >= Math.ceil(result.total * 0.8);
}

/**
 * 패턴 체크 — 챕터 끝 회상 연습이자 통과 관문.
 * 한국어 번역을 보고 원어 문장을 입으로 만들어본 뒤, 탭해서 정답 확인.
 * 확인 후 맞음/틀림 자가 채점 — 전 문항 채점 시 80% 이상이면 '통과'로 기록하고
 * 다음 챕터를 안내한다. 미통과면 재도전을 권한다.
 * items: [{ ko, main, pron }] · next: { href, title } | null
 */
export default function RefPatternCheck({ items, lang, storageKey, slug, next = null, reviewLinks = [] }) {
  const { user } = useAuth();
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
      // 전 문항 채점 완료 → 결과 저장 (통과 여부 포함)
      if (next.size === items.length && storageKey && slug) {
        const right = [...next.values()].filter(v => v === 'o').length;
        const result = {
          right,
          total: items.length,
          at: Date.now(),
          passed: right >= Math.ceil(items.length * 0.8),
        };
        try {
          const map = JSON.parse(localStorage.getItem(storageKey) || '{}');
          map[slug] = result;
          localStorage.setItem(storageKey, JSON.stringify(map));
        } catch {}
        setLastResult(result);
        // 로그인 시 서버 동기화 (실패해도 localStorage가 원본)
        if (user?.id) syncCheckRemote(user.id, lang, slug, result);
      }
      return next;
    });
  }

  function retry() {
    setMarks(new Map());
    setRevealed(new Set());
  }

  const allOpen = revealed.size === items.length;
  const done = marks.size === items.length;
  const rightCount = [...marks.values()].filter(v => v === 'o').length;
  const passNeed = Math.ceil(items.length * 0.8);
  const passedNow = done && rightCount >= passNeed;

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
        한국어를 보고 이 챕터의 패턴으로 문장을 만들어보세요. <strong>{passNeed}/{items.length} 이상</strong>이면 통과!
        {lastResult && !done && (
          <span className="fr-check__last">
            {' '}· 지난 결과 {lastResult.right}/{lastResult.total} {isPassed(lastResult) ? '✅ 통과' : '· 재도전 추천'}
          </span>
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
        <div className={`fr-check__verdict ${passedNow ? 'is-pass' : 'is-fail'}`}>
          <p className="fr-check__result">
            {passedNow ? (
              <>🎉 <strong>통과! {rightCount}/{items.length}</strong> — 이 챕터의 패턴이 손에 익었어요.</>
            ) : (
              <><strong>{rightCount}/{items.length}</strong> — 통과까지 {passNeed - rightCount}개. 틀린 패턴을 위 섹션에서 다시 본 뒤 재도전해보세요.</>
            )}
          </p>
          <div className="fr-check__verdict-actions">
            <button type="button" className="chip" onClick={retry}>🔁 다시 도전</button>
            {passedNow && next && (
              <Link href={next.href} className="fr-check__next">
                다음 챕터 · {next.title} →
              </Link>
            )}
            {passedNow && !next && (
              <span className="fr-check__last">마지막 챕터까지 끝! 🏁</span>
            )}
          </div>
          {passedNow && reviewLinks.length > 0 && (
            <div className="fr-check__review">
              <span className="fr-check__review-label">기억에 박아두기:</span>
              {reviewLinks.map(l => (
                <Link key={l.href} href={l.href} className="fr-check__review-link">{l.label}</Link>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
