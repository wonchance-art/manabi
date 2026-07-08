'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { useTTS } from '../lib/useTTS';
import { createReviewEventBatcher } from '../lib/reviewEvents';
import { refInline, refMain, refPron, LevelDot, JaText, alignFurigana } from './refShared';

const LANG_KO = { Japanese: '일본어', English: '영어', French: '프랑스어', Chinese: '중국어' };

/**
 * 언어 레퍼런스 — 레벨별·주제별 어휘 (프랑스어·일본어·영어 공용)
 * 세로 단일 열 정렬 리스트. 단어 가리기/뜻 가리기 셀프 테스트, 발음(TTS), 단어장(FSRS) 저장.
 * 데이터는 서버 라우트에서 해당 레벨 분량만 props로 전달받는다.
 */
export default function ReferenceVocabPage({ lang, refInfo, levelMeta = [], meta, vocab, hasBunkei = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { speak, supported: ttsSupported } = useTTS();

  const [query, setQuery] = useState('');
  // 가리기: hideMode(단어/뜻 — 배타). '뜻'은 뜻+발음을 함께 가린다(단어만 보고 뜻·발음 떠올리기).
  const [hideMode, setHideMode] = useState(null);
  const [revealed, setRevealed] = useState(() => new Set());
  const anyHide = hideMode !== null;
  const [savedSet, setSavedSet] = useState(() => new Set());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 가리기 자가 채점("기억났어"/"몰랐어") — 행 단위 인출 연습 결과를 review_events에 적재.
  // rung/FSRS는 절대 건드리지 않는다(source:'dict'는 rung 계산 대상 밖) — 이벤트 적재만.
  const [gradedRows, setGradedRows] = useState(() => new Map()); // rowKey → correct(boolean)
  const batcherRef = useRef(null);
  function getBatcher() {
    if (!batcherRef.current && user?.id) {
      batcherRef.current = createReviewEventBatcher(user.id, { size: 4 });
    }
    return batcherRef.current;
  }
  // 페이지 이탈 시 잔여 이벤트 flush (탭 닫힘·백그라운드 전환 포함)
  useEffect(() => {
    function flush() { batcherRef.current?.flush(); }
    window.addEventListener('pagehide', flush);
    return () => { flush(); window.removeEventListener('pagehide', flush); };
  }, []);
  function gradeRow(rowKey, w, correct) {
    if (!user) return; // 비로그인 — 조용히 무동작
    if (gradedRows.has(rowKey)) return; // 연타 방지
    setGradedRows(prev => new Map(prev).set(rowKey, correct));
    try {
      getBatcher()?.add({
        lang,
        source: 'dict',
        item_key: refMain(w),
        correct,
        detail: { mode: hideMode, lang, level: meta?.key, qtype: 'self' },
      });
    } catch {}
  }

  // 현장 체크 — 단어장 저장과 별개로 '아는/모르는' 표시 (레벨별 localStorage)
  const checkKey = `as_vcheck_${lang}_${meta?.key || ''}`;
  const [checked, setChecked] = useState(() => new Set());
  useEffect(() => {
    try { setChecked(new Set(JSON.parse(localStorage.getItem(checkKey) || '[]'))); } catch {}
  }, [checkKey]);
  function toggleCheck(id) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(checkKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const backHref = `/lessons?lang=${lang}&view=ref`;
  const allWords = useMemo(
    () => (vocab ? vocab.themes.flatMap(t => t.words) : []),
    [vocab]
  );

  // 이미 단어장에 있는 단어 표시
  useEffect(() => {
    if (!user || allWords.length === 0) { setSavedSet(new Set()); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('user_vocabulary')
        .select('word_text')
        .eq('user_id', user.id)
        .in('word_text', allWords.map(w => refMain(w)));
      if (!cancel && data) setSavedSet(new Set(data.map(d => d.word_text)));
    })();
    return () => { cancel = true; };
  }, [user?.id, allWords]);

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

  function persistHide(mode) {
    try { localStorage.setItem('vocab_hide_prefs', JSON.stringify({ mode })); } catch {}
  }

  // 가리기 설정 유지 — 레벨 이동·재방문에도 유지
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('vocab_hide_prefs') || 'null');
      if (s?.mode === 'word' || s?.mode === 'meaning') setHideMode(s.mode);
    } catch {}
  }, []);

  function setMode(mode) {
    const next = hideMode === mode ? null : mode;
    setHideMode(next);
    persistHide(next);
    setRevealed(new Set());
    setGradedRows(new Map());
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

  async function saveWord(w) {
    if (!user) return toast?.('로그인하면 단어장에 저장할 수 있어요', 'info');
    const text = refMain(w);
    if (savedSet.has(text)) return;
    // 단어장 "덱" 라벨 — 언어·레벨 단위 (예: "중국어 · H3")
    const deck = [LANG_KO[lang] || lang, meta?.short || meta?.key].filter(Boolean).join(' · ');
    try {
      const base = {
        user_id: user.id,
        word_text: text,
        base_form: text,
        furigana: refPron(w) || '',                  // 발음 (병음/IPA/요미) — 리더와 동일 컬럼
        meaning: w.ko || '',
        pos: w.pos || '',
        language: lang,
        source_sentence: w.ex ? (refMain(w.ex) || null) : null,  // 예문(원어) — 복습 카드 맥락
        source_ref: deck || null,                    // 덱 라벨 — 출처별 집중 복습
      };
      // 어원/한자 "연결 지식" — 단어장 초록 노트. 컬럼 마이그레이션 전이면 폴백.
      const full = { ...base, etym: w.etym || null, hanja: w.hanja || null };
      let { error } = await supabase
        .from('user_vocabulary')
        .upsert(full, { onConflict: 'user_id,word_text' });
      if (error && /etym|hanja|column/i.test(error.message || '')) {
        ({ error } = await supabase
          .from('user_vocabulary')
          .upsert(base, { onConflict: 'user_id,word_text' }));
      }
      if (error) throw error;
      setSavedSet(prev => new Set([...prev, text]));
      toast?.(`"${text}" 단어장에 저장`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user.id] });
    } catch {
      toast?.('저장 실패', 'error');
    }
  }

  if (!vocab) {
    return (
      <div className="page-container" style={{ maxWidth: 760, textAlign: 'center', paddingTop: 80 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>해당 레벨의 어휘가 없어요</h1>
        <Link href={backHref} className="btn btn--ghost btn--sm">{refInfo?.name || ''} 강의 목록으로 →</Link>
      </div>
    );
  }

  const total = vocab.themes.reduce((s, t) => s + t.words.length, 0);

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <nav style={{ marginBottom: 18 }} aria-label="브레드크럼">
        <Link href={backHref} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ← {refInfo.name} 강의 목록
        </Link>
      </nav>

      {/* ── 헤더 ── */}
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LevelDot meta={meta} />
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 700 }}>{vocab.title}</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{total}단어 · 주제 {vocab.themes.length}개</p>
          </div>
        </div>
      </header>

      {/* ── 툴바: 레벨 탭 | 가리기 | 문형 사전으로 ── */}
      <div className="bk-toolbar">
        <div className="bk-toolbar__group" role="tablist" aria-label="레벨 선택">
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
                {m.short || m.key}
              </Link>
            );
          })}
        </div>
        <span className="bk-toolbar__sep" aria-hidden="true" />
        <div className="bk-toolbar__group">
          <button
            type="button"
            className={`chip ${hideMode === 'meaning' ? 'chip--active' : ''}`}
            onClick={() => setMode('meaning')}
            aria-pressed={hideMode === 'meaning'}
          >
            단어만
          </button>
          <button
            type="button"
            className={`chip ${hideMode === 'word' ? 'chip--active' : ''}`}
            onClick={() => setMode('word')}
            aria-pressed={hideMode === 'word'}
          >
            뜻만
          </button>
        </div>
        {hasBunkei && (
          <>
            <span className="bk-toolbar__sep" aria-hidden="true" />
            <Link href={`${refInfo.base}/bunkei/${meta?.key.toLowerCase()}`} className="bk-switch">
              {meta?.key} 문형 사전으로 →
            </Link>
          </>
        )}
      </div>

      {/* ── 검색 ── */}
      <div className="fr-vlist-tools">
        <input
          type="search"
          className="search-input"
          placeholder="검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="단어 검색"
        />
      </div>
      {anyHide && (
        <p className="fr-vlist-hint">
          {hideMode === 'word' ? '뜻을 보고 단어를 떠올린 뒤' : '단어를 보고 뜻·발음을 떠올린 뒤'}, 행을 탭하면 확인할 수 있어요.
        </p>
      )}

      {filteredThemes.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          검색 결과가 없어요.
        </p>
      )}

      {/* ── 주제별 세로 리스트 ── */}
      {filteredThemes.map(theme => (
        <section key={theme.name} style={{ marginBottom: 26 }}>
          <h2 className="fr-vlist-theme">
            {theme.name}
            <span className="fr-vlist-theme__count">{theme.words.length}</span>
          </h2>
          <ul className="fr-vlist">
            {theme.words.map((w, wi) => {
              const text = refMain(w);
              const pron = refPron(w);
              const link = w.etym || w.hanja;
              const linkIcon = w.hanja ? '한자' : '어원';
              const saved = savedSet.has(text);
              const rowKey = `${theme.name}:${text}:${wi}`;
              const isRevealed = revealed.has(rowKey);
              const wordHidden = hideMode === 'word' && !isRevealed;
              const meaningHidden = hideMode === 'meaning' && !isRevealed;
              const yomiHidden = hideMode === 'meaning' && !isRevealed;
              return (
                <li
                  key={rowKey}
                  className={`fr-vrow ${anyHide ? 'fr-vrow--quiz' : ''} ${yomiHidden ? 'row-hide-yomi' : ''} ${checked.has(text) ? 'is-checked' : ''}`}
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
                  {/* 현장 체크박스 */}
                  <label className="fr-vrow__check" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked.has(text)}
                      onChange={() => toggleCheck(text)}
                      aria-label={`${text} 체크`}
                    />
                  </label>

                  {/* 단어 열 — 고정 폭으로 정렬, 일본어는 한자 위 요미가나 */}
                  <div className={`fr-vrow__word ${wordHidden ? 'is-hidden' : ''}`}>
                    {refInfo.langCode === 'ja' && alignFurigana(text, pron) ? (
                      <span className="fr-vrow__main"><JaText ja={text} yomi={pron} /></span>
                    ) : (
                      <>
                        <span className="fr-vrow__main" lang={refInfo.langCode}>{text}</span>
                        {pron && pron !== text && <span className="fr-vrow__pron fr-vrow__pron--yomi">{pron}</span>}
                      </>
                    )}
                  </div>

                  {/* 뜻 열 — 학습자 이해 순서: 뜻 → 연결 지식 → 예문.
                      단어만('meaning' 가림): 뜻·예문뜻·어원만 가리고 예문 한자는 남겨 읽기 연습.
                      뜻만('word' 가림): 예문 원문(한자·발음)만 가리고 예문 뜻은 남겨 작문 연습. */}
                  <div className="fr-vrow__body">
                    <div className={`fr-vrow__ko ${meaningHidden ? 'fr-vrow__hide-extra' : ''}`}>
                      {w.pos && <span className="fr-vrow__pos">{w.pos}</span>}
                      {w.ko}
                      {lang === 'French' && w.en && <span className="fr-vrow__en"> · EN {w.en}</span>}
                    </div>
                    {link && <div className={`fr-vrow__etym ${(wordHidden || meaningHidden) ? 'fr-vrow__hide-extra' : ''}`}><strong>{linkIcon}</strong> · {refInline(link)}</div>}
                    {w.ex && (
                      <div className="bk-ex">
                        <div className="bk-ex__pair">
                          {/* 뜻만 모드('word' 가림): 예문 원문(한자·발음)만 가려 정답 노출 방지, 예문 뜻은 남겨 작문 연습 */}
                          <div className={`bk-ex__ja ${wordHidden ? 'fr-vrow__hide-extra' : ''}`}>
                            {refInfo.langCode === 'ja' ? (
                              <JaText ja={refMain(w.ex)} yomi={w.ex.yomi} />
                            ) : (
                              <>
                                <span lang={refInfo.langCode}>{refMain(w.ex)}</span>
                                {refPron(w.ex) && <span className="fr-example__ipa">{refPron(w.ex)}</span>}
                              </>
                            )}
                            {mounted && ttsSupported && (
                              <button
                                type="button"
                                className="fr-speak fr-speak--xs"
                                onClick={e => { e.stopPropagation(); speak(refMain(w.ex), lang); }}
                                aria-label="예문 발음 듣기"
                                title="예문 발음 듣기"
                              >
                                ▷
                              </button>
                            )}
                          </div>
                          <div className={`bk-ex__ko ${meaningHidden ? 'fr-vrow__hide-extra' : ''}`}>{w.ex.ko}</div>
                        </div>
                      </div>
                    )}
                    {/* 자가 채점 — 가린 걸 공개한 직후, 속으로 맞혔는지 스스로 표시 (로그인 사용자만) */}
                    {anyHide && isRevealed && user && (
                      <div className="fr-vrow__grade" onClick={e => e.stopPropagation()}>
                        {gradedRows.has(rowKey) ? (
                          <span className={`fr-vrow__grade-done ${gradedRows.get(rowKey) ? 'is-ok' : 'is-no'}`}>
                            {gradedRows.get(rowKey) ? '기억났어요 ✓' : '괜찮아요, 다음에 또 봐요'}
                          </span>
                        ) : (
                          <span className="fr-check__grade" role="group" aria-label="자가 채점">
                            <button type="button" className="fr-check__grade-btn" onClick={() => gradeRow(rowKey, w, true)}>
                              기억났어
                            </button>
                            <button type="button" className="fr-check__grade-btn" onClick={() => gradeRow(rowKey, w, false)}>
                              몰랐어
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 액션 열 */}
                  <div className="fr-vrow__actions">
                    {mounted && ttsSupported && (
                      <button
                        type="button"
                        className="fr-speak fr-speak--xs"
                        onClick={e => { e.stopPropagation(); speak(text, lang); }}
                        aria-label="발음 듣기"
                        title="발음 듣기"
                      >
                        ▷
                      </button>
                    )}
                    <button
                      type="button"
                      className={`fr-vrow__save ${saved ? 'is-saved' : ''}`}
                      onClick={e => { e.stopPropagation(); saveWord(w); }}
                      disabled={saved}
                      aria-label={saved ? '단어장에 저장됨' : '단어장에 저장'}
                      title={saved ? '저장됨' : user ? '단어장에 저장 (FSRS 복습 시작)' : '로그인 필요'}
                    >
                      {saved ? '✓' : '＋'}
                    </button>
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
