'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Button from '../components/Button';
import { parseTitle } from '../lib/seriesMeta';
import { getIdealLevel } from '../lib/levels';
import { isPassed } from '../components/RefPatternCheck';
import { pullProgress } from '../lib/refProgress';
import ProfileStats from './ProfileStats';

async function fetchHomeData(userId) {
  const todayStr   = new Date().toISOString().split('T')[0];
  const todayStart = `${todayStr}T00:00:00`;
  const now        = new Date().toISOString();

  const weekStartDate = new Date();
  weekStartDate.setHours(0, 0, 0, 0);
  const dow = weekStartDate.getDay();
  weekStartDate.setDate(weekStartDate.getDate() - (dow === 0 ? 6 : dow - 1));
  const weekStartISO = weekStartDate.toISOString();

  // 지난주 범위 (월~일)
  const prevWeekStart = new Date(weekStartDate);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekStartISO = prevWeekStart.toISOString();
  const prevWeekEndISO = weekStartISO;

  // vocab stats are derived client-side from vocabRows
  const [
    { count: dueCount },
    { data: vocabRows },
    { data: recentProgress },
    suggestionsRes,
    { data: readProgressRows },
    { data: allVocabRows },
    { data: seriesMaterials },
    { data: allCompleted },
  ] = await Promise.all([
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).lte('next_review_at', now),
    supabase.from('user_vocabulary').select('created_at, last_reviewed_at, language, word_text')
      .eq('user_id', userId).gte('created_at', prevWeekStartISO),
    supabase.from('reading_progress')
      .select('material_id, is_completed, updated_at, completed_at, reading_materials(id, title, processed_json)')
      .eq('user_id', userId).order('updated_at', { ascending: false }).limit(20),
    fetch('/api/suggestions/today').then(r => r.ok ? r.json() : []),
    supabase.from('reading_progress').select('completed_at')
      .eq('user_id', userId).eq('is_completed', true).gte('completed_at', prevWeekStartISO),
    supabase.from('user_vocabulary').select('language, word_text')
      .eq('user_id', userId),
    supabase.from('reading_materials')
      .select('id, title, processed_json')
      .eq('visibility', 'public')
      .ilike('title', '[%#%]%')
      .limit(300),
    supabase.from('reading_progress')
      .select('material_id')
      .eq('user_id', userId)
      .eq('is_completed', true),
  ]);

  const rows = vocabRows || [];
  const reads = readProgressRows || [];

  // Derive all vocab stats client-side
  let todayVocabCount = 0, todayReviewCount = 0, weekVocab = 0, weekReview = 0;
  let prevWeekVocab = 0, prevWeekReview = 0;

  for (const v of rows) {
    if (v.created_at >= todayStart) todayVocabCount++;
    if (v.created_at >= weekStartISO) weekVocab++;
    else if (v.created_at >= prevWeekStartISO && v.created_at < prevWeekEndISO) prevWeekVocab++;
    if (v.last_reviewed_at && v.last_reviewed_at >= todayStart) todayReviewCount++;
    if (v.last_reviewed_at && v.last_reviewed_at >= weekStartISO) weekReview++;
    else if (v.last_reviewed_at && v.last_reviewed_at >= prevWeekStartISO && v.last_reviewed_at < prevWeekEndISO) prevWeekReview++;
  }

  // Derive read stats
  const todayReadCount = reads.filter(r => r.completed_at >= todayStart).length;
  const weekRead = reads.filter(r => r.completed_at >= weekStartISO).length;
  const prevWeekRead = reads.filter(r => r.completed_at >= prevWeekStartISO && r.completed_at < prevWeekEndISO).length;

  return {
    dueCount:         dueCount || 0,
    todayVocabCount,
    todayReviewCount,
    todayReadCount,
    recentProgress:   (recentProgress || []).slice(0, 4),
    suggestions:      suggestionsRes || [],
    weekVocab,
    weekReviews: weekReview,
    weekReads:   weekRead,
    weekXP:      weekVocab * 5 + weekReview * 10 + weekRead * 50,
    weekStart:   weekStartDate,
    prevWeekVocab,
    prevWeekReviews: prevWeekReview,
    prevWeekReads:   prevWeekRead,
    prevWeekXP:      prevWeekVocab * 5 + prevWeekReview * 10 + prevWeekRead * 50,
    vocabByLang: (() => {
      const all = allVocabRows || [];
      const isJa = (v) => v.language === 'Japanese' || (!v.language && /[\u3040-\u30ff\u4e00-\u9fff]/.test(v.word_text));
      return {
        Japanese: all.filter(isJa).length,
        English: all.filter(v => !isJa(v)).length,
        total: all.length,
      };
    })(),
    seriesProgress: (() => {
      const doneSet = new Set((allCompleted || []).map(r => r.material_id));
      const groups = new Map(); // key = level|series
      for (const m of (seriesMaterials || [])) {
        const meta = parseTitle(m.title);
        if (!meta.level || !meta.series || meta.num == null) continue;
        const lang = m.processed_json?.metadata?.language || (/[A-Z]\d/.test(meta.level) ? 'English' : 'Japanese');
        const key = `${meta.level}|${meta.series}`;
        if (!groups.has(key)) groups.set(key, { level: meta.level, series: meta.series, language: lang, items: [] });
        groups.get(key).items.push({ id: m.id, title: m.title, num: meta.num });
      }
      const out = [];
      for (const g of groups.values()) {
        g.items.sort((a, b) => a.num - b.num);
        const completed = g.items.filter(i => doneSet.has(i.id)).length;
        const total = g.items.length;
        const next = g.items.find(i => !doneSet.has(i.id));
        out.push({
          level: g.level,
          series: g.series,
          language: g.language,
          completed,
          total,
          next: next ? { id: next.id, title: next.title, num: next.num } : null,
        });
      }
      return out;
    })(),
  };
}

