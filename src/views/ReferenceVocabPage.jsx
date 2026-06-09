'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { refInline, refMain, refPron, LevelDot } from './refShared';

/**
 * 언어 레퍼런스 — 레벨별·주제별 어휘 (검색 가능, 프랑스어·일본어·영어 공용)
 * 데이터는 서버 라우트에서 해당 레벨 분량만 props로 전달받는다 (클라이언트 번들 경량화).
 */
export default function ReferenceVocabPage({ lang, refInfo, levelMeta = [], meta, vocab }) {
  const [query, setQuery] = useState('');
  const backHref = `/lessons?lang=${lang}&view=ref`;

  const filteredThemes = useMemo(() => {
    if (!vocab) return [];
    const q = query.trim().toLowerCase();
    if (!q) return vocab.themes;
    return vocab.themes
      .map(t => ({
        ...t,
        words: t.words.filter(w =>
          refMain(w).toLowerCase().includes(q) ||
          w.ko.toLowerCase().includes(q) ||
          (w.yomi || '').includes(q) ||
          (w.en || '').toLowerCase().includes(q)
        ),
      }))
      .filter(t => t.words.length > 0);
  }, [vocab, query]);

  if (!vocab) {
    return (
      <div className="page-container" style={{ maxWidth: 760, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>해당 레벨의 어휘가 없어요</h1>
        <Link href={backHref} className="btn btn--ghost btn--sm">{refInfo?.name || ''} 강의 목록으로 →</Link>
      </div>
    );
  }

  const total = vocab.themes.reduce((s, t) => s + t.words.length, 0);

  return (
    <div className="page-container" style={{ maxWidth: 820 }}>
      <nav style={{ marginBottom: 18 }} aria-label="브레드크럼">
        <Link href={backHref} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ← {refInfo.flag} {refInfo.name} 강의 목록
        </Link>
      </nav>

      {/* ── 헤더 ── */}
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <LevelDot meta={meta} />
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{vocab.title}</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{total}단어 · 주제 {vocab.themes.length}개</p>
          </div>
        </div>
        {vocab.desc && (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{vocab.desc}</p>
        )}
      </header>

      {/* ── 레벨 탭 ── */}
      <div className="fr-vocab-tabs" role="tablist" aria-label="레벨 선택">
        {levelMeta.map(m => {
          const active = m.key === meta?.key;
          return (
            <Link
              key={m.key}
              href={`${refInfo.base}/vocab/${m.key.toLowerCase()}`}
              className={`fr-vocab-tab ${active ? 'is-active' : ''}`}
              style={active ? { color: m.color, background: m.bg, borderColor: m.line } : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {m.key}
            </Link>
          );
        })}
      </div>

      {/* ── 검색 ── */}
      <input
        type="search"
        className="search-input"
        placeholder="🔍 원어·한국어로 검색"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ width: '100%', marginBottom: 20 }}
        aria-label="단어 검색"
      />

      {filteredThemes.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          검색 결과가 없어요.
        </p>
      )}

      {/* ── 주제별 단어 목록 ── */}
      {filteredThemes.map(theme => (
        <section key={theme.name} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: 10 }}>
            {theme.icon && <span aria-hidden="true">{theme.icon} </span>}
            {theme.name}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 8 }}>
              {theme.words.length}개
            </span>
          </h2>
          <div className="fr-word-list">
            {theme.words.map(w => {
              const pron = refPron(w);
              // 연결 지식 라인 — 프랑스어/영어는 etym(🌱), 일본어는 hanja(🈶)
              const link = w.etym || w.hanja;
              const linkIcon = w.hanja ? '🈶' : '🌱';
              return (
                <div key={refMain(w)} className="fr-word card">
                  <div className="fr-word__head">
                    <strong className="fr-word__fr" lang={refInfo.langCode}>{refMain(w)}</strong>
                    {pron && <span className="fr-word__ipa">{pron}</span>}
                    {w.pos && <span className="fr-word__pos">{w.pos}</span>}
                  </div>
                  <div className="fr-word__ko">
                    {w.ko}
                    {lang === 'French' && w.en && <span className="fr-word__en"> · 🇬🇧 {w.en}</span>}
                  </div>
                  {link && <div className="fr-word__etym">{linkIcon} {refInline(link)}</div>}
                  {w.ex && (
                    <div className="fr-word__ex">
                      <span lang={refInfo.langCode}>{refMain(w.ex)}</span>
                      {w.ex.yomi && <span className="fr-word__ipa"> {w.ex.yomi}</span>}
                      <span className="fr-word__ex-ko"> — {w.ex.ko}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
