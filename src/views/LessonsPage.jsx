'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isPassed } from '../components/RefPatternCheck';
import { useAuth } from '../lib/AuthContext';
import { pullProgress } from '../lib/refProgress';

const LANG_FILTERS = [
  { key: 'English',  label: '영어' },
  { key: 'French',   label: '프랑스어' },
  { key: 'Japanese', label: '일본어' },
  { key: 'Chinese',  label: '중국어' },
];

const VALID_LANGS = new Set(LANG_FILTERS.map(f => f.key));

/** refManifest: 서버에서 만든 레퍼런스 경량 목차 — lessons/page.jsx 참고 */
export default function LessonsPage({ refManifest = {} }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [langFilter, setLangFilter] = useState(() => {
    const u = searchParams.get('lang');
    if (u && VALID_LANGS.has(u)) return u;
    // URL에 없으면 마지막 선택 언어 유지 (챕터 페이지 진입 시에도 갱신됨)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lessons_lang');
      if (saved && VALID_LANGS.has(saved)) return saved;
    }
    return 'English';
  });
  // 마지막으로 본 챕터 — 복귀 시 자동 스크롤 대상
  const [lastChapter] = useState(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem('ref_last_chapter') || 'null'); } catch { return null; }
  });
  const scrolledRef = useRef(false);
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
  const levelOptions = refLang ? refLang.levels.map(l => ({ value: l.label, short: l.short || l.key })) : [];

  // 마지막 선택 언어 저장 — [강의] 재진입 시 유지
  useEffect(() => {
    try { localStorage.setItem('lessons_lang', langFilter); } catch {}
  }, [langFilter]);

  // 첫 방문(해당 언어에 펼친 그룹이 없을 때) — 학습 중인 레벨 자동 펼침
  // + 마지막 본 챕터가 있으면 그 레벨 그룹도 펼침 (자동 스크롤 대상)
  const autoExpanded = useMemo(() => new Set(), []);
  useEffect(() => {
    if (!refLang || !refReadLoaded || autoExpanded.has(langFilter)) return;
    autoExpanded.add(langFilter);
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (lastChapter?.lang === langFilter) {
        const holder = refLang.levels.find(l => l.chapters.some(c => c.slug === lastChapter.slug));
        if (holder) next.add(`ref:${langFilter}:${holder.key}`);
      }
      if (![...next].some(k => k.startsWith(`ref:${langFilter}:`))) {
        const readSet = refRead[langFilter] || new Set();
        const target = refLang.levels.find(l => l.chapters.some(c => !readSet.has(c.slug))) || refLang.levels[0];
        if (target) next.add(`ref:${langFilter}:${target.key}`);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [refLang, refRead, refReadLoaded, langFilter, autoExpanded, lastChapter]);

  // 마지막 본 챕터로 자동 스크롤 (1회) — 그룹이 펼쳐져 행이 렌더된 뒤 실행
  useEffect(() => {
    if (scrolledRef.current || !refReadLoaded || !lastChapter || lastChapter.lang !== langFilter) return;
    const el = document.getElementById(`lessons-ch-${lastChapter.slug}`);
    if (!el) return; // 아직 그룹 미펼침 — 다음 렌더에서 재시도
    scrolledRef.current = true;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('lessons-list__row--recent');
  }, [refReadLoaded, expandedGroups, langFilter, lastChapter, levelFilter]);

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
          <h1 className="page-header__title">교재</h1>
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
            전체
          </button>
          {levelOptions.map(lvl => (
            <button
              key={lvl.value}
              onClick={() => setLevelFilter(lvl.value)}
              className={`chip ${levelFilter === lvl.value ? 'chip--active' : ''}`}
            >
              {lvl.short}
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

          {/* 독해 트랙 진입(파일럿) — 관리자·일본어에서만 노출. 챕터와 별개의 "글 이해 완주" 축 */}
          {isAdmin && langFilter === 'Japanese' && (
            <button
              type="button"
              className="lessons-continue"
              onClick={() => router.push('/japanese/reading')}
            >
              <span className="lessons-continue__body">
                <span className="lessons-continue__kicker">📖 독해 트랙 · 파일럿</span>
                <span className="lessons-continue__title">도쿄 도착 — 여행 이야기로 N5 문형 전수</span>
              </span>
              <span className="lessons-continue__meta">열기 →</span>
            </button>
          )}

          {/* 이어서 학습 — 지금 할 챕터로 한 번에 */}
          {continueTarget && (
            <button
              type="button"
              className="lessons-continue"
              onClick={() => router.push(`${refLang.base}/grammar/${continueTarget.slug}`)}
            >
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
            // 인트로 레벨(OT/A0 — levels 첫 항목)은 관문이 없어 '전부 읽음'이 수료 기준
            const isIntroGroup = meta.key === refLang.levels[0]?.key;
            const groupComplete = chapters.length > 0 && (isIntroGroup ? readCount === chapters.length : passedCount === chapters.length);
            return (
              <section key={groupKey} className={`lessons-list__group ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="lessons-list__group-header"
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={isOpen}
                >
                  <span className="lessons-list__group-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  <span className="lessons-list__group-glyph" aria-hidden="true">{meta.short || meta.key}</span>
                  <span className="lessons-list__group-title">
                    {meta.label.replace(`${meta.short || meta.key} `, '')}
                  </span>
                  <span className="lessons-list__group-focus">{meta.focus}</span>
                  {/* 접힌 상태에서도 보이는 사전 바로가기 */}
                  {bunkeiCount > 0 && (
                    <span
                      className="lessons-list__bunkei-chip lessons-list__chip--bunkei"
                      role="link"
                      tabIndex={0}
                      title={`${meta.key} 문형 사전 — ${bunkeiCount}문형 전수 (검색·뜻 가리기)`}
                      onClick={e => { e.stopPropagation(); router.push(`${refLang.base}/bunkei/${meta.key.toLowerCase()}`); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); router.push(`${refLang.base}/bunkei/${meta.key.toLowerCase()}`); } }}
                    >
                      문형 {bunkeiCount}
                    </span>
                  )}
                  {vocabCount > 0 && (
                    <span
                      className="lessons-list__bunkei-chip lessons-list__chip--vocab"
                      role="link"
                      tabIndex={0}
                      title={`${meta.label} 어휘 사전 — ${vocabCount}단어 (주제별·검색)`}
                      onClick={e => { e.stopPropagation(); router.push(`${refLang.base}/vocab/${meta.key.toLowerCase()}`); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); router.push(`${refLang.base}/vocab/${meta.key.toLowerCase()}`); } }}
                    >
                      어휘 {vocabCount}
                    </span>
                  )}
                  <span className="lessons-list__group-count">
                    {groupComplete ? (
                      <span className="lessons-list__group-passed">수료</span>
                    ) : (
                      <>
                        {passedCount > 0 && <span className="lessons-list__group-passed">●{passedCount}</span>}
                        {readCount} / {chapters.length}
                      </>
                    )}
                  </span>
                </button>
                {isOpen && (
                  <ul className="lessons-list__rows">
                    {chapters.map(ch => {
                      const read = readSet.has(ch.slug);
                      const passed = isPassed(checkMap[ch.slug]);
                      // 진행 3단계: ○ 미학습 → ◐ 읽음 → ✅ 통과
                      return (
                        <li
                          key={ch.slug}
                          id={`lessons-ch-${ch.slug}`}
                          className={`lessons-list__row lessons-list__row--${passed ? 'passed' : read ? 'done' : 'idle'}`}
                          onClick={() => router.push(`${refLang.base}/grammar/${ch.slug}`)}
                          title={ch.summary || undefined}
                          role="link"
                          tabIndex={0}
                          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(`${refLang.base}/grammar/${ch.slug}`)}
                        >
                          <span className="lessons-list__status" aria-hidden="true">{passed ? '●' : read ? '◐' : '○'}</span>
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
