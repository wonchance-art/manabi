'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { isPassed } from '../components/RefPatternCheck';
import { parseTitle } from '../lib/seriesMeta';
import VocabStats from './VocabStats';

const LANG_KO = { Japanese: '일본어', English: '영어', French: '프랑스어' };

/** 레벨별 어휘 수집 목표 (누적) — 급수 진행 카드의 보조 지표 */
const VOCAB_TARGETS = {
  Japanese: { N5: 800, N4: 1500, N3: 3750, N2: 6000, N1: 10000 },
  English:  { A1: 500, A2: 1000, B1: 2000, B2: 4000, C1: 7000, C2: 10000 },
  French:   { A0: 200, A1: 500, A2: 1000, B1: 2000, B2: 4000, C1: 7000, C2: 10000 },
};

async function fetchProfileStats(userId) {
  const heatmapStart = new Date();
  heatmapStart.setHours(0, 0, 0, 0);
  heatmapStart.setDate(heatmapStart.getDate() - 224);

  const [
    { count: readCount },
    { data: heatmapRows },
    { data: allVocab },
    { data: seriesMaterials },
    { data: completedRows },
  ] = await Promise.all([
    supabase.from('reading_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
    supabase.from('user_vocabulary').select('created_at').eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
    supabase.from('user_vocabulary').select('*').eq('user_id', userId),
    supabase.from('reading_materials').select('id, title').eq('visibility', 'public').ilike('title', '[%#%]%').limit(300),
    supabase.from('reading_progress').select('material_id').eq('user_id', userId).eq('is_completed', true),
  ]);

  const heatmapDayCounts = {};
  for (const v of (heatmapRows || [])) {
    const day = v.created_at.slice(0, 10);
    heatmapDayCounts[day] = (heatmapDayCounts[day] || 0) + 1;
  }

  const vocab = allVocab || [];
  const doneSet = new Set((completedRows || []).map(r => r.material_id));

  // 시리즈별 진척 — 다음 화까지 계산
  const groups = new Map();
  for (const m of (seriesMaterials || [])) {
    const meta = parseTitle(m.title);
    if (!meta.level || !meta.series || meta.num == null) continue;
    const key = `${meta.level}|${meta.series}`;
    if (!groups.has(key)) groups.set(key, { level: meta.level, series: meta.series, items: [] });
    groups.get(key).items.push({ id: m.id, num: meta.num });
  }
  const seriesProgress = [...groups.values()].map(g => {
    g.items.sort((a, b) => a.num - b.num);
    const next = g.items.find(i => !doneSet.has(i.id));
    return {
      level: g.level,
      series: g.series,
      total: g.items.length,
      completed: g.items.filter(i => doneSet.has(i.id)).length,
      nextId: next?.id || null,
      nextNum: next?.num ?? null,
    };
  });

  return {
    vocab,
    mastered: vocab.filter(v => (v.interval ?? 0) > 14).length,
    readCount: readCount || 0,
    heatmapDayCounts,
    seriesProgress,
  };
}

export default function ProfileStats({ refManifest = {} }) {
  const { user, profile } = useAuth();

  const { data } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: () => fetchProfileStats(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  if (!user) return null;
  const vocab = data?.vocab || [];
  const streak = profile?.streak_count ?? 0;

  return (
    <>
      {/* 핵심 현황 */}
      <div className="card mypage-section">
        <div className="mypage-stat-grid">
          {[
            { label: '수집', value: vocab.length },
            { label: '숙련', value: data?.mastered ?? '–' },
            { label: '완독', value: data?.readCount ?? '–' },
            { label: '스트릭', value: streak ? `${streak}일` : '–' },
          ].map(s => (
            <div key={s.label} className="mypage-stat-cell">
              <span className="mypage-stat-cell__value">{s.value}</span>
              <span className="mypage-stat-cell__label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <LevelCoverageCard refManifest={refManifest} vocab={vocab} />

      {data?.seriesProgress?.length > 0 && <SeriesProgressCard seriesProgress={data.seriesProgress} />}

      {vocab.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          <VocabStats vocab={vocab} profile={profile} section="memory" />
          <VocabStats vocab={vocab} profile={profile} section="hardwords" />
        </div>
      )}

      {data?.heatmapDayCounts && <HeatmapCard dayCounts={data.heatmapDayCounts} />}
    </>
  );
}

/* ── 급수 진행 — 챕터(강의) 통과 + 어휘 수집 통합, 3개 언어 ── */

function LevelCoverageCard({ refManifest, vocab }) {
  const langs = Object.keys(refManifest);
  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lessons_lang');
      if (langs.includes(saved)) return saved;
    }
    return langs[0] || 'Japanese';
  });
  const ref = refManifest[lang];

  // 강의 진행 — localStorage (강의 목록과 동일 원본)
  const progress = useMemo(() => {
    if (!ref || typeof window === 'undefined') return { readSet: new Set(), checkMap: {} };
    try {
      return {
        readSet: new Set(JSON.parse(localStorage.getItem(ref.readKey) || '[]')),
        checkMap: JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}'),
      };
    } catch { return { readSet: new Set(), checkMap: {} }; }
  }, [ref]);

  const langVocabCount = useMemo(
    () => vocab.filter(v => v.language === lang).length,
    [vocab, lang]
  );

  if (!ref) return null;
  const targets = VOCAB_TARGETS[lang] || {};

  return (
    <div className="card mypage-section">
      <div className="lvprog__head">
        <h2 className="mypage-section__title" style={{ margin: 0 }}>급수 진행</h2>
        <div className="lvprog__tabs">
          {langs.map(l => (
            <button key={l} type="button"
              className={`chip ${lang === l ? 'chip--active' : ''}`}
              onClick={() => setLang(l)}>
              {LANG_KO[l] || l}
            </button>
          ))}
        </div>
      </div>
      <div className="lvprog__rows">
        {ref.levels.map(lv => {
          const total = lv.chapters.length;
          const passed = lv.chapters.filter(c => isPassed(progress.checkMap[c.slug])).length;
          const read = lv.chapters.filter(c => progress.readSet.has(c.slug)).length;
          const target = targets[lv.key];
          const vocabReached = target && langVocabCount >= target;
          const done = total > 0 && passed === total;
          return (
            <div key={lv.key} className="lvprog__row">
              <span className={`lvprog__key ${done ? 'is-done' : ''}`}>{lv.short || lv.key}</span>
              <span className="lvprog__bar">
                <span className="lvprog__bar-read" style={{ width: `${total ? (read / total) * 100 : 0}%` }} />
                <span className="lvprog__bar-pass" style={{ width: `${total ? (passed / total) * 100 : 0}%` }} />
              </span>
              <span className="lvprog__count">
                {done ? '수료' : `${passed} / ${total}`}
              </span>
              {target ? (
                <span className={`lvprog__vocab ${vocabReached ? 'is-done' : ''}`}>
                  단어 {vocabReached ? '✓' : `${langVocabCount.toLocaleString('ko-KR')}/${target.toLocaleString('ko-KR')}`}
                </span>
              ) : <span className="lvprog__vocab" />}
            </div>
          );
        })}
      </div>
      <div className="lvprog__legend">
        <span><span className="lvprog__dot lvprog__dot--read" />읽음</span>
        <span><span className="lvprog__dot lvprog__dot--pass" />퀴즈 통과</span>
        <span>단어 = 해당 언어 수집 어휘 / 레벨 목표</span>
      </div>
    </div>
  );
}

