'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { getXPLevel, getLevelProgress, getXPToNextLevel } from '../lib/xp';

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

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
    <div className="page-container home-page" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>

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
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-elevated) 0%, color-mix(in srgb, var(--primary) 10%, var(--bg-card)) 100%)',
        border: '1px solid var(--border-hover)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 3 }}>
              안녕하세요, {displayName}님 👋
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>오늘도 꾸준히 언어를 해부해봐요</p>
          </div>
          {streak > 0 && (
            <div className="streak-badge">
              <span className="streak-badge__fire">🔥</span>
              <span className="streak-badge__count">{streak}</span>
              <span className="streak-badge__label">일 연속</span>
            </div>
          )}
        </div>

        {/* XP bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--primary-light)', fontWeight: 700, flexShrink: 0 }}>
            ⚡ Lv.{xpLevel}
          </span>
          <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${xpProgress}%`, background: 'linear-gradient(90deg, var(--primary), var(--primary-light))', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            {xpToNext ? `${xpToNext} XP` : '최고 레벨'}
          </span>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          총 {xp.toLocaleString('ko-KR')} XP 획득
        </div>
      </div>

      {/* ── ② 오늘의 학습 ── */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>오늘의 학습</h2>
          <span style={{ fontSize: '0.78rem', color: doneCount === MISSIONS.length ? 'var(--accent)' : 'var(--text-muted)', fontWeight: doneCount === MISSIONS.length ? 700 : 400 }}>
            {doneCount === MISSIONS.length ? '🎉 전부 완료!' : `${doneCount} / ${MISSIONS.length} 완료`}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {MISSIONS.map(m => {
            const pct  = Math.min(100, Math.round((m.current / m.goal) * 100));
            const done = m.current >= m.goal;
            return (
              <div key={m.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{done ? '✅' : m.icon}</span>
                  <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: done ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: done ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {m.current} / {m.goal}
                  </span>
                  {!done && (
                    <Link href={m.href} className="btn btn--primary btn--sm" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>
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
            <div style={{ margin: '18px 0 14px', borderTop: '1px solid var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>📰</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                  오늘의 추천 · {suggestion.language === 'Japanese' ? '🇯🇵' : '🇬🇧'} {suggestion.level}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {suggestion.title}
                </div>
              </div>
              <button className="btn btn--accent btn--sm" style={{ flexShrink: 0 }}
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

      {/* ── ③ 이번 주 통계 ── */}
      {data && (
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>이번 주 활동</h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {data.weekStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { icon: '⭐', label: '단어', value: data.weekVocab,   unit: '개' },
              { icon: '🧠', label: '복습', value: data.weekReviews, unit: '회' },
              { icon: '📖', label: '완독', value: data.weekReads,   unit: '편' },
              { icon: '✨', label: 'XP',   value: data.weekXP,      unit: '' },
            ].map(({ icon, label, value, unit }) => (
              <div key={label} style={{
                textAlign: 'center', padding: '10px 4px',
                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: '1.1rem', marginBottom: 3 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: value > 0 ? 'var(--primary-light)' : 'var(--text-muted)' }}>
                  {value}{unit}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ④ 최근 자료 + 랭킹 (2열) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>

        {/* 최근 읽은 자료 */}
        {data?.recentProgress?.length > 0 && (
          <div className="card" style={{ padding: '18px 20px' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>최근 읽은 자료</h2>
            <div className="home-recent-list">
              {data.recentProgress.map(p => {
                const mat  = p.reading_materials;
                if (!mat) return null;
                const lang = mat.processed_json?.metadata?.language;
                return (
                  <Link key={p.material_id} href={`/viewer/${p.material_id}`} className="home-recent-item">
                    <div className="home-recent-item__left">
                      <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{lang === 'English' ? '🇬🇧' : '🇯🇵'}</span>
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
          <div className="card" style={{ padding: '18px 20px' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>🏆 랭킹 TOP 5</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {leaders.map((entry, idx) => {
                const isMe = entry.id === user?.id;
                const rank = idx + 1;
                return (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: isMe ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-secondary))' : 'var(--bg-secondary)',
                    border: `1px solid ${isMe ? 'var(--accent)' : 'transparent'}`,
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <span style={{ minWidth: 24, textAlign: 'center', fontSize: rank <= 3 ? '0.95rem' : '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {rank <= 3 ? RANK_MEDAL[rank - 1] : `#${rank}`}
                    </span>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      background: isMe ? 'var(--accent)' : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.78rem', fontWeight: 700,
                      color: isMe ? '#fff' : 'var(--text-secondary)',
                    }}>
                      {entry.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.display_name || '익명'}
                      {isMe && <span style={{ marginLeft: 5, fontSize: '0.6rem', background: 'var(--accent)', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>나</span>}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, flexShrink: 0, color: rank <= 3 ? ['#f7c948','#adb5bd','#cd7f32'][rank-1] : 'var(--text-secondary)' }}>
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
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>학습 히트맵</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {totalActive}일 활동 · {totalWords}개 단어
              </span>
            </div>
            <div className="home-heatmap-scroll" style={{ overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              <span>적음</span>
              {['var(--bg-secondary)','var(--primary-glow)','var(--primary)','var(--accent)'].map((c, i) => (
                <span key={i} style={{ width: 9, height: 9, background: c, borderRadius: 2, display: 'inline-block' }} />
              ))}
              <span>많음</span>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
