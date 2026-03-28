'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Spinner from '../components/Spinner';

async function fetchHomeData(userId) {
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const [
    { count: dueCount },
    { count: todayVocabCount },
    { data: recentProgress },
    suggestionsRes,
  ] = await Promise.all([
    supabase
      .from('user_vocabulary')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_at', now),
    supabase
      .from('user_vocabulary')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${todayStr}T00:00:00`),
    supabase
      .from('reading_progress')
      .select('material_id, is_completed, updated_at, reading_materials(id, title, processed_json)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(3),
    fetch('/api/suggestions/today').then(r => r.ok ? r.json() : []),
  ]);

  return {
    dueCount: dueCount || 0,
    todayVocabCount: todayVocabCount || 0,
    recentProgress: recentProgress || [],
    suggestions: suggestionsRes || [],
  };
}

const DAILY_GOAL = 5;

export default function HomePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['home', user?.id],
    queryFn: () => fetchHomeData(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  const todayVocab = data?.todayVocabCount ?? 0;
  const goalPct = Math.min(100, Math.round((todayVocab / DAILY_GOAL) * 100));
  const dueCount = data?.dueCount ?? 0;

  // 레벨에 맞는 추천 1개만 노출
  const suggestion = useMemo(() => {
    const all = data?.suggestions || [];
    if (!profile || !all.length) return all[0] || null;
    const langs = profile.learning_language || [];
    const matched = all.find(s => langs.includes(s.language));
    return matched || all[0];
  }, [data?.suggestions, profile]);

  if (!user) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <h2 style={{ marginBottom: '16px' }}>로그인이 필요합니다</h2>
        <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
      </div>
    );
  }

  if (isLoading) return <div className="page-container"><Spinner message="대시보드 로딩 중..." /></div>;

  const displayName = profile?.display_name || '학습자';
  const streak = profile?.streak_count || 0;

  return (
    <div className="page-container home-page">
      {/* 인사 + 스트릭 */}
      <div className="home-greeting">
        <div>
          <h1 className="home-greeting__title">안녕하세요, {displayName}님 👋</h1>
          <p className="home-greeting__sub">오늘도 꾸준히 언어를 해부해봐요</p>
        </div>
        {streak > 0 && (
          <div className="streak-badge">
            <span className="streak-badge__fire">🔥</span>
            <span className="streak-badge__count">{streak}</span>
            <span className="streak-badge__label">일 연속</span>
          </div>
        )}
      </div>

      {/* 오늘의 할 일 */}
      <section className="home-section">
        <h2 className="home-section__title">📋 오늘의 할 일</h2>
        <div className="home-tasks">
          {/* 복습 카드 */}
          <div className={`home-task-card ${dueCount > 0 ? 'home-task-card--urgent' : 'home-task-card--done'}`}>
            <div className="home-task-card__left">
              <span className="home-task-card__icon">{dueCount > 0 ? '🧠' : '✅'}</span>
              <div>
                <div className="home-task-card__label">단어 복습</div>
                <div className="home-task-card__desc">
                  {dueCount > 0 ? `${dueCount}개 대기 중` : '오늘 복습 완료!'}
                </div>
              </div>
            </div>
            {dueCount > 0 && (
              <Link href="/vocab" className="btn btn--primary btn--sm">
                지금 복습하기
              </Link>
            )}
          </div>

          {/* 오늘의 단어 수집 목표 */}
          <div className="home-task-card home-task-card--goal">
            <div className="home-task-card__left">
              <span className="home-task-card__icon">⭐</span>
              <div>
                <div className="home-task-card__label">오늘 단어 수집</div>
                <div className="home-task-card__desc">{todayVocab} / {DAILY_GOAL}개</div>
              </div>
            </div>
            <div className="home-goal-ring" style={{ '--pct': goalPct }}>
              <svg viewBox="0 0 36 36" className="home-goal-ring__svg">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke="var(--accent)" strokeWidth="3"
                  strokeDasharray={`${(goalPct / 100) * 94.2} 94.2`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <span className="home-goal-ring__label">{goalPct}%</span>
            </div>
          </div>

          {/* 오늘의 추천 읽기 */}
          {suggestion && (
            <div className="home-task-card home-task-card--reading">
              <div className="home-task-card__left">
                <span className="home-task-card__icon">📰</span>
                <div>
                  <div className="home-task-card__label">오늘의 추천</div>
                  <div className="home-task-card__desc home-task-card__desc--title">{suggestion.title}</div>
                  <div className="home-task-card__meta">
                    {suggestion.language === 'Japanese' ? '🇯🇵' : '🇬🇧'} {suggestion.level}
                  </div>
                </div>
              </div>
              <button
                className="btn btn--accent btn--sm"
                onClick={() => suggestion.material_id
                  ? router.push(`/viewer/${suggestion.material_id}`)
                  : router.push(`/materials/add?suggestion=${suggestion.id}`)
                }
              >
                {suggestion.material_id ? '📖 바로 읽기' : '읽기 시작'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 최근 학습 자료 (이어읽기) */}
      {data?.recentProgress?.length > 0 && (
        <section className="home-section">
          <h2 className="home-section__title">📖 최근 읽은 자료</h2>
          <div className="home-recent-list">
            {data.recentProgress.map(p => {
              const mat = p.reading_materials;
              if (!mat) return null;
              const lang = mat.processed_json?.metadata?.language;
              return (
                <Link key={p.material_id} href={`/viewer/${p.material_id}`} className="home-recent-item">
                  <div className="home-recent-item__left">
                    <span>{lang === 'English' ? '🇬🇧' : '🇯🇵'}</span>
                    <span className="home-recent-item__title">{mat.title}</span>
                  </div>
                  <span className={`home-recent-item__status ${p.is_completed ? 'home-recent-item__status--done' : ''}`}>
                    {p.is_completed ? '✅ 완료' : '↩ 이어읽기'}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 빠른 이동 */}
      <section className="home-section">
        <h2 className="home-section__title">🔗 바로가기</h2>
        <div className="home-quick-links">
          <Link href="/materials" className="home-quick-link">
            <span className="home-quick-link__icon">📰</span>
            <span>자료실</span>
          </Link>
          <Link href="/vocab" className="home-quick-link">
            <span className="home-quick-link__icon">⭐</span>
            <span>단어장</span>
          </Link>
          <Link href="/guide" className="home-quick-link">
            <span className="home-quick-link__icon">🗺️</span>
            <span>학습 가이드</span>
          </Link>
          <Link href="/forum" className="home-quick-link">
            <span className="home-quick-link__icon">💬</span>
            <span>커뮤니티</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
