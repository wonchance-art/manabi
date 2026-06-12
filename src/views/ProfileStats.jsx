'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { isPassed } from '../components/RefPatternCheck';
import VocabStats from './VocabStats';

const LANG_KO = { Japanese: '일본어', English: '영어', French: '프랑스어' };

/** 레벨별 어휘 수집 목표 (누적) — 진도 카드의 보조 지표 */
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
  ] = await Promise.all([
    supabase.from('reading_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
    supabase.from('user_vocabulary').select('created_at').eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
    supabase.from('user_vocabulary').select('*').eq('user_id', userId),
  ]);

  const heatmapDayCounts = {};
  for (const v of (heatmapRows || [])) {
    const day = v.created_at.slice(0, 10);
    heatmapDayCounts[day] = (heatmapDayCounts[day] || 0) + 1;
  }

  const vocab = allVocab || [];

  return {
    vocab,
    mastered: vocab.filter(v => (v.interval ?? 0) > 14).length,
    readCount: readCount || 0,
    heatmapDayCounts,
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
  const hasHardWords = vocab.filter(v => (v.repetitions || 0) >= 2).length > 0;
  const hasHeatmap = data?.heatmapDayCounts && Object.keys(data.heatmapDayCounts).length > 0;

  // 벤토 배치: 좌측 통계 2×2 블록 + 우측 단어 복습 라이브 타일 / 진도·기억 건강 / 요주의·히트맵
  const stats = [
    { label: '수집', value: vocab.length },
    { label: '숙련', value: data?.mastered ?? '–' },
    { label: '완독', value: data?.readCount ?? '–' },
    { label: '스트릭', value: streak ? `${streak}일` : '–' },
  ];

  return (
    <div className="bento">
      <StatTile {...stats[0]} />
      <StatTile {...stats[1]} />
      <div className="bento-item bento--2x2">
        <ReviewTile vocab={vocab} />
      </div>
      <StatTile {...stats[2]} />
      <StatTile {...stats[3]} />
      <div className="bento-item bento--2x2">
        <LevelCoverageCard refManifest={refManifest} vocab={vocab} />
      </div>
      {vocab.length > 0 && (
        <div className="bento-item bento--2x2">
          <VocabStats vocab={vocab} profile={profile} section="memory" />
        </div>
      )}
      {hasHardWords && (
        <div className="bento-item bento--2x2">
          <VocabStats vocab={vocab} profile={profile} section="hardwords" />
        </div>
      )}
      {hasHeatmap && (
        <div className="bento-item bento--2x2">
          <HeatmapCard dayCounts={data.heatmapDayCounts} />
        </div>
      )}
    </div>
  );
}

/* ── 단어 복습 라이브 타일 — 단어가 시간차로 넘어가는 메트로식 타일, 클릭 시 단어장 ── */

function ReviewTile({ vocab }) {
  const now = Date.now();
  // 복습 대기 단어 우선, 없으면 최근 수집 단어
  const pool = useMemo(() => {
    const due = vocab
      .filter(v => v.next_review_at && new Date(v.next_review_at).getTime() <= now)
      .sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at));
    if (due.length > 0) return due.slice(0, 20);
    return [...vocab]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);
    // now는 렌더 시점 고정으로 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab]);
  const dueCount = useMemo(
    () => vocab.filter(v => v.next_review_at && new Date(v.next_review_at).getTime() <= now).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vocab]
  );

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % pool.length), 3500);
    return () => clearInterval(t);
  }, [pool.length]);

  const word = pool[idx % Math.max(pool.length, 1)];

  return (
    <Link href="/vocab" className="card review-tile">
      <span className="review-tile__head">
        <span className="review-tile__kicker">단어 복습</span>
        {dueCount > 0 && <span className="review-tile__due">{dueCount}개 대기</span>}
      </span>
      {word ? (
        <span className="review-tile__cycle" key={word.id ?? idx}>
          <span className="review-tile__word">{word.word_text}</span>
          <span className="review-tile__meaning">{word.meaning}</span>
        </span>
      ) : (
        <span className="review-tile__cycle">
          <span className="review-tile__meaning">아직 수집한 단어가 없어요.<br />자료를 읽으며 단어를 모아보세요.</span>
        </span>
      )}
      <span className="review-tile__cta">복습하기 →</span>
    </Link>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="bento-item bento--1x1 card bento-stat">
      <span className="mypage-stat-cell__value">{value}</span>
      <span className="mypage-stat-cell__label">{label}</span>
    </div>
  );
}

/* ── 진도 — 레벨별 챕터(강의) 통과 + 어휘 수집 통합, 3개 언어 ── */

function LevelCoverageCard({ refManifest, vocab }) {
  const langs = Object.keys(refManifest);
  const [lang, setLang] = useState(langs[0] || 'Japanese');
  // SSR과 첫 클라이언트 렌더를 일치시키기 위해 localStorage는 마운트 후에만 읽는다
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('lessons_lang');
    if (langs.includes(saved)) setLang(saved);
    // langs는 정적 매니페스트에서 파생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ref = refManifest[lang];

  // 강의 진행 — localStorage (강의 목록과 동일 원본)
  const progress = useMemo(() => {
    if (!ref || !mounted) return { readSet: new Set(), checkMap: {} };
    try {
      return {
        readSet: new Set(JSON.parse(localStorage.getItem(ref.readKey) || '[]')),
        checkMap: JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}'),
      };
    } catch { return { readSet: new Set(), checkMap: {} }; }
  }, [ref, mounted]);

  const langVocabCount = useMemo(
    () => vocab.filter(v => v.language === lang).length,
    [vocab, lang]
  );

  if (!ref) return null;
  const targets = VOCAB_TARGETS[lang] || {};
  // 어휘 보조 지표: 도달한 레벨 ✓, 다음 목표 레벨만 숫자 노출 (반복 표기 방지)
  const nextVocabKey = ref.levels.find(lv => targets[lv.key] && langVocabCount < targets[lv.key])?.key || null;

  return (
    <div className="card mypage-section">
      <div className="lvprog__head">
        <h2 className="mypage-section__title" style={{ margin: 0 }}>진도</h2>
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
              {target && vocabReached ? (
                <span className="lvprog__vocab is-done">단어 ✓</span>
              ) : target && lv.key === nextVocabKey ? (
                <span className="lvprog__vocab">
                  단어 {langVocabCount.toLocaleString('ko-KR')}/{target.toLocaleString('ko-KR')}
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

/* ── 학습 히트맵 ── */

function HeatmapCard({ dayCounts }) {
  const ROWS = 7, CELL = 13, GAP = 3, COLS = 16;
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
