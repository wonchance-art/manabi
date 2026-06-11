'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { useTTS } from '../lib/useTTS';
import { refInline, LevelDot, JaText } from './refShared';

/**
 * JLPT 문형 사전 — 레벨별 전수 커버 레이어 (챕터=이해, 사전=검색·암기)
 * 세로 정렬 리스트 · 검색 · 뜻 가리기 셀프테스트 · 예문 TTS · 문형 저장(FSRS) · 관련 챕터 링크.
 * 데이터는 서버 라우트에서 해당 레벨 분량만 props로 전달받는다.
 */
export default function ReferencePatternIndexPage({ lang = 'Japanese', refInfo, levelMeta = [], meta, bunkei, hasVocab = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { speak, supported: ttsSupported } = useTTS();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ?ch=<챕터 slug> — 챕터 페이지에서 "연관 문형 모아 보기"로 진입한 경우
  const chFilter = searchParams.get('ch') || null;
  const [query, setQuery] = useState('');
  // 가리기: hideMode(문형/뜻 — 배타) + hideYomi(요미가나 — 독립 조합 가능)
  const [hideMode, setHideMode] = useState(null);
  const [hideYomi, setHideYomi] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());
  const anyHide = hideMode !== null || hideYomi;
  const [savedSet, setSavedSet] = useState(() => new Set());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const backHref = `/lessons?lang=Japanese`;

  const allItems = useMemo(
    () => (bunkei ? bunkei.themes.flatMap(t => t.items) : []),
    [bunkei]
  );

  // 이미 단어장에 저장된 문형 표시 (어휘 페이지와 같은 user_vocabulary 사용)
  useEffect(() => {
    if (!user || allItems.length === 0) { setSavedSet(new Set()); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('user_vocabulary')
        .select('word_text')
        .eq('user_id', user.id)
        .in('word_text', allItems.map(i => i.pattern));
      if (!cancel && data) setSavedSet(new Set(data.map(d => d.word_text)));
    })();
    return () => { cancel = true; };
  }, [user?.id, allItems]);

  async function savePattern(item) {
    if (!user) return toast?.('로그인하면 문형을 단어장에 저장할 수 있어요', 'info');
    if (savedSet.has(item.pattern)) return;
    try {
      const { error } = await supabase
        .from('user_vocabulary')
        .upsert({
          user_id: user.id,
          word_text: item.pattern,
          base_form: item.pattern,
          meaning: item.ko || '',
          pos: '문형',
          language: lang,
        }, { onConflict: 'user_id,word_text' });
      if (error) throw error;
      setSavedSet(prev => new Set([...prev, item.pattern]));
      toast?.(`⭐ "${item.pattern}" 단어장에 저장`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user.id] });
    } catch {
      toast?.('저장 실패', 'error');
    }
  }

  const filteredThemes = useMemo(() => {
    if (!bunkei) return [];
    const q = query.trim().toLowerCase();
    return bunkei.themes
      .map(t => ({
        ...t,
        items: t.items.filter(i =>
          (!chFilter || i.ch === chFilter) &&
          (!q ||
            i.pattern.toLowerCase().includes(q) ||
            i.ko.toLowerCase().includes(q) ||
            (i.conn || '').toLowerCase().includes(q) ||
            (i.note || '').toLowerCase().includes(q) ||
            (i.ex?.ja || '').includes(q) ||
            (i.ex2?.ja || '').includes(q))
        ),
      }))
      .filter(t => t.items.length > 0);
  }, [bunkei, query, chFilter]);

  const chFilterCount = useMemo(
    () => filteredThemes.reduce((s, t) => s + t.items.length, 0),
    [filteredThemes]
  );

  function setMode(mode) {
    setHideMode(prev => (prev === mode ? null : mode));
    setRevealed(new Set());
  }

  function toggleReveal(key) {
    if (!anyHide) return;
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

      {/* ── 툴바: 레벨 탭 | 가리기 | 어휘로 ── */}
      <div className="bk-toolbar">
        <div className="bk-toolbar__group" role="tablist" aria-label="레벨 선택">
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
        <span className="bk-toolbar__sep" aria-hidden="true" />
        <div className="bk-toolbar__group">
          <button
            type="button"
            className={`chip ${hideMode === 'word' ? 'chip--active' : ''}`}
            onClick={() => setMode('word')}
            aria-pressed={hideMode === 'word'}
          >
            문형 가리기
          </button>
          <button
            type="button"
            className={`chip ${hideMode === 'meaning' ? 'chip--active' : ''}`}
            onClick={() => setMode('meaning')}
            aria-pressed={hideMode === 'meaning'}
          >
            뜻 가리기
          </button>
          <button
            type="button"
            className={`chip ${hideYomi ? 'chip--active' : ''}`}
            onClick={() => { setHideYomi(v => !v); setRevealed(new Set()); }}
            aria-pressed={hideYomi}
          >
            요미가나 가리기
          </button>
        </div>
        {hasVocab && (
          <>
            <span className="bk-toolbar__sep" aria-hidden="true" />
            <Link href={`${refInfo.base}/vocab/${meta?.key.toLowerCase()}`} className="bk-switch">
              📖 {meta?.key} 어휘로 →
            </Link>
          </>
        )}
      </div>

      {/* ── 검색 ── */}
      <div className="fr-vlist-tools">
        <input
          type="search"
          className="search-input"
          placeholder="🔍 문형·뜻·예문 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="문형 검색"
        />
      </div>
      {anyHide && (
        <p className="fr-vlist-hint">
          {hideMode === 'word' ? '뜻을 보고 문형을 떠올린 뒤' : hideMode === 'meaning' ? '문형을 보고 뜻을 떠올린 뒤' : '한자를 보고 독음을 떠올린 뒤'}, 행을 탭하면 확인할 수 있어요.
        </p>
      )}

      {/* 챕터 연관 필터 활성 표시 */}
      {chFilter && (
        <div className="fr-chfilter">
          <span>
            🔗 챕터 연관 문형만 보는 중 ({chFilterCount}개)
            {' · '}
            <Link href={`/japanese/grammar/${chFilter}`} className="fr-chfilter__back">챕터로 돌아가기</Link>
          </span>
          <Link href={pathname} className="fr-chfilter__clear">전체 {total}문형 보기 ✕</Link>
        </div>
      )}

      {filteredThemes.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          검색 결과가 없어요.
        </p>
      )}

      {/* ── 테마 점프 내비 — 긴 목록 브라우징 보조 ── */}
      {filteredThemes.length > 1 && (
        <nav className="bk-themenav" aria-label="주제 바로가기">
          {filteredThemes.map((theme, ti) => (
            <a key={theme.name} href={`#bk-theme-${ti}`} className="bk-themenav__chip">
              {theme.icon && <span aria-hidden="true">{theme.icon} </span>}
              {theme.name}
            </a>
          ))}
        </nav>
      )}

      {/* ── 주제별 문형 리스트 ── */}
      {filteredThemes.map((theme, ti) => (
        <section key={theme.name} id={`bk-theme-${ti}`} style={{ marginBottom: 26, scrollMarginTop: 80 }}>
          <h2 className="fr-vlist-theme">
            {theme.icon && <span aria-hidden="true">{theme.icon} </span>}
            {theme.name}
            <span className="fr-vlist-theme__count">{theme.items.length}</span>
          </h2>
          <ul className="fr-vlist">
            {theme.items.map((item, idx) => {
              const rowKey = `${theme.name}:${item.pattern}:${idx}`;
              const isRevealed = revealed.has(rowKey);
              const wordHidden = hideMode === 'word' && !isRevealed;
              const meaningHidden = hideMode === 'meaning' && !isRevealed;
              const yomiHidden = hideYomi && !isRevealed;
              return (
                <li
                  key={rowKey}
                  className={`fr-vrow fr-vrow--wide ${anyHide ? 'fr-vrow--quiz' : ''} ${yomiHidden ? 'row-hide-yomi' : ''}`}
                  onClick={() => toggleReveal(rowKey)}
                  {...(anyHide && {
                    role: 'button',
                    tabIndex: 0,
                    'aria-pressed': isRevealed,
                    onKeyDown: e => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleReveal(rowKey); }
                    },
                  })}
                >
                  {/* 문형 열 — 병기 형태(・)·접속 대안(/)은 줄 구분 */}
                  <div className={`fr-vrow__word ${wordHidden ? 'is-hidden' : ''}`}>
                    <span className="fr-vrow__main bk-pattern" lang="ja">
                      {item.pattern.split('・').map((form, fi) => (
                        <span key={fi} className="bk-line">{form}</span>
                      ))}
                    </span>
                    {item.conn && (
                      <span className="fr-vrow__pron">
                        {item.conn.split(' / ').map((c, ci) => (
                          <span key={ci} className="bk-line">{c}</span>
                        ))}
                      </span>
                    )}
                  </div>

                  {/* 뜻·예문 열 */}
                  <div className={`fr-vrow__body ${meaningHidden ? 'is-hidden' : ''}`}>
                    <div className="bk-ko">{item.ko}</div>
                    {item.note && <div className="bk-note">⚠️ {refInline(item.note)}</div>}
                    {(item.ex || item.ex2) && (
                      <div className="bk-ex">
                        {[item.ex, item.ex2].filter(Boolean).map((ex, ei) => (
                          <div key={ei} className="bk-ex__pair">
                            <div className="bk-ex__ja">
                              <JaText ja={ex.ja} yomi={ex.yomi} />
                              {ttsSupported && (
                                <button
                                  type="button"
                                  className="fr-speak fr-speak--xs"
                                  onClick={e => { e.stopPropagation(); speak(ex.ja, 'Japanese'); }}
                                  aria-label="예문 발음 듣기"
                                  title="예문 발음 듣기"
                                >
                                  🔊
                                </button>
                              )}
                            </div>
                            <div className="bk-ex__ko">{ex.ko}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 우측 — 문형 저장 + 챕터 연결 칩 */}
                  <div className="fr-vrow__actions">
                    {item.ch && (
                      <Link
                        href={`/japanese/grammar/${item.ch}`}
                        className="bk-chlink"
                        title="이 문형을 자세히 다루는 챕터"
                        onClick={e => e.stopPropagation()}
                      >
                        📖 챕터
                      </Link>
                    )}
                    {mounted && (
                      <button
                        type="button"
                        className={`fr-vrow__save ${savedSet.has(item.pattern) ? 'is-saved' : ''}`}
                        onClick={e => { e.stopPropagation(); savePattern(item); }}
                        disabled={savedSet.has(item.pattern)}
                        aria-label={savedSet.has(item.pattern) ? '단어장에 저장됨' : '문형을 단어장에 저장'}
                        title={savedSet.has(item.pattern) ? '저장됨' : user ? '단어장에 저장 (FSRS 복습 시작)' : '로그인 필요'}
                      >
                        {savedSet.has(item.pattern) ? '✓' : '⭐'}
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