/* ── 시리즈 진척도 — 다음 화 바로가기 ── */

const LEVEL_ORDER = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4, A0: 5, A1: 6, A2: 7, B1: 8, B2: 9, C1: 10, C2: 11 };

function SeriesProgressCard({ seriesProgress }) {
  const sorted = [...seriesProgress].sort((a, b) => {
    const oa = LEVEL_ORDER[a.level] ?? 99;
    const ob = LEVEL_ORDER[b.level] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.series.localeCompare(b.series);
  });
  const totalCompleted = sorted.reduce((s, g) => s + g.completed, 0);
  const totalAll = sorted.reduce((s, g) => s + g.total, 0);
  return (
    <div className="card mypage-section">
      <div className="lvprog__head">
        <h2 className="mypage-section__title" style={{ margin: 0 }}>시리즈 진척도</h2>
        <span className="lvprog__count">{totalCompleted} / {totalAll}</span>
      </div>
      <div className="lvprog__rows">
        {sorted.map(g => {
          const pct = g.total > 0 ? (g.completed / g.total) * 100 : 0;
          const done = g.completed === g.total;
          return (
            <div key={`${g.level}|${g.series}`} className="lvprog__row">
              <span className={`lvprog__series ${done ? 'is-done' : ''}`}>
                {done && '✓ '}{g.level} {g.series}
              </span>
              <span className="lvprog__bar">
                <span className="lvprog__bar-pass" style={{ width: `${pct}%`, background: done ? 'var(--accent)' : undefined }} />
              </span>
              <span className="lvprog__count">{g.completed}/{g.total}</span>
              {g.nextId ? (
                <Link href={`/viewer/${g.nextId}`} className="lvprog__next">#{g.nextNum} 읽기 →</Link>
              ) : <span className="lvprog__next" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 학습 히트맵 ── */

function HeatmapCard({ dayCounts }) {
  const ROWS = 7, CELL = 13, GAP = 3, COLS = 32;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);
  const days = Array.from({ length: COLS * ROWS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (COLS * ROWS - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const maxCount = Math.max(1, ...Object.values(dayCounts));
  const totalActive = Object.keys(dayCounts).length;
  const totalWords = Object.values(dayCounts).reduce((a, b) => a + b, 0);
  const cellColor = n => {
    if (!n) return 'var(--bg-secondary)';
    const lvl = Math.ceil((n / maxCount) * 4);
    return ['', 'var(--primary-glow)', 'var(--primary)', 'var(--accent)', 'var(--accent)'][lvl] || 'var(--accent)';
  };
  const W = COLS * (CELL + GAP) - GAP;
  const H = ROWS * (CELL + GAP) - GAP;
  return (
    <div className="card mypage-section">
      <div className="lvprog__head">
        <h2 className="mypage-section__title" style={{ margin: 0 }}>학습 히트맵</h2>
        <span className="lvprog__count">{totalActive}일 · {totalWords}개</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {days.map((day, i) => (
          <rect key={day}
            x={Math.floor(i / ROWS) * (CELL + GAP)}
            y={(i % ROWS) * (CELL + GAP)}
            width={CELL} height={CELL} rx={2}
            fill={cellColor(dayCounts[day] || 0)}
            opacity={day > todayKey ? 0 : 1}>
            <title>{day}: {dayCounts[day] || 0}개</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
