'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isPassed } from '../components/RefPatternCheck';
import { useAuth } from '../lib/AuthContext';
import { pullProgress } from '../lib/refProgress';
import LanguageWorldMap, { TRACK_COLORS } from '../components/LanguageWorldMap';
import LearnPage from './LearnPage';

const LANG_FILTERS = [
  { key: 'English',  label: '영어' },
  { key: 'French',   label: '프랑스어' },
  { key: 'Japanese', label: '일본어' },
  { key: 'Chinese',  label: '중국어' },
];

const VALID_LANGS = new Set(LANG_FILTERS.map(f => f.key));

/** refManifest: 서버에서 만든 레퍼런스 경량 목차 — lessons/page.jsx 참고 */
// 피치 문장 속 『작품명』을 굵게 — 교재 소개 카드 전용의 얇은 파서
function PitchLine({ text }) {
  return text.split(/(『[^』]+』)/g).map((part, i) =>
    part.startsWith('『') ? <strong key={i}>{part}</strong> : part
  );
}

export default function LessonsPage({ refManifest = {}, initialLang, initialLevel, progressCatalog = {} }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // SSR 원칙: 초기 상태는 서버·클라이언트가 동일해야 한다(하이드레이션 미스매치 방지).
  // URL 파라미터는 서버(page.jsx)에서 props로 받고, localStorage 복원은 마운트 후 useEffect로만 한다.
  const urlLang = initialLang && VALID_LANGS.has(initialLang) ? initialLang : null;
  const [langFilter, setLangFilter] = useState(urlLang ?? 'English');
  // URL의 level은 key('A1')로 오는 게 자연스럽지만 내부 필터 값은 label('A1 기초')이다.
  // 서버·클라 동일한 refManifest로 초기값을 정규화해 외부 링크와 칩 활성 상태를 함께 맞춘다.
  const urlLevel = (() => {
    if (!initialLevel) return 'all';
    const levels = refManifest?.[urlLang ?? 'English']?.levels ?? [];
    const hit = levels.find(l => l.label === initialLevel) || levels.find(l => l.key === initialLevel);
    return hit ? hit.label : 'all';
  })();
  // 마지막으로 본 챕터 — 복귀 시 자동 스크롤 대상
  const [lastChapter, setLastChapter] = useState(null);
  const scrolledRef = useRef(false);
  const [levelFilter, setLevelFilter] = useState(urlLevel);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  useEffect(() => {
    // URL에 lang이 없을 때만 마지막 선택 언어 복원 (챕터 페이지 진입 시에도 갱신됨)
    try {
      if (!urlLang) {
        const saved = localStorage.getItem('lessons_lang');
        if (saved && VALID_LANGS.has(saved)) setLangFilter(saved);
      }
      const last = JSON.parse(localStorage.getItem('ref_last_chapter') || 'null');
      if (last) setLastChapter(last);
      const exp = JSON.parse(localStorage.getItem('lessons_expanded') || '[]');
      if (Array.isArray(exp) && exp.length) setExpandedGroups(new Set(exp));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    // level은 임의 문자열일 수 있다 — label·key 어느 쪽도 아니면 전체를 보여준다(빈 목록 방지).
    const matched = refLang.levels.find(l => l.label === levelFilter)
      || refLang.levels.find(l => l.key === levelFilter);
    const effectiveLevel = levelFilter === 'all' ? 'all' : (matched ? matched.label : 'all');
    return refLang.levels
      .filter(l => effectiveLevel === 'all' || l.label === effectiveLevel)
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

      {/* 내 진도 스트립 — 구 /learn 대시보드를 embedded로 통합 */}
      <LearnPage embedded progressCatalog={progressCatalog} />

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
            {refLang.pitch && (
              <p style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.55, margin: '2px 0 8px', color: 'var(--text-primary)' }}>
                {refLang.pitch.hook}
              </p>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
              {refLang.blurb.split(/\*\*(.+?)\*\*/g).map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </p>
            <LanguageWorldMap langKey={langFilter} />
            {refLang.pitch && (
              <div style={{ margin: '10px 0 4px' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {refLang.pitch.scenes.map((scene) => (
                    <li key={scene} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: TRACK_COLORS[langFilter], flex: 'none', transform: 'translateY(-2px)' }} />
                      <span><PitchLine text={scene} /></span>
                    </li>
                  ))}
                </ul>
                <p style={{ margin: '12px 0 0', padding: '9px 12px', borderLeft: `3px solid ${TRACK_COLORS[langFilter]}`, background: 'var(--bg-secondary)', borderRadius: '0 8px 8px 0', fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  <PitchLine text={refLang.pitch.edge} />
                </p>
                <div style={{ marginTop: 10, padding: '11px 13px', borderRadius: 10, background: `color-mix(in srgb, ${TRACK_COLORS[langFilter]} 9%, var(--bg-secondary))`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--text-primary)', flex: '1 1 240px' }}>{refLang.pitch.closer}</strong>
                  {refLang.levels[0]?.chapters?.[0]?.slug && (
                    <button type="button" className="btn btn--sm"
                      onClick={() => router.push(`${refLang.base ?? ''}/grammar/${refLang.levels[0].chapters[0].slug}`)}
                      style={{ background: TRACK_COLORS[langFilter], color: '#fff', border: 'none' }}>
                      지금 시작 →
                    </button>
                  )}
                </div>
              </div>
            )}
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
