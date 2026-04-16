'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { getXPLevel, getLevelProgress } from '../lib/xp';
import { ACHIEVEMENTS } from '../lib/achievements';
import Button from '../components/Button';
import VocabStats from './VocabStats';

async function fetchStatsData(userId) {
  const heatmapStart = new Date();
  heatmapStart.setHours(0, 0, 0, 0);
  heatmapStart.setDate(heatmapStart.getDate() - 224);

  const [
    { count: readCount },
    { data: achievements },
    { data: heatmapRows },
    { data: allVocab },
  ] = await Promise.all([
    supabase.from('reading_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
    supabase.from('user_achievements').select('achievement_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('user_vocabulary').select('created_at').eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
    supabase.from('user_vocabulary').select('*').eq('user_id', userId),
  ]);

  const heatmapDayCounts = {};
  for (const v of (heatmapRows || [])) {
    const day = v.created_at.slice(0, 10);
    heatmapDayCounts[day] = (heatmapDayCounts[day] || 0) + 1;
  }

  const vocab = allVocab || [];
  const mastered = vocab.filter(v => (v.interval ?? 0) > 14).length;
  const reviewed = vocab.filter(v => v.last_reviewed_at).length;

  return {
    vocab,
    mastered,
    reviewed,
    readCount: readCount || 0,
    earnedIds: new Set((achievements || []).map(a => a.achievement_id)),
    earnedDates: Object.fromEntries((achievements || []).map(a => [a.achievement_id, a.created_at])),
    heatmapDayCounts,
  };
}

export default function StatsPage() {
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const [badgeFilter, setBadgeFilter] = useState('all');

  const { data } = useQuery({
    queryKey: ['stats-page', user?.id],
    queryFn: () => fetchStatsData(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  const buyFreezeMutation = useMutation({
    mutationFn: async () => {
      const { data: ok, error } = await supabase.rpc('buy_streak_freeze', { uid: user.id });
      if (error) throw error;
      if (!ok) throw new Error('XP가 부족합니다.');
    },
    onSuccess: () => { fetchProfile(user.id, user.user_metadata); toast('🛡️ 스트릭 프리즈 획득!', 'success'); },
    onError: (err) => toast(err.message, 'error'),
  });

  if (!user) {
    return (
      <div className="page-container mypage-noauth">
        <h2 className="mypage-noauth__title">로그인이 필요합니다</h2>
        <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
      </div>
    );
  }

  const xp = profile?.xp ?? 0;
  const level = getXPLevel(xp);
  const progress = getLevelProgress(xp);
  const streak = profile?.streak_count ?? 0;
  const vocab = data?.vocab || [];

  return (
    <div className="page-container" style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>📊 학습 통계</h1>
        <Link href="/profile" className="btn btn--ghost btn--sm">← 프로필</Link>
      </div>

      {/* ① 핵심 현황 — "나 어디까지 왔나" */}
      {profile && (
        <div className="card">
          <div className="mypage-xp-bar">
            <div className="mypage-xp-bar__info">
              <span className="mypage-xp-bar__level">Lv.{level}</span>
              <span className="mypage-xp-bar__total">{xp.toLocaleString('ko-KR')} XP</span>
            </div>
            <div className="mypage-xp-bar__track">
              <div className="mypage-xp-bar__fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="mypage-stat-grid">
            {[
              { icon: '⭐', label: '수집', value: vocab.length },
              { icon: '🏅', label: '숙련', value: data?.mastered ?? '–' },
              { icon: '📖', label: '완독', value: data?.readCount ?? '–' },
              { icon: '🔥', label: '스트릭', value: streak ? `${streak}일` : '–' },
            ].map(s => (
              <div key={s.label} className="mypage-stat-cell">
                <span className="mypage-stat-cell__icon">{s.icon}</span>
                <span className="mypage-stat-cell__value">{s.value}</span>
                <span className="mypage-stat-cell__label">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="mypage-freeze" style={{ marginTop: 14 }}>
            <div className="mypage-freeze__info">
              <span className="mypage-freeze__icon">🛡️</span>
              <div>
                <p className="mypage-freeze__title">스트릭 프리즈 <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{profile.streak_freeze_count ?? 0}개</span></p>
              </div>
            </div>
            <Button size="sm" variant="secondary" disabled={xp < 100 || buyFreezeMutation.isPending}
              onClick={() => buyFreezeMutation.mutate()}>
              {buyFreezeMutation.isPending ? '...' : '100 XP'}
            </Button>
          </div>
        </div>
      )}

      {/* ②~④ 기억 건강 → 레벨 → 요주의 */}
      {vocab.length > 0 && (
        <>
          <VocabStats vocab={vocab} profile={profile} section="memory" />
          <VocabStats vocab={vocab} profile={profile} section="levels" />
          <VocabStats vocab={vocab} profile={profile} section="hardwords" />
        </>
      )}

      {/* ⑤ 히트맵 — "꾸준히 했나" */}
      {data?.heatmapDayCounts && (() => {
        const dc = data.heatmapDayCounts;
        const ROWS = 7, CELL = 13, GAP = 3;
        // 컨테이너(~520px)를 꽉 채우도록 열 수 계산 → 약 7개월
        const COLS = 32;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayKey = today.toISOString().slice(0, 10);
        const days = Array.from({ length: COLS * ROWS }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (COLS * ROWS - 1 - i));
          return d.toISOString().slice(0, 10);
        });
        const maxCount = Math.max(1, ...Object.values(dc));
        const totalActive = Object.keys(dc).length;
        const totalWords = Object.values(dc).reduce((a, b) => a + b, 0);
        const cellColor = n => {
          if (!n) return 'var(--bg-secondary)';
          const lvl = Math.ceil((n / maxCount) * 4);
          return ['', 'var(--primary-glow)', 'var(--primary)', 'var(--accent)', 'var(--accent)'][lvl] || 'var(--accent)';
        };
        const W = COLS * (CELL + GAP) - GAP;
        const H = ROWS * (CELL + GAP) - GAP;
        return (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>📅 학습 히트맵</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{totalActive}일 · {totalWords}개</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
              {days.map((day, i) => (
                <rect key={day}
                  x={Math.floor(i / ROWS) * (CELL + GAP)}
                  y={(i % ROWS) * (CELL + GAP)}
                  width={CELL} height={CELL} rx={2}
                  fill={cellColor(dc[day] || 0)}
                  opacity={day > todayKey ? 0 : 1}>
                  <title>{day}: {dc[day] || 0}개</title>
                </rect>
              ))}
            </svg>
          </div>
        );
      })()}

      {/* ⑥ 업적 — "모아보기" */}
      {data && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>🏅 업적</h2>
            <span className="mypage-badge-count">{data.earnedIds.size} / {ACHIEVEMENTS.length}</span>
          </div>
          <div className="mypage-badge-filters">
            {['all', '어휘', '복습', '읽기', '스트릭', 'XP', '특별'].map(cat => (
              <button key={cat}
                className={`mypage-badge-filter ${badgeFilter === cat ? 'mypage-badge-filter--active' : ''}`}
                onClick={() => setBadgeFilter(cat)}>
                {cat === 'all' ? '전체' : cat}
              </button>
            ))}
          </div>
          <div className="mypage-badge-grid">
            {ACHIEVEMENTS
              .filter(a => badgeFilter === 'all' || a.category === badgeFilter)
              .map(a => {
                const earned = data.earnedIds.has(a.id);
                const date = data.earnedDates[a.id];
                return (
                  <div key={a.id} className={`mypage-badge-item ${earned ? 'mypage-badge-item--earned' : ''}`}
                    title={earned && date ? `${new Date(date).toLocaleDateString('ko-KR')} 획득` : '미획득'}>
                    <span className="mypage-badge-item__icon">{a.icon}</span>
                    <span className="mypage-badge-item__name">{a.name}</span>
                    <span className="mypage-badge-item__desc">{a.desc}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
