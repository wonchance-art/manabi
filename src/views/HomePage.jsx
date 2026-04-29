'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { getXPLevel, getLevelProgress, getXPToNextLevel } from '../lib/xp';
import Button from '../components/Button';
import { parseTitle } from '../lib/seriesMeta';

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
    { count: todayForumPosts },
    { count: todayForumComments },
    { count: todayGrammarCount },
    { data: allVocabRows },
    { data: publicMaterials },
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
    supabase.from('forum_posts').select('*', { count: 'exact', head: true })
      .eq('author_id', userId).gte('created_at', todayStart),
    supabase.from('forum_comments').select('*', { count: 'exact', head: true })
      .eq('author_id', userId).gte('created_at', todayStart),
    supabase.from('grammar_notes').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', todayStart),
    supabase.from('user_vocabulary').select('language, word_text')
      .eq('user_id', userId),
    supabase.from('reading_materials')
      .select('id, title, language, level')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(40),
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
    todayForumCount:  (todayForumPosts || 0) + (todayForumComments || 0),
    todayGrammarCount: todayGrammarCount || 0,
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
    publicMaterials: publicMaterials || [],
    readMaterialIds: (recentProgress || []).filter(r => r.is_completed).map(r => r.material_id),
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

export default function HomePage() {
  const { user, profile, fetchProfile } = useAuth();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['home', user?.id],
    queryFn:  () => fetchHomeData(user.id),
    enabled:  !!user,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  const xp         = profile?.xp ?? 0;
  const xpLevel    = getXPLevel(xp);
  const xpProgress = getLevelProgress(xp);
  const xpToNext   = getXPToNextLevel(xp);

  const todayVocab   = data?.todayVocabCount    ?? 0;
  const todayReviews = data?.todayReviewCount   ?? 0;
  const todayReads   = data?.todayReadCount     ?? 0;
  const dueCount     = data?.dueCount           ?? 0;

  // 사용자 vocab 수 기반 현재 레벨 역산 → i+1 추천
  // JLPT: N5(800)→N4(1500)→N3(3750)→N2(6000)→N1(10000)
  // CEFR: A1(500)→A2(1000)→B1(2000)→B2(4000)→C1(7000)→C2(10000)
  const JP_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const JP_THRESHOLDS = [0, 800, 1500, 3750, 6000, 10000];
  const EN_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const EN_THRESHOLDS = [0, 500, 1000, 2000, 4000, 7000, 10000];

  const getIdealLevel = (lang, count) => {
    const thresholds = lang === 'Japanese' ? JP_THRESHOLDS : EN_THRESHOLDS;
    const labels = lang === 'Japanese' ? JP_LEVELS : EN_LEVELS;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (count >= thresholds[i]) return labels[Math.min(i, labels.length - 1)];
    }
    return labels[0];
  };

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
  const streak        = profile?.streak_count || 0;
  const hasNoLanguage = profile && !profile.learning_language?.length;
  const isNewUser     = dueCount === 0 && todayVocab === 0 && !data?.recentProgress?.length;

  // 첫 주 마일스톤 — 5/5 완료되면 자동 숨김
  const totalVocab     = data?.vocabByLang?.total ?? 0;
  const completedReads = (data?.weekReads ?? 0) + (data?.prevWeekReads ?? 0);
  const everReviews    = (data?.weekReviews ?? 0) + (data?.prevWeekReviews ?? 0);
  const JOURNEY = [
    { icon: '📖', label: '첫 자료 완독',    done: completedReads >= 1, href: '/materials' },
    { icon: '⭐', label: '단어 5개 저장',    done: totalVocab >= 5,     href: '/materials' },
    { icon: '🧠', label: '첫 단어 복습',    done: everReviews >= 1,    href: '/vocab' },
    { icon: '🔥', label: '3일 연속 학습',   done: streak >= 3,         href: '/materials' },
    { icon: '📚', label: '단어 20개 도달',  done: totalVocab >= 20,    href: '/materials' },
  ];
  const journeyDone = JOURNEY.filter(j => j.done).length;

  return (
    <div className="page-container home-page home-layout" style={{ maxWidth: 720 }}>

      {/* 언어 미설정 배너 */}
      {hasNoLanguage && (
        <Link href="/profile" className="home-setup-banner">
          ⚙️ 학습 언어와 수준을 설정하면 맞춤 추천을 받을 수 있어요 →
        </Link>
      )}

      {/* 첫 주 여정 — 5/5 완료되면 자동 숨김 */}
      {journeyDone < JOURNEY.length && (
        <div className="home-journey">
          <div className="home-journey__header">
            <span className="home-journey__title">🎯 첫 주 여정</span>
            <span className="home-journey__progress">{journeyDone} / {JOURNEY.length}</span>
          </div>
          <div className="home-journey__bar">
            <div className="home-journey__bar-fill" style={{ width: `${(journeyDone / JOURNEY.length) * 100}%` }} />
          </div>
          <ul className="home-journey__list">
            {JOURNEY.map(j => (
              <li key={j.label} className={`home-journey__item ${j.done ? 'is-done' : ''}`}>
                <span className="home-journey__check">{j.done ? '✓' : j.icon}</span>
                {j.done ? (
                  <span className="home-journey__label">{j.label}</span>
                ) : (
                  <Link href={j.href} className="home-journey__label home-journey__label--link">{j.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 신규 유저 3단계 가이드 (진짜 처음) */}
      {isNewUser && (
        <div className="home-getting-started">
          <div className="home-getting-started__header">
            <span className="home-getting-started__emoji">🚀</span>
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

      {/* ① 그리팅 + 간결한 상태 한 줄 */}
      <div className="home-greeting">
        <div className="home-greeting__top">
          <div>
            <h1 className="home-greeting__name">안녕하세요, {displayName}님 👋</h1>
            <p className="home-greeting__sub">오늘도 한 편 읽어볼까요?</p>
          </div>
          {streak > 0 && (
            <div className="streak-badge">
              <span className="streak-badge__fire">🔥</span>
              <span className="streak-badge__count">{streak}</span>
              <span className="streak-badge__label">일 연속</span>
            </div>
          )}
        </div>

        {/* 컴팩트 상태: Lv + 수집 단어 + 복습 대기 */}
        <div className="u-stat-line u-mt-md">
          <span>⚡ <strong>Lv.{xpLevel}</strong> · {xp.toLocaleString('ko-KR')} XP</span>
          <span>⭐ <strong>{data?.vocabByLang ? Object.values(data.vocabByLang).reduce((a, b) => a + b, 0) : 0}</strong> 수집</span>
          {dueCount > 0 && (
            <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
              🧠 {dueCount} 복습 대기
            </span>
          )}
        </div>
      </div>

      {/* ── 학습 진입점 (1순위만 노출) ──
          이어서 학습 > 오늘 읽기 (daily suggestion) > 내 레벨 추천
          진행 중 시리즈가 있으면 그곳으로 직진. 추천은 secondary */}
      {(() => {
        const all = data?.seriesProgress || [];
        const langs = profile?.learning_language || ['Japanese'];
        const inProgress = all.filter(s => langs.includes(s.language) && s.completed > 0 && s.next);
        inProgress.sort((a, b) => (b.completed / b.total) - (a.completed / a.total));
        const top = inProgress[0];
        if (!top) return null;
        const pct = Math.round((top.completed / top.total) * 100);
        return (
          <Link href={`/viewer/${top.next.id}`} className="home-continue-card">
            <div className="home-continue-card__head">
              <span className="home-continue-card__hint">이어서 학습</span>
              <span className="home-continue-card__progress">{top.completed} / {top.total}</span>
            </div>
            <div className="home-continue-card__series">{top.level} {top.series}</div>
            <div className="home-continue-card__bar">
              <div className="home-continue-card__bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="home-continue-card__next">{top.next.title}</div>
          </Link>
        );
      })()}

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
              📖 오늘 이걸 읽어보세요
            </div>
            <h2 style={{ fontSize: '1.15rem', margin: '0 0 8px', lineHeight: 1.4 }}>
              {suggestion.title}
            </h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              {isIdeal && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>🎯 맞춤 </span>}
              {suggestion.language === 'Japanese' ? '🇯🇵' : '🇬🇧'} {suggestion.level}
              {suggestion.channel_name && ` · ${suggestion.channel_name}`}
            </div>
            <Button
              onClick={() => suggestion.material_id
                ? router.push(`/viewer/${suggestion.material_id}`)
                : router.push(`/materials/add?suggestion=${suggestion.id}`)
              }
            >
              {suggestion.material_id ? '📖 바로 읽기 →' : '✨ 분석하고 읽기 →'}
            </Button>
          </div>
        );
      })()}

      {/* 내 레벨 추천 자료 — 진행 중 시리즈가 없을 때만 */}
      {(() => {
        const inProgress = (data?.seriesProgress || []).some(s =>
          (profile?.learning_language || ['Japanese']).includes(s.language) && s.completed > 0 && s.next
        );
        if (inProgress) return null;
        const all = data?.publicMaterials || [];
        const readIds = new Set(data?.readMaterialIds || []);
        const langs = profile?.learning_language || ['Japanese'];
        const vocabByLang = data?.vocabByLang || {};
        const idealByLang = Object.fromEntries(langs.map(l => [l, getIdealLevel(l, vocabByLang[l] || 0)]));
        const matched = all
          .filter(m => !readIds.has(m.id))
          .filter(m => langs.includes(m.language))
          .map(m => {
            const ideal = idealByLang[m.language];
            const score = m.level?.startsWith(ideal) ? 100 : (m.level?.[0] === ideal?.[0] ? 50 : 10);
            return { ...m, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        if (matched.length === 0) return null;
        return (
          <div className="card home-card">
            <h2 className="home-section-title" style={{ fontSize: '0.95rem', marginBottom: 12 }}>
              🎯 내 레벨 추천 자료
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matched.map(m => (
                <Link
                  key={m.id}
                  href={`/viewer/${m.id}`}
                  className="home-recent-item"
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {m.language === 'Japanese' ? '🇯🇵' : '🇬🇧'} {m.level || '레벨 미정'}
                    </div>
                  </div>
                  <span style={{ color: 'var(--primary)', fontSize: '0.82rem', flexShrink: 0 }}>읽기 →</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 기억 상태 요약 + 통계 더 보기 */}
      {dueCount > 0 || todayVocab > 0 ? (
        <Link href="/stats" className="card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', textDecoration: 'none', color: 'var(--text-primary)',
        }}>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.88rem' }}>
            <span>⭐ 수집 <strong>{todayVocab}</strong></span>
            <span>🧠 복습 <strong>{todayReviews}</strong></span>
            <span>📖 완독 <strong>{todayReads}</strong></span>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--primary)', flexShrink: 0 }}>통계 →</span>
        </Link>
      ) : null}

      {/* ③ 최근 읽던 자료 — compact 3개 */}
      {data?.recentProgress?.length > 0 && (
        <div className="card home-card">
          <h2 className="home-section-title" style={{ fontSize: '0.95rem', marginBottom: 12 }}>
            📚 최근 읽던 자료
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.recentProgress.slice(0, 3).map(r => r.reading_materials && (
              <Link
                key={r.material_id}
                href={`/viewer/${r.material_id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                  textDecoration: 'none', color: 'var(--text-primary)',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{r.is_completed ? '✅' : '📖'}</span>
                <span style={{ flex: 1, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.reading_materials.title}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(r.updated_at || r.completed_at).toLocaleDateString('ko-KR')}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/materials" className="btn btn--ghost btn--sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
            전체 자료 보기 →
          </Link>
        </div>
      )}

    </div>
  );
}
