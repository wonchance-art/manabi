'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { getXPLevel, getLevelProgress, getXPToNextLevel } from '../lib/xp';

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

const DAILY_CHALLENGES = [
  { icon: '🔥', title: '어려운 단어 정복', desc: '3번 이상 틀린 단어를 복습하세요', xp: 30, href: '/vocab', cta: '복습하기', check: (d) => d.todayReviewCount >= 3 },
  { icon: '📖', title: '자료 완독 도전', desc: '자료 1편을 끝까지 읽어보세요', xp: 50, href: '/materials', cta: '읽기 시작', check: (d) => d.todayReadCount >= 1 },
  { icon: '⭐', title: '단어 수집가', desc: '오늘 새 단어 10개를 모아보세요', xp: 25, href: '/materials', cta: '자료 보기', check: (d) => d.todayVocabCount >= 10 },
  { icon: '🧠', title: '복습 마라톤', desc: '단어 10개 이상 복습하세요', xp: 40, href: '/vocab', cta: '복습하기', check: (d) => d.todayReviewCount >= 10 },
  { icon: '💬', title: '커뮤니티 참여', desc: '포럼에 글이나 댓글을 남겨보세요', xp: 20, href: '/forum', cta: '포럼 가기', check: (d) => d.todayForumCount >= 1 },
  { icon: '🏆', title: '올라운드 학습자', desc: '읽기 + 복습 + 수집 모두 달성하세요', xp: 60, href: '/home', cta: '현황 보기', check: (d) => d.todayReadCount >= 1 && d.todayReviewCount >= 1 && d.todayVocabCount >= 1 },
  { icon: '📝', title: '문법 탐구', desc: '뷰어에서 AI 문법 해설을 받아보세요', xp: 20, href: '/materials', cta: '자료 보기', check: (d) => d.todayGrammarCount >= 1 },
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
  ] = await Promise.all([
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).lte('next_review_at', now),
    supabase.from('user_vocabulary').select('created_at, last_reviewed_at')
      .eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
    supabase.from('reading_progress')
      .select('material_id, is_completed, updated_at, completed_at, reading_materials(id, title, processed_json)')
      .eq('user_id', userId).order('updated_at', { ascending: false }).limit(20),
    fetch('/api/suggestions/today').then(r => r.ok ? r.json() : []),
    supabase.from('reading_progress').select('completed_at')
      .eq('user_id', userId).eq('is_completed', true).gte('completed_at', weekStartISO),
    supabase.from('forum_posts').select('*', { count: 'exact', head: true })
      .eq('author_id', userId).gte('created_at', todayStart),
    supabase.from('forum_comments').select('*', { count: 'exact', head: true })
      .eq('author_id', userId).gte('created_at', todayStart),
    supabase.from('grammar_notes').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', todayStart),
  ]);

  const rows = vocabRows || [];
  const reads = readProgressRows || [];

  // Derive all vocab stats client-side
  let todayVocabCount = 0, todayReviewCount = 0, weekVocab = 0, weekReview = 0;
  const heatmapDayCounts = {};

  for (const v of rows) {
    const createdDay = v.created_at.slice(0, 10);
    heatmapDayCounts[createdDay] = (heatmapDayCounts[createdDay] || 0) + 1;
    if (v.created_at >= todayStart) todayVocabCount++;
    if (v.created_at >= weekStartISO) weekVocab++;
    if (v.last_reviewed_at && v.last_reviewed_at >= todayStart) todayReviewCount++;
    if (v.last_reviewed_at && v.last_reviewed_at >= weekStartISO) weekReview++;
  }

  // Derive read stats
  const todayReadCount = reads.filter(r => r.completed_at >= todayStart).length;
  const weekRead = reads.length;

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
    heatmapDayCounts,
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
  const { user, profile } = useAuth();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['home', user?.id],
    queryFn:  () => fetchHomeData(user.id),
    enabled:  !!user,
    staleTime: 1000 * 60,
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

  const suggestion = useMemo(() => {
    const all = data?.suggestions || [];
    if (!profile || !all.length) return all[0] || null;
    const langs = profile.learning_language || [];
    return all.find(s => langs.includes(s.language)) || all[0];
  }, [data?.suggestions, profile]);

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
    <div className="page-container home-page home-layout">

      {/* ── 언어 미설정 배너 ── */}
      {hasNoLanguage && (
        <Link href="/profile" className="home-setup-banner">
          ⚙️ 학습 언어와 수준을 설정하면 맞춤 추천을 받을 수 있어요 →
        </Link>
      )}

      {/* ── 신규 유저 가이드 ── */}
      {isNewUser && (
        <div className="home-getting-started">
          <div className="home-getting-started__header">
            <span className="home-getting-started__emoji">🚀</span>
            <div>
              <h2 className="home-getting-started__title">시작이 반이에요, {displayName}님!</h2>
              <p className="home-getting-started__sub">3단계로 첫 학습을 완료해봐요</p>
            </div>
          </div>
          <div className="home-gs-steps">
            {[
              { href: '/guide',     num: 1, title: '학습 로드맵 확인',    desc: '내 레벨에 맞는 가이드 보기 →' },
              { href: '/materials', num: 2, title: '오늘의 추천 자료 읽기', desc: 'AI가 모든 단어를 해부해 드려요 →' },
              { href: '/vocab',     num: 3, title: '저장한 단어 복습',    desc: 'FSRS 알고리즘이 기억을 강화해요 →' },
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

      {/* ── ① 그리팅 + XP ── */}
      <div className="home-greeting">
        <div className="home-greeting__top">
          <div>
            <h1 className="home-greeting__name">안녕하세요, {displayName}님 👋</h1>
            <p className="home-greeting__sub">오늘도 꾸준히 언어를 해부해봐요</p>
          </div>
          <div className="streak-area">
            {streak > 0 && (
              <div className="streak-badge">
                <span className="streak-badge__fire">🔥</span>
                <span className="streak-badge__count">{streak}</span>
                <span className="streak-badge__label">일 연속</span>
              </div>
            )}
            {(profile?.streak_freeze_count ?? 0) > 0 && (
              <div className="streak-freeze-indicator" title="스트릭 프리즈 티켓">
                🛡️ ×{profile.streak_freeze_count}
              </div>
            )}
          </div>
        </div>

        <div className="home-xp">
          <span className="home-xp__level">⚡ Lv.{xpLevel}</span>
          <div className="home-xp__track">
            <div className="home-xp__fill" style={{ width: `${xpProgress}%` }} />
          </div>
          <span className="home-xp__next">{xpToNext ? `${xpToNext} XP` : '최고 레벨'}</span>
        </div>
        <div className="home-xp__total">총 {xp.toLocaleString('ko-KR')} XP 획득</div>
      </div>

      {/* ── 복습 알림 배너 ── */}
      {dueCount > 0 && todayReviews === 0 && (
        <Link href="/vocab" className="home-review-banner">
          <span className="home-review-banner__icon">🧠</span>
          <div className="home-review-banner__text">
            <strong>{dueCount}개 단어</strong>가 복습을 기다리고 있어요
          </div>
          <span className="home-review-banner__cta">복습하기 →</span>
        </Link>
      )}

      {/* ── ② 오늘의 학습 ── */}
      <div className="card home-card">
        <div className="home-section-head">
          <h2 className="home-section-title">오늘의 학습</h2>
          <span className={`home-section-meta ${doneCount === MISSIONS.length ? 'home-section-meta--done' : ''}`}>
            {doneCount === MISSIONS.length ? '🎉 전부 완료!' : `${doneCount} / ${MISSIONS.length} 완료`}
          </span>
        </div>

        <div className="home-missions">
          {MISSIONS.map(m => {
            const pct  = Math.min(100, Math.round((m.current / m.goal) * 100));
            const done = m.current >= m.goal;
            return (
              <div key={m.label}>
                <div className="home-mission-row">
                  <span className="home-mission-row__icon">{done ? '✅' : m.icon}</span>
                  <span className={`home-mission-row__label ${done ? 'home-mission-row__label--done' : ''}`}>
                    {m.label}
                  </span>
                  <span className={`home-mission-row__count ${done ? 'home-mission-row__count--done' : ''}`}>
                    {m.current} / {m.goal}
                  </span>
                  {!done && (
                    <Link href={m.href} className="btn btn--primary btn--sm home-mission-row__cta">
                      {m.cta}
                    </Link>
                  )}
                </div>
                <ProgressBar pct={pct} done={done} />
              </div>
            );
          })}
        </div>

        {/* 오늘의 추천 */}
        {suggestion && (
          <>
            <div className="home-divider" />
            <div className="home-suggestion">
              <span className="home-suggestion__icon">📰</span>
              <div className="home-suggestion__info">
                <div className="home-suggestion__meta">
                  오늘의 추천 · {suggestion.language === 'Japanese' ? '🇯🇵' : '🇬🇧'} {suggestion.level}
                </div>
                <div className="home-suggestion__title">{suggestion.title}</div>
              </div>
              <button className="btn btn--accent btn--sm home-suggestion__btn"
                onClick={() => suggestion.material_id
                  ? router.push(`/viewer/${suggestion.material_id}`)
                  : router.push(`/materials/add?suggestion=${suggestion.id}`)
                }>
                {suggestion.material_id ? '바로 읽기' : '읽기 시작'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── 오늘의 도전 ── */}
      {data && (() => {
        const challenge = getDailyChallenge();
        const isDone = challenge.check({
          todayVocabCount: todayVocab,
          todayReviewCount: todayReviews,
          todayReadCount: todayReads,
          todayForumCount: data.todayForumCount ?? 0,
          todayGrammarCount: data.todayGrammarCount ?? 0,
        });
        const storageKey = `as_challenge_${new Date().toISOString().slice(0, 10)}`;
        const claimed = typeof window !== 'undefined' && localStorage.getItem(storageKey) === '1';

        return (
          <div className={`card home-card home-challenge ${isDone ? 'home-challenge--done' : ''}`}>
            <div className="home-challenge__header">
              <span className="home-challenge__icon">{isDone ? '✅' : challenge.icon}</span>
              <div className="home-challenge__info">
                <div className="home-challenge__badge">일일 도전</div>
                <h3 className="home-challenge__title">{challenge.title}</h3>
                <p className="home-challenge__desc">{challenge.desc}</p>
              </div>
              <div className="home-challenge__reward">
                <span className="home-challenge__xp">+{challenge.xp}</span>
                <span className="home-challenge__xp-label">XP</span>
              </div>
            </div>
            {isDone ? (
              <div className="home-challenge__done-msg">
                {claimed ? '🎉 보너스 XP를 받았어요!' : '달성! 내일 또 도전해보세요.'}
              </div>
            ) : (
              <Link href={challenge.href} className="btn btn--accent btn--sm home-challenge__cta">
                {challenge.cta} →
              </Link>
            )}
          </div>
        );
      })()}

      {/* ── ③ 이번 주 통계 ── */}
      {data && (
        <div className="card home-card">
          <div className="home-section-head">
            <h2 className="home-section-title">이번 주 활동</h2>
            <span className="home-section-meta">
              {data.weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~
            </span>
          </div>
          <div className="home-stat-grid">
            {[
              { icon: '⭐', label: '단어', value: data.weekVocab,   unit: '개' },
              { icon: '🧠', label: '복습', value: data.weekReviews, unit: '회' },
              { icon: '📖', label: '완독', value: data.weekReads,   unit: '편' },
              { icon: '✨', label: 'XP',   value: data.weekXP,      unit: '' },
            ].map(({ icon, label, value, unit }) => (
              <div key={label} className="home-stat-cell">
                <div className="home-stat-cell__icon">{icon}</div>
                <div className={`home-stat-cell__value ${value > 0 ? 'home-stat-cell__value--active' : ''}`}>
                  {value}{unit}
                </div>
                <div className="home-stat-cell__label">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ④ 최근 자료 + 랭킹 (2열) ── */}
      <div className="home-two-col">
        {/* 최근 읽은 자료 */}
        {data?.recentProgress?.length > 0 && (
          <div className="card home-card">
            <h2 className="home-section-title" style={{ marginBottom: 12 }}>최근 읽은 자료</h2>
            <div className="home-recent-list">
              {data.recentProgress.map(p => {
                const mat  = p.reading_materials;
                if (!mat) return null;
                const lang = mat.processed_json?.metadata?.language;
                return (
                  <Link key={p.material_id} href={`/viewer/${p.material_id}`} className="home-recent-item">
                    <div className="home-recent-item__left">
                      <span className="home-recent-item__flag">{lang === 'English' ? '🇬🇧' : '🇯🇵'}</span>
                      <span className="home-recent-item__title">{mat.title}</span>
                    </div>
                    <span className={`home-recent-item__status ${p.is_completed ? 'home-recent-item__status--done' : ''}`}>
                      {p.is_completed ? '완료' : '이어읽기'}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* 랭킹 TOP 5 */}
        {leaders.length > 0 && (
          <div className="card home-card">
            <h2 className="home-section-title" style={{ marginBottom: 12 }}>🏆 랭킹 TOP 5</h2>
            <div className="home-rank-list">
              {leaders.map((entry, idx) => {
                const isMe = entry.id === user?.id;
                const rank = idx + 1;
                return (
                  <div key={entry.id} className={`home-rank-entry ${isMe ? 'home-rank-entry--me' : ''}`}>
                    <span className={`home-rank-entry__rank ${rank <= 3 ? 'home-rank-entry__rank--medal' : ''}`}>
                      {rank <= 3 ? RANK_MEDAL[rank - 1] : `#${rank}`}
                    </span>
                    <div className={`home-rank-entry__avatar ${isMe ? 'home-rank-entry__avatar--me' : ''}`}>
                      {entry.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="home-rank-entry__name">
                      {entry.display_name || '익명'}
                      {isMe && <span className="home-rank-entry__me-tag">나</span>}
                    </span>
                    <span className="home-rank-entry__xp" data-rank={rank}>
                      {(entry.xp ?? 0).toLocaleString('ko-KR')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── ⑤ 학습 히트맵 ── */}
      {data?.heatmapDayCounts && (() => {
        const dc   = data.heatmapDayCounts;
        const COLS = 12, ROWS = 7, CELL = 13, GAP = 3;
        const today = new Date(); today.setHours(0,0,0,0);
        const todayKey = today.toISOString().slice(0,10);
        const days = Array.from({ length: COLS * ROWS }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (COLS * ROWS - 1 - i));
          return d.toISOString().slice(0,10);
        });
        const maxCount = Math.max(1, ...Object.values(dc));
        const totalActive = Object.keys(dc).length;
        const totalWords  = Object.values(dc).reduce((a, b) => a + b, 0);
        const cellColor = n => {
          if (!n) return 'var(--bg-secondary)';
          const lvl = Math.ceil((n / maxCount) * 4);
          return ['','var(--primary-glow)','var(--primary)','var(--accent)','var(--accent)'][lvl] || 'var(--accent)';
        };
        const W = COLS * (CELL + GAP) - GAP;
        const H = ROWS * (CELL + GAP) - GAP;
        return (
          <div className="card home-card">
            <div className="home-section-head">
              <h2 className="home-section-title">학습 히트맵</h2>
              <span className="home-section-meta">{totalActive}일 활동 · {totalWords}개 단어</span>
            </div>
            <div className="home-heatmap-scroll">
              <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="home-heatmap-svg">
                {days.map((day, i) => (
                  <rect key={day}
                    x={Math.floor(i / ROWS) * (CELL + GAP)}
                    y={(i % ROWS) * (CELL + GAP)}
                    width={CELL} height={CELL} rx={2}
                    fill={cellColor(dc[day] || 0)}
                    opacity={day > todayKey ? 0 : 1}
                  >
                    <title>{day}: {dc[day] || 0}개</title>
                  </rect>
                ))}
              </svg>
            </div>
            <div className="home-heatmap-legend">
              <span>적음</span>
              {['var(--bg-secondary)','var(--primary-glow)','var(--primary)','var(--accent)'].map((c, i) => (
                <span key={i} className="home-heatmap-legend__dot" style={{ background: c }} />
              ))}
              <span>많음</span>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
