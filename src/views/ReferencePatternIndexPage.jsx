'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTTS } from '../lib/useTTS';
import { refInline, LevelDot, JaText } from './refShared';

/**
 * JLPT 문형 사전 — 레벨별 전수 커버 레이어 (챕터=이해, 사전=검색·암기)
 * 세로 정렬 리스트 · 검색 · 뜻 가리기 셀프테스트 · 예문 TTS · 관련 챕터 링크.
 * 데이터는 서버 라우트에서 해당 레벨 분량만 props로 전달받는다.
 */
export default function ReferencePatternIndexPage({ refInfo, levelMeta = [], meta, bunkei }) {
  const { speak, supported: ttsSupported } = useTTS();
  const [query, setQuery] = useState('');
  const [hideMeaning, setHideMeaning] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());
  const backHref = `/lessons?lang=Japanese`;

  const filteredThemes = useMemo(() => {
    if (!bunkei) return [];
    const q = query.trim().toLowerCase();
    if (!q) return bunkei.themes;
    return bunkei.themes
      .map(t => ({
        ...t,
        items: t.items.filter(i =>
          i.pattern.toLowerCase().includes(q) ||
          i.ko.toLowerCase().includes(q) ||
          (i.conn || '').toLowerCase().includes(q) ||
          (i.ex?.ja || '').includes(q)
        ),
      }))
      .filter(t => t.items.length > 0);
  }, [bunkei, query]);

  function toggleReveal(key) {
    if (!hideMeaning) return;
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!bunkei) {
    return (
      <div className="page-container" style={{ maxWidth: 760, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>해당 레벨의 문형 사전이 없어요</h1>
        <Link href={backHref} className="btn btn--ghost btn--sm">일본어 강의 목록으로 →</Link>
      </div>
    );
  }

  const total = bunkei.themes.reduce((s, t) => s + t.items.length, 0);

  return (
    <div className="page-container" style={{ maxWidth: 820 }}>
      <nav style={{ marginBottom: 18 }} aria-label="브레드크럼">
        <Link href={backHref} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ← 🇯🇵 일본어 강의 목록
        </Link>
      </nav>

      {/* ── 헤더 ── */}
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LevelDot meta={meta} />
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{bunkei.title}</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {total}문형 전수 수록 · 주제 {bunkei.themes.length}개
            </p>
          </div>
        </div>
        {bunkei.desc && (
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8 }}>
            {bunkei.desc}
          </p>
        )}
      </header>

      {/* ── 레벨 탭 ── */}
      <div className="fr-vocab-tabs" role="tablist" aria-label="레벨 선택">
        {levelMeta.map(m => {
          const active = m.key === meta?.key;
          return (
            <Link
              key={m.key}
              href={`${refInfo.base}/bunkei/${m.key.toLowerCase()}`}
              className={`fr-vocab-tab ${active ? 'is-active' : ''}`}
              style={active ? { color: m.color, background: m.bg, borderColor: m.line } : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {m.key}
            </Link>
          );
        })}
      </div>

      {/* ── 도구 모음 ── */}
      <div className="fr-vlist-tools">
        <input
          type="search"
          className="search-input"
          placeholder="🔍 문형·뜻·예문 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="문형 검색"
        />
        <div className="fr-vlist-tools__toggles">
          <button
            type="button"
            className={`chip ${hideMeaning ? 'chip--active' : ''}`}
            onClick={() => { setHideMeaning(v => !v); setRevealed(new Set()); }}
            aria-pressed={hideMeaning}
          >
            💭 뜻 가리기
          </button>
        </div>
      </div>
      {hideMeaning && (
        <p className="fr-vlist-hint">문형을 보고 뜻을 떠올린 뒤, 행을 탭하면 확인할 수 있어요.</p>
      )}

      {filteredThemes.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          검색 결과가 없어요.
        </p>
      )}

      {/* ── 주제별 문형 리스트 ── */}
      {filteredThemes.map(theme => (
        <section key={theme.name} style={{ marginBottom: 26 }}>
          <h2 className="fr-vlist-theme">
            {theme.icon && <span aria-hidden="true">{theme.icon} </span>}
            {theme.name}
            <span className="fr-vlist-theme__count">{theme.items.length}</span>
          </h2>
          <ul className="fr-vlist">
            {theme.items.map(item => {
              const isRevealed = revealed.has(item.pattern);
              const meaningHidden = hideMeaning && !isRevealed;
              return (
                <li
                  key={item.pattern}
                  className={`fr-vrow fr-vrow--wide ${hideMeaning ? 'fr-vrow--quiz' : ''}`}
                  onClick={() => toggleReveal(item.pattern)}
                >
                  {/* 문형 열 */}
                  <div className="fr-vrow__word">
                    <span className="fr-vrow__main" lang="ja">{item.pattern}</span>
                    {item.conn && <span className="fr-vrow__pron">{item.conn}</span>}
                  </div>

                  {/* 뜻·예문 열 */}
                  <div className={`fr-vrow__body ${meaningHidden ? 'is-hidden' : ''}`}>
                    <div className="fr-vrow__ko">{item.ko}</div>
                    {item.note && <div className="fr-vrow__etym">⚠️ {refInline(item.note)}</div>}
                    {item.ex && (
                      <div className="fr-vrow__ex">
                        <JaText ja={item.ex.ja} yomi={item.ex.yomi} />
                        <span className="fr-vrow__ex-ko"> — {item.ex.ko}</span>
                      </div>
                    )}
                    {item.ch && (
                      <Link
                        href={`/japanese/grammar/${item.ch}`}
                        className="fr-vrow__chlink"
                        onClick={e => e.stopPropagation()}
                      >
                        📖 자세한 설명 챕터로 →
                      </Link>
                    )}
                  </div>

                  {/* 액션 열 */}
                  <div className="fr-vrow__actions">
                    {ttsSupported && item.ex?.ja && (
                      <button
                        type="button"
                        className="fr-speak fr-speak--xs"
                        onClick={e => { e.stopPropagation(); speak(item.ex.ja, 'Japanese'); }}
                        aria-label="예문 발음 듣기"
                        title="예문 발음 듣기"
                      >
                        🔊
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
