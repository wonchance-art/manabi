'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { LEVELS } from '../lib/constants';
import { getXPLevel, getLevelProgress } from '../lib/xp';
import { ACHIEVEMENTS } from '../lib/achievements';
import Button from '../components/Button';

async function fetchMyStats(userId) {
  const [
    { count: vocabCount },
    { count: readCount },
    { count: reviewedCount },
    { data: achievements },
  ] = await Promise.all([
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('reading_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('last_reviewed_at', 'is', null),
    supabase.from('user_achievements').select('achievement_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  return {
    vocabCount: vocabCount || 0,
    readCount: readCount || 0,
    reviewedCount: reviewedCount || 0,
    earnedIds: new Set((achievements || []).map(a => a.achievement_id)),
    earnedDates: Object.fromEntries((achievements || []).map(a => [a.achievement_id, a.created_at])),
  };
}

export default function MyPage() {
  const { user, profile, fetchProfile, signOut } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [editName, setEditName]           = useState('');
  const [editLanguages, setEditLanguages] = useState(['Japanese']);
  const [editLevelJp, setEditLevelJp]     = useState('N3 중급');
  const [editLevelEn, setEditLevelEn]     = useState('B1 중급');
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalReview, setGoalReview]       = useState(5);
  const [goalWords, setGoalWords]         = useState(5);
  const [goalRead, setGoalRead]           = useState(1);
  const [badgeFilter, setBadgeFilter]     = useState('all');

  const { data: stats } = useQuery({
    queryKey: ['mypage-stats', user?.id],
    queryFn: () => fetchMyStats(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (!profile) return;
    setEditName(profile.display_name || '');
    setEditLanguages(profile.learning_language?.length ? profile.learning_language : ['Japanese']);
    setEditLevelJp(profile.learning_level_japanese || 'N3 중급');
    setEditLevelEn(profile.learning_level_english  || 'B1 중급');
  }, [profile]);

  function startEditGoals() {
    setGoalReview(profile?.goal_review ?? 5);
    setGoalWords(profile?.goal_words  ?? 5);
    setGoalRead(profile?.goal_read    ?? 1);
    setIsEditingGoals(true);
  }

  const saveGoalsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        goal_review: Math.max(1, goalReview),
        goal_words:  Math.max(1, goalWords),
        goal_read:   Math.max(1, goalRead),
      }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      fetchProfile(user.id, user.user_metadata);
      setIsEditingGoals(false);
      toast('목표가 저장됐습니다.', 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!editName.trim()) throw new Error('닉네임을 입력해주세요.');
      const { error } = await supabase.from('profiles').update({
        display_name:              editName.trim(),
        learning_language:         editLanguages,
        learning_level_japanese:   editLevelJp,
        learning_level_english:    editLevelEn,
      }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      fetchProfile(user.id, user.user_metadata);
      queryClient.invalidateQueries({ queryKey: ['home', user.id] });
      toast('프로필이 저장됐습니다.', 'success');
    },
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

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>

      {/* 헤더 */}
      <div className="mypage-profile-header">
        <div className="mypage-avatar">
          {profile?.display_name?.[0] || '👤'}
        </div>
        <div className="mypage-profile-info">
          <h1 className="mypage-profile-info__name">{profile?.display_name || '학습자'}</h1>
          <p className="mypage-profile-info__email">{user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
      </div>

      {/* 프로필 설정 */}
      <div className="card mypage-section">
        <h2 className="mypage-section__title">👤 프로필 설정</h2>

        {profile && !profile.learning_language?.length && (
          <div className="mypage-tip-banner">
            👋 학습 언어와 수준을 설정하면 맞춤 자료를 추천받을 수 있어요!
          </div>
        )}

        <div className="form-field">
          <label className="form-label">닉네임</label>
          <input
            className="form-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            maxLength={20}
            placeholder="표시될 이름을 입력하세요"
          />
        </div>

        <div className="form-field">
          <label className="form-label">학습 언어</label>
          <div className="toggle-group">
            {['Japanese', 'English'].map(lang => (
              <button key={lang} type="button"
                className={`toggle-btn ${editLanguages.includes(lang) ? 'toggle-btn--primary' : ''}`}
                onClick={() => setEditLanguages(prev =>
                  prev.includes(lang)
                    ? prev.length > 1 ? prev.filter(l => l !== lang) : prev
                    : [...prev, lang]
                )}>
                {lang === 'Japanese' ? '🇯🇵 Japanese' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>

        {editLanguages.includes('Japanese') && (
          <div className="form-field">
            <label className="form-label">🇯🇵 일본어 수준</label>
            <div className="level-group">
              {LEVELS.Japanese.map(lvl => (
                <button key={lvl} type="button"
                  className={`level-btn ${editLevelJp === lvl ? 'level-btn--active' : ''}`}
                  onClick={() => setEditLevelJp(lvl)}>{lvl}</button>
              ))}
            </div>
          </div>
        )}

        {editLanguages.includes('English') && (
          <div className="form-field">
            <label className="form-label">🇬🇧 영어 수준</label>
            <div className="level-group">
              {LEVELS.English.map(lvl => (
                <button key={lvl} type="button"
                  className={`level-btn ${editLevelEn === lvl ? 'level-btn--active' : ''}`}
                  onClick={() => setEditLevelEn(lvl)}>{lvl}</button>
              ))}
            </div>
          </div>
        )}

        <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
          {saveProfileMutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>

      {/* XP & 레벨 요약 */}
      {profile && (() => {
        const xp = profile.xp ?? 0;
        const level = getXPLevel(xp);
        const progress = getLevelProgress(xp);
        const streak = profile.streak_count ?? 0;
        return (
          <div className="card mypage-section">
            <h2 className="mypage-section__title">⚡ 레벨 & 통계</h2>
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
                { icon: '⭐', label: '수집 단어', value: stats?.vocabCount ?? '–' },
                { icon: '🧠', label: '복습 완료', value: stats?.reviewedCount ?? '–' },
                { icon: '📖', label: '완독 자료', value: stats?.readCount ?? '–' },
                { icon: '🔥', label: '연속 학습', value: streak ? `${streak}일` : '–' },
              ].map(s => (
                <div key={s.label} className="mypage-stat-cell">
                  <span className="mypage-stat-cell__icon">{s.icon}</span>
                  <span className="mypage-stat-cell__value">{s.value}</span>
                  <span className="mypage-stat-cell__label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 업적 갤러리 */}
      {stats && (
        <div className="card mypage-section">
          <div className="mypage-section__header">
            <h2 className="mypage-section__title">🏅 업적</h2>
            <span className="mypage-badge-count">{stats.earnedIds.size} / {ACHIEVEMENTS.length}</span>
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
                const earned = stats.earnedIds.has(a.id);
                const date = stats.earnedDates[a.id];
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

      {/* 일일 목표 설정 */}
      <div className="card mypage-section">
        <div className="mypage-section__header">
          <h2 className="mypage-section__title">🎯 일일 목표</h2>
          {!isEditingGoals && (
            <Button size="sm" variant="secondary" onClick={startEditGoals}>편집</Button>
          )}
        </div>

        {isEditingGoals ? (
          <>
            {[
              { label: '🧠 단어 복습', value: goalReview, set: setGoalReview, min: 1, max: 50 },
              { label: '⭐ 단어 수집', value: goalWords,  set: setGoalWords,  min: 1, max: 30 },
              { label: '📖 자료 완독', value: goalRead,   set: setGoalRead,   min: 1, max: 5  },
            ].map(({ label, value, set, min, max }) => (
              <div key={label} className="mypage-goal-slider">
                <div className="mypage-goal-slider__head">
                  <span>{label}</span>
                  <span className="mypage-goal-slider__value">{value}개</span>
                </div>
                <input type="range" className="mypage-range" min={min} max={max} value={value}
                  onChange={e => set(Number(e.target.value))} />
                <div className="mypage-goal-slider__minmax">
                  <span>{min}</span><span>{max}</span>
                </div>
              </div>
            ))}
            <div className="mypage-goal-actions">
              <Button onClick={() => saveGoalsMutation.mutate()} disabled={saveGoalsMutation.isPending} style={{ flex: 1 }}>
                {saveGoalsMutation.isPending ? '저장 중...' : '저장'}
              </Button>
              <Button variant="secondary" onClick={() => setIsEditingGoals(false)} style={{ flex: 1 }}>
                취소
              </Button>
            </div>
          </>
        ) : (
          <div className="mypage-goal-list">
            {[
              { label: '🧠 단어 복습', goal: profile?.goal_review ?? 5 },
              { label: '⭐ 단어 수집', goal: profile?.goal_words  ?? 5 },
              { label: '📖 자료 완독', goal: profile?.goal_read   ?? 1 },
            ].map(({ label, goal }) => (
              <div key={label} className="mypage-goal-row">
                <span className="mypage-goal-row__label">{label}</span>
                <span className="mypage-goal-row__value">하루 {goal}개</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
