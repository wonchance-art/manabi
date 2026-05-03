'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { parseTitle } from '../lib/seriesMeta';
import { getIdealLevel } from '../lib/levels';
import { CardGridSkeleton } from '../components/Skeleton';

const LANG_FILTERS = [
  { key: 'Japanese', label: '🇯🇵 일본어' },
  { key: 'English',  label: '🇬🇧 영어' },
];

const LEVEL_ORDER = {
  'N5 기초': 0, 'N4 기본': 1, 'N3 중급': 2, 'N2 상급': 3, 'N1 심화': 4,
  'A1 기초': 0, 'A2 초급': 1, 'B1 중급': 2, 'B2 상급': 3, 'C1 고급': 4, 'C2 마스터': 5,
};

const JP_LEVELS = ['N5 기초', 'N4 기본', 'N3 중급', 'N2 상급', 'N1 심화'];
const EN_LEVELS = ['A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급', 'C2 마스터'];

async function fetchLessons() {
  const { data } = await supabase
    .from('reading_materials')
    .select('id, title, created_at, processed_json')
    .eq('visibility', 'public')
    .ilike('title', '[%#%]%')
    .limit(300);
  return data || [];
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

async function fetchVocabByLang(userId) {
  if (!userId) return { Japanese: 0, English: 0 };
  const { data } = await supabase
    .from('user_vocabulary')
    .select('language')
    .eq('user_id', userId);
  const counts = { Japanese: 0, English: 0 };
  for (const v of (data || [])) {
    if (counts[v.language] != null) counts[v.language] += 1;
  }
  return counts;
}

export default function LessonsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const [langFilter, setLangFilter] = useState(() => {
    const u = searchParams.get('lang');
    return u === 'English' ? 'English' : 'Japanese';
  });
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || 'all');
  const [testScores, setTestScores] = useState({});

  // 리딩 테스트 점수 (localStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const result = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('reading_test_history:')) {
          const id = key.slice('reading_test_history:'.length);
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          if (arr.length === 0) continue;
          const best = arr.reduce((b, h) => h.score > b.score ? h : b);
          result[id] = best;
        }
      }
    } catch {}
    setTestScores(result);
  }, []);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons'],
    queryFn: fetchLessons,
    staleTime: 1000 * 60 * 5,
  });

  const { data: progressMap = { completed: new Set(), inProgress: new Map() } } = useQuery({
    queryKey: ['lessons-progress', user?.id],
    queryFn: () => fetchProgressMap(user?.id),
    enabled: !!user,
  });

  const { data: vocabByLang } = useQuery({
    queryKey: ['lessons-vocab-lang', user?.id],
    queryFn: () => fetchVocabByLang(user?.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const recommendedLevel = useMemo(() => {
    if (!vocabByLang) return null;
    if (langFilter === 'Japanese') return getIdealLevel('Japanese', vocabByLang.Japanese || 0);
    if (langFilter === 'English') return getIdealLevel('English', vocabByLang.English || 0);
    return null;
  }, [vocabByLang, langFilter]);

  // 사용자 상태에 따른 추천 시작점
  const recommendStart = useMemo(() => {
    if (lessons.length === 0) return null;

    // 시리즈별 그룹화
    const seriesMap = new Map();
    for (const m of lessons) {
      const meta = parseTitle(m.title);
      if (!meta.level || !meta.series || meta.num == null) continue;
      const k = `${meta.level}|${meta.series}`;
      if (!seriesMap.has(k)) seriesMap.set(k, []);
      seriesMap.get(k).push({ ...m, _meta: meta });
    }

    // 1순위: 진행 중 시리즈 (가장 많이 진행한 것)
    let bestInProgress = null;
    for (const items of seriesMap.values()) {
      items.sort((a, b) => a._meta.num - b._meta.num);
      const completed = items.filter(i => progressMap.completed.has(i.id)).length;
      if (completed === 0 || completed === items.length) continue;
      const next = items.find(i => !progressMap.completed.has(i.id));
      if (!next) continue;
      const pct = completed / items.length;
      if (!bestInProgress || pct > bestInProgress.pct) {
        bestInProgress = {
          type: 'continue',
          level: items[0]._meta.level,
          series: items[0]._meta.series,
          completed,
          total: items.length,
          pct,
          material: { id: next.id, title: next.title },
        };
      }
    }
    if (bestInProgress) return bestInProgress;

    // 2순위: 추천 레벨의 첫 미완료 lesson
    if (recommendedLevel) {
      const candidates = lessons
        .filter(m => m.processed_json?.metadata?.level === recommendedLevel)
        .map(m => ({ ...m, _meta: parseTitle(m.title) }))
        .filter(m => m._meta.num != null)
        .sort((a, b) => {
          const sa = a._meta.series || '';
          const sb = b._meta.series || '';
          if (sa !== sb) return sa.localeCompare(sb);
          return a._meta.num - b._meta.num;
        });
      const first = candidates.find(m => !progressMap.completed.has(m.id));
      if (first) {
        return { type: 'start-level', level: recommendedLevel, material: { id: first.id, title: first.title } };
      }
    }

    // 3순위: 절대 신규 → N5 카나 #1 (또는 A1 grammar #1)
    const fallback = lessons
      .filter(m => {
        const meta = parseTitle(m.title);
        const targetLevel = langFilter === 'English' ? 'A1 기초' : 'N5 기초';
        return meta.level === targetLevel && meta.num === 1 && (meta.series === '카나' || meta.series === 'grammar');
      })
      .sort((a, b) => {
        const ma = parseTitle(a.title);
        const mb = parseTitle(b.title);
        // 카나 시리즈 우선 (일본어), grammar #1 우선 (영어)
        if (ma.series === '카나' && mb.series !== '카나') return -1;
        if (mb.series === '카나' && ma.series !== '카나') return 1;
        return 0;
      });
    if (fallback[0]) {
      return {
        type: 'start-fresh',
        level: fallback[0].processed_json?.metadata?.level,
        material: { id: fallback[0].id, title: fallback[0].title },
      };
    }
    return null;
  }, [lessons, progressMap, recommendedLevel, langFilter]);

  // 시리즈별 총 편수 (5/23용)
  const seriesTotals = useMemo(() => {
    const map = new Map();
    for (const m of lessons) {
      const meta = parseTitle(m.title);
      if (!meta.level || !meta.series || meta.num == null) continue;
      const k = `${meta.level}|${meta.series}`;
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [lessons]);

  // 정렬: 레벨 → 시리즈명 → 번호
  const sorted = useMemo(() => {
    let arr = lessons.slice();
    arr = arr.filter(m => m.processed_json?.metadata?.language === langFilter);
    if (levelFilter !== 'all') {
      arr = arr.filter(m => m.processed_json?.metadata?.level === levelFilter);
    }
    arr.sort((a, b) => {
      const la = a.processed_json?.metadata?.level;
      const lb = b.processed_json?.metadata?.level;
      const oa = la in LEVEL_ORDER ? LEVEL_ORDER[la] : 99;
      const ob = lb in LEVEL_ORDER ? LEVEL_ORDER[lb] : 99;
      if (oa !== ob) return oa - ob;
      const ma = parseTitle(a.title);
      const mb = parseTitle(b.title);
      const sa = ma.series || '￿';
      const sb = mb.series || '￿';
      if (sa !== sb) return sa.localeCompare(sb);
      if (ma.num != null && mb.num != null) return ma.num - mb.num;
      return 0;
    });
    return arr;
  }, [lessons, langFilter, levelFilter]);

  // 레벨 옵션 (선택된 언어에 따라)
  const levelOptions = langFilter === 'Japanese' ? JP_LEVELS : EN_LEVELS;

  return (
    <div className="page-container">
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">🎓 강의</h1>
          <p className="page-header__subtitle">패턴·표현 단계별 학습 (시리즈 #N)</p>
        </div>
      </div>

      {/* 추천 시작점 — 진행 중 / 추천 레벨 첫 lesson / 신규 입문 */}
      {recommendStart && (
        <Link href={`/viewer/${recommendStart.material.id}`} className="lessons-hero">
          <div className="lessons-hero__hint">
            {recommendStart.type === 'continue' && '📍 이어서 학습'}
            {recommendStart.type === 'start-level' && `🎯 추천 시작점 — ${recommendStart.level}`}
            {recommendStart.type === 'start-fresh' && '🌱 첫 강의로 시작'}
          </div>
          <div className="lessons-hero__title">{recommendStart.material.title}</div>
          {recommendStart.type === 'continue' && (
            <div className="lessons-hero__sub">
              {recommendStart.level} {recommendStart.series} · {recommendStart.completed}/{recommendStart.total} 진행
            </div>
          )}
          {recommendStart.type === 'start-level' && (
            <div className="lessons-hero__sub">단어 수 기준 자동 추천</div>
          )}
          {recommendStart.type === 'start-fresh' && (
            <div className="lessons-hero__sub">언어 학습은 글자부터</div>
          )}
        </Link>
      )}

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

      {isLoading ? (
        <CardGridSkeleton height={48} />
      ) : sorted.length > 0 ? (() => {
        // 레벨별로 그룹화 (정렬은 이미 sorted)
        const groups = [];
        let currentLevel = null;
        for (const m of sorted) {
          const lv = m.processed_json?.metadata?.level;
          if (lv !== currentLevel) {
            currentLevel = lv;
            groups.push({ level: lv, items: [] });
          }
          groups[groups.length - 1].items.push(m);
        }
        return (
          <div className="lessons-list">
            {groups.map(g => {
              const completedCount = g.items.filter(m => progressMap.completed.has(m.id)).length;
              return (
                <section key={g.level || 'unknown'} className="lessons-list__group">
                  <header className="lessons-list__group-header">
                    <span className="lessons-list__group-title">{g.level || '레벨 미정'}</span>
                    <span className="lessons-list__group-count">{completedCount} / {g.items.length}</span>
                  </header>
                  <ul className="lessons-list__rows">
                    {g.items.map(m => {
                      const metadata = m.processed_json?.metadata || {};
                      const language = metadata.language || (m.title.match(/[a-zA-Z]/) ? 'English' : 'Japanese');
                      const isCompleted = progressMap.completed.has(m.id);
                      const titleMeta = parseTitle(m.title);
                      const total = (titleMeta.level && titleMeta.series)
                        ? seriesTotals.get(`${titleMeta.level}|${titleMeta.series}`) || 0
                        : 0;
                      const seriesPosition = (titleMeta.num != null && total > 0) ? `${titleMeta.num}/${total}` : null;
                      const lastIdx = progressMap.inProgress.get(m.id);
                      const totalSeq = m.processed_json?.sequence?.length || 0;
                      const pct = (lastIdx && totalSeq > 0) ? Math.round((lastIdx / totalSeq) * 100) : 0;
                      const score = testScores[String(m.id)];
                      const previewText = (() => {
                        const dict = m.processed_json?.dictionary || {};
                        const seq = m.processed_json?.sequence || [];
                        if (seq.length === 0) return '';
                        return seq.slice(0, 40).map(id => dict[id]?.text || '').filter(Boolean).join('').slice(0, 120);
                      })();
                      // 상태 표시 우선순위: 완료 > 진행 중 > 미시작
                      const statusDot = isCompleted ? 'done' : (lastIdx ? 'progress' : 'idle');
                      return (
                        <li
                          key={m.id}
                          className={`lessons-list__row lessons-list__row--${statusDot}`}
                          onClick={() => router.push(`/viewer/${m.id}`)}
                          title={previewText || undefined}
                          role="link"
                          tabIndex={0}
                          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(`/viewer/${m.id}`)}
                        >
                          <span className="lessons-list__status" aria-hidden="true">
                            {isCompleted ? '●' : lastIdx ? '◐' : '○'}
                          </span>
                          <span className="lessons-list__lang" aria-hidden="true">
                            {language === 'English' ? '🇬🇧' : '🇯🇵'}
                          </span>
                          <span className="lessons-list__title">{m.title}</span>
                          <span className="lessons-list__meta">
                            {seriesPosition && (
                              <span className="lessons-list__pos" title={`${titleMeta.series} 시리즈`}>{seriesPosition}</span>
                            )}
                            {score && (
                              <span className="lessons-list__score" title="리딩 테스트 최고 점수">🏆 {score.score}/{score.total}</span>
                            )}
                            {!isCompleted && lastIdx && pct > 0 && (
                              <span className="lessons-list__pct">{pct}%</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        );
      })() : (
        <div className="empty-state">
          <div className="empty-state__icon">🎓</div>
          <p className="empty-state__msg">조건에 맞는 강의가 없어요</p>
          <Link href="/admin" className="empty-state__link">
            관리자 페이지에서 시드 실행하기 →
          </Link>
        </div>
      )}
    </div>
  );
}