/* ── 작은 진행 바 ── */
function ProgressBar({ pct, done }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', height: 5, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: done ? 'var(--accent)' : 'var(--primary-light)',
        borderRadius: 'var(--radius-full)',
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

export default function HomePage({ continueManifest = {}, refManifest = {} }) {
  const { user, profile, fetchProfile } = useAuth();
  const router = useRouter();

  // 강의 이어서 학습 — localStorage 진행 기록으로 다음 챕터 계산 (로그인 시 서버 병합)
  const [refProgress, setRefProgress] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => {
      const prog = {};
      for (const [name, ref] of Object.entries(continueManifest)) {
        try {
          prog[name] = {
            readSet: new Set(JSON.parse(localStorage.getItem(ref.readKey) || '[]')),
            checkMap: JSON.parse(localStorage.getItem(`${ref.readKey}_check`) || '{}'),
          };
        } catch {
          prog[name] = { readSet: new Set(), checkMap: {} };
        }
      }
      let lastVisit = null;
      try { lastVisit = JSON.parse(localStorage.getItem('ref_last_visit') || 'null'); } catch {}
      setRefProgress({ prog, lastVisit });
    };
    load();
    if (user?.id) {
      const readKeys = Object.fromEntries(
        Object.entries(continueManifest).map(([name, ref]) => [name, ref.readKey])
      );
      pullProgress(user.id, readKeys).then(changed => { if (changed) load(); });
    }
    // continueManifest는 서버에서 내려오는 정적 데이터
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const continueCard = useMemo(() => {
    if (!refProgress) return null;
    const { prog, lastVisit } = refProgress;
    // 언어 우선순위: 마지막 학습 언어 → 프로필 학습 언어 → 매니페스트 순서
    const order = [
      ...(lastVisit?.lang ? [lastVisit.lang] : []),
      ...(profile?.learning_language || []),
      ...Object.keys(continueManifest),
    ];
    const seen = new Set();
    for (const name of order) {
      if (seen.has(name) || !continueManifest[name]) continue;
      seen.add(name);
      const ref = continueManifest[name];
      const { readSet, checkMap } = prog[name] || { readSet: new Set(), checkMap: {} };
      // 활동이 전혀 없는 언어는 건너뜀 (신규 사용자는 시작 가이드가 담당)
      if (readSet.size === 0 && Object.keys(checkMap).length === 0) continue;
      let firstUnread = null;
      for (const l of ref.levels) {
        for (const ch of l.chapters) {
          const result = checkMap[ch.slug];
          if (result && !isPassed(result)) {
            return { ref, ch, levelLabel: l.label, mode: 'retry' };
          }
          if (!firstUnread && !readSet.has(ch.slug)) {
            firstUnread = { ref, ch, levelLabel: l.label, mode: 'next' };
          }
        }
      }
      if (firstUnread) return firstUnread;
    }
    return null;
  }, [refProgress, profile, continueManifest]);

  const { data, isLoading } = useQuery({
    queryKey: ['home', user?.id],
    queryFn:  () => fetchHomeData(user.id),
    enabled:  !!user,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  const todayVocab   = data?.todayVocabCount    ?? 0;
  const todayReviews = data?.todayReviewCount   ?? 0;
  const todayReads   = data?.todayReadCount     ?? 0;
  const dueCount     = data?.dueCount           ?? 0;

  const suggestion = useMemo(() => {
    const all = data?.suggestions || [];
    if (!profile || !all.length) return all[0] || null;
    const langs = profile.learning_language || [];
    const vocabByLang = data?.vocabByLang || {};

    // i+1 점수 계산: 선호 언어 > 이상적 레벨 일치 > 같은 레벨 근처
    const scored = all.map(s => {
      let score = 0;
      if (langs.includes(s.language)) score += 100;
      const count = vocabByLang[s.language] || 0;
      const ideal = getIdealLevel(s.language, count);
      if (s.level === ideal) score += 50;
      else if (s.level?.startsWith(ideal[0])) score += 20; // 같은 언어군 (N/A/B/C)
      return { ...s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0] || all[0];
  }, [data?.suggestions, data?.vocabByLang, profile]);

  if (!user) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <h2 style={{ marginBottom: '16px' }}>로그인이 필요합니다</h2>
      <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
    </div>
  );

  if (isLoading) return (
    <div className="page-container home-page" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 그리팅 스켈레톤 */}
      <div className="skeleton--card" style={{ height: 120 }}>
        <div className="skeleton-line--title skeleton-line" />
        <div className="skeleton-line--text skeleton-line" />
        <div className="skeleton-bar" />
      </div>
      {/* 미션 스켈레톤 */}
      <div className="skeleton--card" style={{ height: 180 }}>
        <div className="skeleton-line--title skeleton-line" />
        {[1,2,3].map(i => <div key={i} className="skeleton-line--text skeleton-line" style={{ marginBottom: 14 }} />)}
      </div>
      {/* 통계 스켈레톤 */}
      <div className="skeleton--card" style={{ height: 100 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      </div>
    </div>
  );

  const displayName   = profile?.display_name || '학습자';
  const hasNoLanguage = profile && !profile.learning_language?.length;
  const isNewUser     = dueCount === 0 && todayVocab === 0 && !data?.recentProgress?.length;

  return (
    <div className="page-container home-page home-layout" style={{ maxWidth: 720 }}>

      {/* 언어 미설정 배너 */}
      {hasNoLanguage && (
        <Link href="/profile" className="home-setup-banner">
          학습 언어와 수준을 설정하면 맞춤 추천을 받을 수 있어요 →
        </Link>
      )}

      {/* 진짜 처음 — 3단계 가이드 */}
      {isNewUser && (
        <div className="home-getting-started">
          <div className="home-getting-started__header">
            <div>
              <h2 className="home-getting-started__title">시작해볼까요, {displayName}님!</h2>
              <p className="home-getting-started__sub">3단계로 첫 학습 완료</p>
            </div>
          </div>
          <div className="home-gs-steps">
            {[
              { href: '/guide',     num: 1, title: '학습 로드맵', desc: '내 레벨 파악 →' },
              { href: '/materials', num: 2, title: '자료 읽기',   desc: 'AI 해부 분석 →' },
              { href: '/vocab',     num: 3, title: '단어 복습',   desc: 'FSRS 기억 강화 →' },
            ].map(s => (
              <Link key={s.num} href={s.href} className="home-gs-step">
                <span className="home-gs-step__num">{s.num}</span>
                <div>
                  <div className="home-gs-step__title">{s.title}</div>
                  <div className="home-gs-step__desc">{s.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ① 그리팅 — 인사 + 한 줄 (상태 수치·스트릭은 현황 스택이 담당) */}
      <div className="home-greeting">
        <h1 className="home-greeting__name">안녕하세요, {displayName}님</h1>
        <p className="home-greeting__sub">{
          (data?.vocabByLang?.total || 0) === 0 ? '첫 단어를 모아보러 가볼까요?'
          : '오늘도 한 걸음, 이어가 볼까요?'
        }</p>
      </div>

      {/* 강의 이어서 학습 — 챕터 진행 기록 기반 (미통과 재도전 우선) */}
      {continueCard && (
        <Link
          href={`${continueCard.ref.base}/grammar/${continueCard.ch.slug}`}
          className="lessons-continue"
        >
          <span className="lessons-continue__body">
            <span className="lessons-continue__kicker">
              {continueCard.mode === 'retry' ? '교재 재도전 — 패턴 체크 미통과' : '교재 이어서 학습'} · {continueCard.ref.name}
            </span>
            <span className="lessons-continue__title">#{continueCard.ch.order} {continueCard.ch.title}</span>
          </span>
          <span className="lessons-continue__meta">{continueCard.levelLabel} →</span>
        </Link>
      )}

      {/* 오늘 읽기 — 진행 중 시리즈가 없을 때만 */}
      {(() => {
        const inProgress = (data?.seriesProgress || []).some(s =>
          (profile?.learning_language || ['Japanese']).includes(s.language) && s.completed > 0 && s.next
        );
        if (inProgress || !suggestion) return null;
        const vocabByLang = data?.vocabByLang || {};
        const count = vocabByLang[suggestion.language] || 0;
        const idealLevel = getIdealLevel(suggestion.language, count);
        const isIdeal = suggestion.level === idealLevel;
        return (
          <div className="card" style={{
            padding: '20px 22px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--primary)',
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, marginBottom: 6 }}>
              오늘 이걸 읽어보세요
            </div>
            <h2 style={{ fontSize: '1.15rem', margin: '0 0 8px', lineHeight: 1.4 }}>
              {suggestion.title}
            </h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              {isIdeal && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>맞춤 </span>}
              {suggestion.language === 'Japanese' ? '일본어' : '영어'} {suggestion.level}
              {suggestion.channel_name && ` · ${suggestion.channel_name}`}
            </div>
            <Button
              onClick={() => suggestion.material_id
                ? router.push(`/viewer/${suggestion.material_id}`)
                : router.push(`/materials/add?suggestion=${suggestion.id}`)
              }
            >
              {suggestion.material_id ? '바로 읽기 →' : '분석하고 읽기 →'}
            </Button>
          </div>
        );
      })()}

      <ProfileStats refManifest={refManifest} />

    </div>
  );
}
