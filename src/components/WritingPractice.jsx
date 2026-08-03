'use client';

import { useState } from 'react';
import RefSpeak from './RefSpeak';

/**
 * 써 보기(산출 연습 v2) — 챕터 문형으로 짧은 작문 → 모범답 대조 → 자기 점검.
 * 채점 엔진 없이 가능한 산출 루프: 먼저 쓰게 하고, 모범답은 그 다음에 연다.
 * 작성글은 기기(localStorage)에만 저장된다.
 */
const HTML_LANG = { french: 'fr', chinese: 'zh', japanese: 'ja', english: 'en' };

export default function WritingPractice({ lang, slug, writing }) {
  const storageKey = `${lang}_writing_${slug}`;
  const htmlLang = HTML_LANG[lang] ?? 'fr';
  const countsChars = htmlLang === 'zh' || htmlLang === 'ja';
  const [draft, setDraft] = useState(() => {
    try {
      return globalThis.localStorage?.getItem(storageKey) ?? '';
    } catch {
      return '';
    }
  });
  const [showSamples, setShowSamples] = useState(false);
  const checksKey = `${storageKey}_checks`;
  const [checks, setChecks] = useState(() => {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(checksKey) ?? 'null');
      if (Array.isArray(saved) && saved.length === writing.checklist.length) return saved;
    } catch {}
    return writing.checklist.map(() => false);
  });

  const save = (value) => {
    setDraft(value);
    try {
      globalThis.localStorage?.setItem(storageKey, value);
    } catch {}
  };
  const doneCount = checks.filter(Boolean).length;
  const wordCount = countsChars
    ? draft.replace(/\s/g, '').length
    : draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <section className="card fr-section">
      <h2 className="fr-section__heading">써 보기 — 배운 문형으로 직접</h2>
      <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px' }}>{writing.prompt}</p>
      {Array.isArray(writing.hints) && writing.hints.length > 0 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
          힌트: {writing.hints.join(' · ')}
        </p>
      )}
      <textarea
        value={draft}
        onChange={(e) => save(e.target.value)}
        rows={3}
        lang={htmlLang}
        placeholder="여기에 직접 써 보세요 — 이 기기에만 저장돼요."
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.6, resize: 'vertical' }}
      />
      <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'right' }}>단어 수: {wordCount}</p>
      <div style={{ marginTop: 4 }}>
        {!showSamples ? (
          <button type="button" className="btn btn--sm" onClick={() => setShowSamples(true)}>
            다 썼어요 — 모범답 보기
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {writing.samples.map((smp) => (
              <div key={smp.fr ?? smp.zh} style={{ padding: '8px 11px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }} lang={htmlLang}>
                  {smp.fr ?? smp.zh} <RefSpeak text={smp.fr ?? smp.zh} lang={lang} />
                </p>
                {smp.pinyin && (
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{smp.pinyin}</p>
                )}
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {smp.ko}
                  {smp.note && <span> · {smp.note}</span>}
                </p>
              </div>
            ))}
            <div>
              <p style={{ margin: '4px 0 4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>내 문장과 비교하며 점검해 보세요:</p>
              {writing.checklist.map((item, i) => (
                <label key={item} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={checks[i]} onChange={() => setChecks((c) => {
                    const next = c.map((v, j) => (j === i ? !v : v));
                    try { globalThis.localStorage?.setItem(checksKey, JSON.stringify(next)); } catch {}
                    return next;
                  })} />
                  <span>{item}</span>
                </label>
              ))}
              {doneCount === checks.length && (
                <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>점검 완료. 고친 문장으로 한 번 더 써 보면 완전히 내 것이 돼요.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
