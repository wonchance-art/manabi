'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isPassed } from '../components/RefPatternCheck';
import { useAuth } from '../lib/AuthContext';
import { pullProgress } from '../lib/refProgress';

const LANG_FILTERS = [
  { key: 'Japanese', label: '🇯🇵 일본어' },
  { key: 'English',  label: '🇬🇧 영어' },
  { key: 'French',   label: '🇫🇷 프랑스어' },
];

/** refManifest: 서버에서 만든 레퍼런스 경량 목차 — lessons/page.jsx 참고 */
export default function LessonsPage({ refManifest = {} }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [langFilter, setLangFilter] = useState(() => {
    const u = searchParams.get('lang');
    return u === 'English' || u === 'French' ? u : 'Japanese';
  });
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || 'all');
  const [expandedGroups, setExpandedGroups] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = JSON.parse(localStorage.getItem('lessons_expanded') || '[]');
      return new Set(Array.isArray(saved) ? saved : []);
    } catch { return new Set(); }
  });
  const [refRead, setRefRead] = useState(() => ({}));
  const [refCheck, setRefCheck] = useState(() => ({}));
  const [refReadLoaded, setRefReadLoaded] = useState(false);

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem('lessons_expanded', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // 레퍼런스 챕터 읽음·패턴 체크 결과 (localStorage — RefReadMark/RefPatternCheck가 기록)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => {
      const map = {};
      const checks = {};
      for (const [name, ref] of Object.entries(refManifest)) {
        try {
          map[name] = new Set(JSON.parse(localStorage.getItem(ref.readKey) || '[]'));
        } catch {
          map[name] = new Set();
        }
        try {
          checks[name] = JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}');
        } catch {
          checks[name] = {};
        }
      }
      setRefRead(map);
      setRefCheck(checks);
    };
    load();
    setRefReadLoaded(true);
    // 로그인 시 서버 기록과 병합 — 갱신되면 재로딩 (기기 간 진도 동기화)
    if (user?.id) {
      const readKeys = Object.fromEntries(
        Object.entries(refManifest).map(([name, ref]) => [name, ref.readKey])
      );
      pullProgress(user.id, readKeys).then(changed => { if (changed) load(); });
    }
    // refManifest는 서버에서 내려오는 정적 데이터
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refLang = refManifest[langFilter];
  const levelOptions = refLang ? refLang.levels.map(l => l.label) : [];

  // 첫 방문(해당 언어에 펼친 그룹이 없을 때) — 학습 중인 레벨 자동 펼침
  const autoExpanded = useMemo(() => new Set(), []);
  useEffect(() => {
    if (!refLang || !refReadLoaded || autoExpanded.has(langFilter)) return;
    autoExpanded.add(langFilter);
    setExpandedGroups(prev => {
      if ([...prev].some(k => k.startsWith(`ref:${langFilter}:`))) return prev;
      const readSet = refRead[langFilter] || new Set();
      const target = refLang.levels.find(l => l.chapters.some(c => !readSet.has(c.slug))) || refLang.levels[0];
      if (!target) return prev;
      return new Set([...prev, `ref:${langFilter}:${target.key}`]);
    });
  }, [refLang, refRead, refReadLoaded, langFilter, autoExpanded]);

  const refGroups = useMemo(() => {
    if (!refLang) return [];
    return refLang.levels
      .filter(l => levelFilter === 'all' || l.label === levelFilter)
      .map(l => ({ meta: l, chapters: l.chapters, vocabCount: l.vocabCount, bunkeiCount: l.bunkeiCount || 0 }));
  }, [refLang, levelFilter]);

  // 이어서 학습 — ① 마지막 체크에서 미통과한 챕터(재도전) ② 첫 미학습 챕터
  const continueTarget = useMemo(() => {
    if (!refLang || !refReadLoaded) return null;
    const readSet = refRead[langFilter] || new Set();
    const checkMap = refCheck[langFilter] || {};
    let firstUnread = null;
    for (const l of refLang.levels) {
      for (const ch of l.chapters) {
        const result = checkMap[ch.slug];
        if (result && !isPassed(result)) {
          return { ...ch, levelLabel: l.label, mode: 'retry' };
        }
        if (!firstUnread && !readSet.has(ch.slug)) {
          firstUnread = { ...ch, levelLabel: l.label, mode: 'next' };
        }
      }
    }
    return firstUnread; // 전부 읽고 통과했으면 null
  }, [refLang, refReadLoaded, refRead, refCheck, langFilter]);

  return (
    <div className="page-container">
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">🎓 강의</h1>
          <p className="page-header__subtitle">학습 순서대로 배치된 문법·어휘 레퍼런스</p>
        </div>
      </div>

      {/* 언어 필터 */}
      <div className="materials-filters">
        <div className="chip-group">
          {LANG_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setLangFilter(f.key); setLevelFilter('all'); }}
              className={`chip ${langFilter === f.key ? 'chip--active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 레벨 필터 */}
        <div className="chip-group">
          <button
            onClick={() => setLevelFilter('all')}
            className={`chip ${levelFilter === 'all' ? 'chip--active' : ''}`}
          >
            전체 난이도
          </button>
          {levelOptions.map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`chip ${levelFilter === lvl ? 'chip--active' : ''}`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {refLang && (
        <div className="lessons-list">
          {/* 레퍼런스 소개 — 한국인 학습자 설계 + 콜아웃 범례 */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: 6 }}>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 8 }}>
              {refLang.blurb.split(/\*\*(.+?)\*\*/g).map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {refLang.legend.map((item, i) => (
                <span key={item}>{i > 0 && <span style={{ marginRight: 6 }}>·</span>}{item}</span>
              ))}
            </div>
          </div>

          {/* 이어서 학습 — 지금 할 챕터로 한 번에 */}
          {continueTarget && (
            <button
              type="button"
              className="lessons-continue"
              onClick={() => router.push(`${refLang.base}/grammar/${continueTarget.slug}`)}
            >
              <span className="lessons-continue__label" aria-hidden="true">
                {continueTarget.mode === 'retry' ? '🔁' : '▶'}
              </span>
              <span className="lessons-continue__body">
                <span className="lessons-continue__kicker">
                  {continueTarget.mode === 'retry' ? '재도전 — 지난 패턴 체크 미통과' : '이어서 학습'}
                </span>
                <span className="lessons-continue__title">#{continueTarget.order} {continueTarget.title}</span>
              </span>
              <span className="lessons-continue__meta">{continueTarget.levelLabel} →</span>
            </button>
          )}

          {/* 레벨별 레퍼런스 그룹 */}
          {refGroups.map(({ meta, chapters, vocabCount, bunkeiCount }) => {
            const groupKey = `ref:${langFilter}:${meta.key}`;
            const isOpen = expandedGroups.has(groupKey);
            const readSet = refRead[langFilter] || new Set();
            const checkMap = refCheck[langFilter] || {};
            const readCount = chapters.filter(c => readSet.has(c.slug)).length;
            const passedCount = chapters.filter(c => isPassed(checkMap[c.slug])).length;
            return (
              <section key={groupKey} className={`lessons-list__group ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="lessons-list__group-header"
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={isOpen}
                >
                  <span className="lessons-list__group-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  <span className="lessons-list__group-title">
                    {meta.label}
                    <span style={{ fontWeight: 500, fontSize: '0.82em', color: 'var(--text-muted)', marginLeft: 8 }}>
                      {meta.focus}
                    </span>
                  </span>
                  {/* 접힌 상태에서도 보이는 문형 사전 바로가기 */}
                  {bunkeiCount > 0 && (
                    <span
                      className="lessons-list__bunkei-chip"
                      role="link"
                      tabIndex={0}
                      title={`${meta.key} 문형 사전 — ${bunkeiCount}문형 전수`}
                      onClick={e => { e.stopPropagation(); router.push(`${refLang.base}/bunkei/${meta.key.toLowerCase()}`); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); router.push(`${refLang.base}/bunkei/${meta.key.toLowerCase()}`); } }}
                    >
                      📑 문형 사전 {bunkeiCount}
                    </span>
                  )}
                  <span className="lessons-list__group-count">
                    {passedCount === chapters.length && chapters.length > 0 ? (
                      <span className="lessons-list__group-passed">🏆 수료</span>
                    ) : (
                      <>
                        {passedCount > 0 && <span className="lessons-list__group-passed">✅{passedCount}</span>}
                        {readCount} / {chapters.length}
                      </>
                    )}
                  </span>
                </button>
                {isOpen && (
                  <ul className="lessons-list__rows">
                    {/* 레벨 도구 — 챕터(커리큘럼) 위에 사전·어휘(레퍼런스 도구) */}
                    {bunkeiCount > 0 && (
                      <li
                        className="lessons-list__row lessons-list__row--tool"
                        onClick={() => router.push(`${refLang.base}/bunkei/${meta.key.toLowerCase()}`)}
                        role="link"
                        tabIndex={0}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(`${refLang.base}/bunkei/${meta.key.toLowerCase()}`)}
                      >
                        <span className="lessons-list__status" aria-hidden="true">📑</span>
                        <span className="lessons-list__title">{meta.key} 문형 사전 — {bunkeiCount}문형 전수 (검색·뜻 가리기)</span>
                        <span className="lessons-list__meta" />
                      </li>
                    )}
                    {vocabCount > 0 && (
                      <li
                        className="lessons-list__row lessons-list__row--tool"
                        onClick={() => router.push(`${refLang.base}/vocab/${meta.key.toLowerCase()}`)}
                        role="link"
                        tabIndex={0}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(`${refLang.base}/vocab/${meta.key.toLowerCase()}`)}
                      >
                        <span className="lessons-list__status" aria-hidden="true">📖</span>
                        <span className="lessons-list__title">{meta.label} 어휘 — {vocabCount}단어 (주제별·검색)</span>
                        <span className="lessons-list__meta" />
                      </li>
                    )}
                    {chapters.map(ch => {
                      const read = readSet.has(ch.slug);
                      const passed = isPassed(checkMap[ch.slug]);
                      // 진행 3단계: ○ 미학습 → ◐ 읽음 → ✅ 통과
                      return (
                        <li
                          key={ch.slug}
                          className={`lessons-list__row lessons-list__row--${passed ? 'passed' : read ? 'done' : 'idle'}`}
                          onClick={() => router.push(`${refLang.base}/grammar/${ch.slug}`)}
                          title={ch.summary || undefined}
                          role="link"
                          tabIndex={0}
                          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(`${refLang.base}/grammar/${ch.slug}`)}
                        >
                          <span className="lessons-list__status" aria-hidden="true">{passed ? '✅' : read ? '◐' : '○'}</span>
                          <span className="lessons-list__title">#{ch.order} {ch.title}</span>
                          <span className="lessons-list__meta">
                            {ch.topic && <span className="lessons-list__topic">{ch.topic}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
