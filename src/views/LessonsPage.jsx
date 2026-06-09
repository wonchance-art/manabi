'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { parseTitle } from '../lib/seriesMeta';

const LANG_FILTERS = [
  { key: 'Japanese', label: '🇯🇵 일본어' },
  { key: 'English',  label: '🇬🇧 영어' },
  { key: 'French',   label: '🇫🇷 프랑스어' },
];

/**
 * 카나 쓰기 드릴 — DB 실습 강의 중 레퍼런스가 대체할 수 없는 유일한 시리즈.
 * 그 외 DB 문법 강의는 레퍼런스와 중복이라 목록에서 제외 (직접 링크는 유효).
 */
async function fetchKanaLessons() {
  const { data } = await supabase
    .from('reading_materials')
    .select('id, title, processed_json')
    .eq('visibility', 'public')
    .ilike('title', '%카나 #%')
    .limit(60);
  return (data || [])
    .map(m => ({ ...m, _meta: parseTitle(m.title) }))
    .filter(m => m._meta.series === '카나')
    .sort((a, b) => (a._meta.num || 0) - (b._meta.num || 0));
}

async function fetchProgressMap(userId) {
  if (!userId) return { completed: new Set(), inProgress: new Map() };
  const { data } = await supabase
    .from('reading_progress')
    .select('material_id, is_completed, last_token_idx')
    .eq('user_id', userId);
  const completed = new Set();
  const inProgress = new Map();
  for (const r of (data || [])) {
    if (r.is_completed) completed.add(r.material_id);
    else if (r.last_token_idx > 0) inProgress.set(r.material_id, r.last_token_idx);
  }
  return { completed, inProgress };
}

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

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem('lessons_expanded', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // 레퍼런스 챕터 읽음 표시 (localStorage — RefReadMark가 기록)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const map = {};
    for (const [name, ref] of Object.entries(refManifest)) {
      try {
        map[name] = new Set(JSON.parse(localStorage.getItem(ref.readKey) || '[]'));
      } catch {
        map[name] = new Set();
      }
    }
    setRefRead(map);
    // refManifest는 서버에서 내려오는 정적 데이터 — 마운트 시 1회면 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 카나 드릴 (일본어 탭 전용)
  const { data: kanaLessons = [] } = useQuery({
    queryKey: ['kana-lessons'],
    queryFn: fetchKanaLessons,
    enabled: langFilter === 'Japanese',
    staleTime: 1000 * 60 * 10,
  });
  const { data: progressMap = { completed: new Set(), inProgress: new Map() } } = useQuery({
    queryKey: ['lessons-progress', user?.id],
    queryFn: () => fetchProgressMap(user?.id),
    enabled: !!user && langFilter === 'Japanese',
  });

  const refLang = refManifest[langFilter];
  const levelOptions = refLang ? refLang.levels.map(l => l.label) : [];

  const refGroups = useMemo(() => {
    if (!refLang) return [];
    return refLang.levels
      .filter(l => levelFilter === 'all' || l.label === levelFilter)
      .map(l => ({ meta: l, chapters: l.chapters, vocabCount: l.vocabCount }));
  }, [refLang, levelFilter]);

  // 카나 그룹은 N5와 짝 — 전체 또는 N5 필터에서만 노출
  const showKana = langFilter === 'Japanese'
    && kanaLessons.length > 0
    && (levelFilter === 'all' || levelFilter === 'N5 기초');

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

          {/* 카나 쓰기 드릴 — 문자 학습의 실습 짝 (N5 위에 배치) */}
          {showKana && (() => {
            const groupKey = 'kana-drill';
            const isOpen = expandedGroups.has(groupKey);
            const doneCount = kanaLessons.filter(m => progressMap.completed.has(m.id)).length;
            return (
              <section className={`lessons-list__group ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="lessons-list__group-header"
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={isOpen}
                >
                  <span className="lessons-list__group-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  <span className="lessons-list__group-title">
                    ✏️ 카나 쓰기 드릴
                    <span style={{ fontWeight: 500, fontSize: '0.82em', color: 'var(--text-muted)', marginLeft: 8 }}>
                      히라가나·가타카나 — 문자 챕터의 실습 짝
                    </span>
                  </span>
                  <span className="lessons-list__group-count">{doneCount} / {kanaLessons.length}</span>
                </button>
                {isOpen && (
                  <ul className="lessons-list__rows">
                    {kanaLessons.map(m => {
                      const isCompleted = progressMap.completed.has(m.id);
                      const lastIdx = progressMap.inProgress.get(m.id);
                      return (
                        <li
                          key={m.id}
                          className={`lessons-list__row lessons-list__row--${isCompleted ? 'done' : lastIdx ? 'progress' : 'idle'}`}
                          onClick={() => router.push(`/lessons/${m.id}`)}
                          role="link"
                          tabIndex={0}
                          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(`/lessons/${m.id}`)}
                        >
                          <span className="lessons-list__status" aria-hidden="true">
                            {isCompleted ? '●' : lastIdx ? '◐' : '○'}
                          </span>
                          <span className="lessons-list__title">{m._meta.display || m.title}</span>
                          <span className="lessons-list__meta" />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })()}

          {/* 레벨별 레퍼런스 그룹 */}
          {refGroups.map(({ meta, chapters, vocabCount }) => {
            const groupKey = `ref:${langFilter}:${meta.key}`;
            const isOpen = expandedGroups.has(groupKey);
            const readSet = refRead[langFilter] || new Set();
            const readCount = chapters.filter(c => readSet.has(c.slug)).length;
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
                  <span className="lessons-list__group-count">{readCount} / {chapters.length}</span>
                </button>
                {isOpen && (
                  <ul className="lessons-list__rows">
                    {chapters.map(ch => {
                      const read = readSet.has(ch.slug);
                      return (
                        <li
                          key={ch.slug}
                          className={`lessons-list__row lessons-list__row--${read ? 'done' : 'idle'}`}
                          onClick={() => router.push(`${refLang.base}/grammar/${ch.slug}`)}
                          title={ch.summary || undefined}
                          role="link"
                          tabIndex={0}
                          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(`${refLang.base}/grammar/${ch.slug}`)}
                        >
                          <span className="lessons-list__status" aria-hidden="true">{read ? '●' : '○'}</span>
                          <span className="lessons-list__title">#{ch.order} {ch.title}</span>
                          <span className="lessons-list__meta">
                            {ch.duration && <span className="lessons-list__pct">{ch.duration}</span>}
                          </span>
                        </li>
                      );
                    })}
                    {vocabCount > 0 && (
                      <li
                        className="lessons-list__row lessons-list__row--idle"
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
