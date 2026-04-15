'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { awardXP, getXPLevel, getLevelProgress, getXPToNextLevel } from '../lib/xp';
import { useCelebration } from '../lib/CelebrationContext';
import Button from '../components/Button';

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

const DAILY_CHALLENGES = [
  { icon: '🔥', title: '어려운 단어 정복', desc: '3번 이상 틀린 단어를 복습하세요', xp: 30, href: '/vocab', cta: '복습하기',
    progress: (d) => ({ current: d.todayReviewCount, target: 3 }) },
  { icon: '📖', title: '자료 완독 도전', desc: '자료 1편을 끝까지 읽어보세요', xp: 50, href: '/materials', cta: '읽기 시작',
    progress: (d) => ({ current: d.todayReadCount, target: 1 }) },
  { icon: '⭐', title: '단어 수집가', desc: '오늘 새 단어 10개를 모아보세요', xp: 25, href: '/materials', cta: '자료 보기',
    progress: (d) => ({ current: d.todayVocabCount, target: 10 }) },
  { icon: '🧠', title: '복습 마라톤', desc: '단어 10개 이상 복습하세요', xp: 40, href: '/vocab', cta: '복습하기',
    progress: (d) => ({ current: d.todayReviewCount, target: 10 }) },
  { icon: '💬', title: '커뮤니티 참여', desc: '포럼에 글이나 댓글을 남겨보세요', xp: 20, href: '/forum', cta: '포럼 가기',
    progress: (d) => ({ current: d.todayForumCount, target: 1 }) },
  { icon: '🏆', title: '올라운드 학습자', desc: '읽기 + 복습 + 수집 모두 달성하세요', xp: 60, href: '/home', cta: '현황 보기',
    progress: (d) => ({ current: Math.min(d.todayReadCount, 1) + Math.min(d.todayReviewCount, 1) + Math.min(d.todayVocabCount, 1), target: 3 }) },
  { icon: '📝', title: '문법 탐구', desc: '뷰어에서 AI 문법 해설을 받아보세요', xp: 20, href: '/materials', cta: '자료 보기',
    progress: (d) => ({ current: d.todayGrammarCount, target: 1 }) },
];

function getDailyChallenge() {
  const today = new Date().toISOString().slice(0, 10);
  // Simple date-based seed
  const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
  return DAILY_CHALLENGES[seed % DAILY_CHALLENGES.length];
}

async function fetchLeaderboard() {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, xp, streak_count')
    .order('xp', { ascending: false })
    .limit(5);
  return data || [];
}

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

  const heatmapStart = new Date();
  heatmapStart.setHours(0, 0, 0, 0);
  heatmapStart.setDate(heatmapStart.getDate() - 83);

  // 5 queries instead of 10 — vocab stats are derived client-side from vocabRows
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
  ] = await Promise.all([
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).lte('next_review_at', now),
    supabase.from('user_vocabulary').select('created_at, last_reviewed_at, language, word_text')
      .eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
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
  ]);

  const rows = vocabRows || [];
  const reads = readProgressRows || [];

  // Derive all vocab stats client-side
  let todayVocabCount = 0, todayReviewCount = 0, weekVocab = 0, weekReview = 0;
  let prevWeekVocab = 0, prevWeekReview = 0;
  const heatmapDayCounts = {};

  for (const v of rows) {
    const createdDay = v.created_at.slice(0, 10);
    heatmapDayCounts[createdDay] = (heatmapDayCounts[createdDay] || 0) + 1;
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
    heatmapDayCounts,
    vocabByLang: (() => {
      const all = allVocabRows || [];
      const isJa = (v) => v.language === 'Japanese' || (!v.language && /[\u3040-\u30ff\u4e00-\u9fff]/.test(v.word_text));
      return {
        Japanese: all.filter(isJa).length,
        English: all.filter(v => !isJa(v)).length,
        total: all.length,
      };
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
  const toast = useToast();
  const { checkLevelUp } = useCelebration();
  const [challengeClaimed, setChallengeClaimed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['home', user?.id],
    queryFn:  () => fetchHomeData(user.id),
    enabled:  !!user,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true, // 챌린지 진행도 실시간 갱신
  });

  const { data: leaders = [] } = useQuery({
    queryKey: ['leaderboard-home'],
    queryFn:  fetchLeaderboard,
    staleTime: 1000 * 60 * 5,
  });

  const xp         = profile?.xp ?? 0;
  const xpLevel    = getXPLevel(xp);
  const xpProgress = getLevelProgress(xp);
  const xpToNext   = getXPToNextLevel(xp);

  const goalReview = profile?.goal_review ?? 5;
  const goalWords  = profile?.goal_words  ?? 5;
  const goalRead   = profile?.goal_read   ?? 1;

  const todayVocab   = data?.todayVocabCount    ?? 0;
  const todayReviews = data?.todayReviewCount   ?? 0;
  const todayReads   = data?.todayReadCount     ?? 0;
  const dueCount     = data?.dueCount           ?? 0;

  const MISSIONS = [
    { icon: '🧠', label: '단어 복습', goal: goalReview, current: todayReviews, href: '/vocab',      cta: '복습하기' },
    { icon: '⭐', label: '단어 수집', goal: goalWords,  current: todayVocab,   href: '/materials', cta: '자료 보기' },
    { icon: '📖', label: '자료 완독', goal: goalRead,   current: todayReads,   href: '/materials', cta: '읽기 시작' },
  ];
  const doneCount = MISSIONS.filter(m => m.current >= m.goal).length;

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

  return (
    <div className="page-container home-page home-layout" style={{ maxWidth: 720 }}>

      {/* 언어 미설정 배너 */}
      {hasNoLanguage && (
        <Link href="/profile" className="home-setup-banner">
          ⚙️ 학습 언어와 수준을 설정하면 맞춤 추천을 받을 수 있어요 →
        </Link>
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
        <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ⚡ <strong>Lv.{xpLevel}</strong> · {xp.toLocaleString('ko-KR')} XP
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ⭐ <strong>{data?.vocabByLang ? Object.values(data.vocabByLang).reduce((a, b) => a + b, 0) : 0}</strong> 수집
          </span>
          {dueCount > 0 && (
            <span style={{ fontSize: '0.85rem', color: 'var(--warning)', fontWeight: 600 }}>
              🧠 {dueCount} 복습 대기
            </span>
          )}
        </div>
      </div>

      {/* ② 오늘 읽기 — 가장 큰 포커스 */}
      {suggestion && (() => {
        const vocabByLang = data?.vocabByLang || {};
        const count = vocabByLang[suggestion.language] || 0;
        const idealLevel = getIdealLevel(suggestion.language, count);
        const isIdeal = suggestion.level === idealLevel;
        return (
          <div className="card" style={{
            padding: '24px 20px',
            background: 'linear-gradient(135deg, var(--primary-glow) 0%, var(--bg-card) 60%)',
            border: '1px solid var(--primary)',
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
