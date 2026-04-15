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
import VocabStats from './VocabStats';
import { useTheme } from '../lib/useTheme';

async function fetchMyStats(userId) {
  const heatmapStart = new Date();
  heatmapStart.setHours(0, 0, 0, 0);
  heatmapStart.setDate(heatmapStart.getDate() - 83);

  const [
    { count: vocabCount },
    { count: readCount },
    { count: reviewedCount },
    { data: achievements },
    { data: vocabRows },
  ] = await Promise.all([
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('reading_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('last_reviewed_at', 'is', null),
    supabase.from('user_achievements').select('achievement_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('user_vocabulary').select('created_at, last_reviewed_at').eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
  ]);

  const heatmapDayCounts = {};
  for (const v of (vocabRows || [])) {
    const day = v.created_at.slice(0, 10);
    heatmapDayCounts[day] = (heatmapDayCounts[day] || 0) + 1;
  }

  return {
    vocabCount: vocabCount || 0,
    readCount: readCount || 0,
    reviewedCount: reviewedCount || 0,
    earnedIds: new Set((achievements || []).map(a => a.achievement_id)),
    earnedDates: Object.fromEntries((achievements || []).map(a => [a.achievement_id, a.created_at])),
    heatmapDayCounts,
  };
}

export default function MyPage() {
  const { user, profile, fetchProfile, signOut } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const [editName, setEditName]           = useState('');
  const [editLanguages, setEditLanguages] = useState(['Japanese']);
  const [editLevelJp, setEditLevelJp]     = useState('N3 중급');
  const [editLevelEn, setEditLevelEn]     = useState('B1 중급');
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalReview, setGoalReview]       = useState(5);
  const [goalWords, setGoalWords]         = useState(5);
  const [goalRead, setGoalRead]           = useState(1);
  const [badgeFilter, setBadgeFilter]     = useState('all');
  const [reminderHour, setReminderHour]   = useState('');
  const [notifPerm, setNotifPerm]         = useState('default');

  const { data: stats } = useQuery({
    queryKey: ['mypage-stats', user?.id],
    queryFn: () => fetchMyStats(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // VocabStats 이관용 — 전체 단어 가져오기
  const { data: vocabAll = [] } = useQuery({
    queryKey: ['mypage-vocab-all', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_vocabulary')
        .select('*')
        .eq('user_id', user.id);
      return data || [];
    },
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

  useEffect(() => {
    const saved = localStorage.getItem('as_reminder_hour');
    if (saved !== null) setReminderHour(saved);
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
  }, []);

  async function handleReminderChange(hour) {
    if (hour === '') {
      localStorage.removeItem('as_reminder_hour');
      localStorage.removeItem('as_reminder_last_sent');
      setReminderHour('');
      toast('복습 알림이 해제됐습니다.', 'success');
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm !== 'granted') {
        toast('알림 권한을 허용해야 복습 알림을 받을 수 있어요.', 'error');
        return;
      }
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      toast('브라우저 설정에서 알림이 차단되어 있어요.', 'error');
      return;
    }
    localStorage.setItem('as_reminder_hour', hour);
    setReminderHour(hour);
    toast(`매일 ${hour}시에 복습 알림을 보낼게요!`, 'success');
  }

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

  const buyFreezeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('buy_streak_freeze', { uid: user.id });
      if (error) throw error;
      if (!data) throw new Error('XP가 부족합니다.');
    },
    onSuccess: () => {
      fetchProfile(user.id, user.user_metadata);
      toast('🛡️ 스트릭 프리즈를 획득했어요!', 'success');
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

      {/* 부가 기능 바로가기 — 네비에서 제거된 항목들 */}
      <div className="card mypage-section" style={{ marginBottom: 16 }}>
        <h2 className="mypage-section__title" style={{ fontSize: '0.9rem', marginBottom: 10 }}>🔗 바로가기</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/guide" className="btn btn--ghost btn--sm">📚 가이드</Link>
          <Link href="/leaderboard" className="btn btn--ghost btn--sm">🏆 랭킹</Link>
          <Link href="/forum" className="btn btn--ghost btn--sm">💬 포럼</Link>
        </div>
      </div>

      {/* 테마 설정 */}
      <div className="card mypage-section" style={{ marginBottom: 16 }}>
        <h2 className="mypage-section__title" style={{ fontSize: '0.9rem', marginBottom: 10 }}>🎨 테마</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`btn btn--sm ${theme === 'light' ? 'btn--primary' : 'btn--ghost'}`}
            aria-pressed={theme === 'light'}
            style={{ flex: 1 }}
          >
            ☀️ 라이트
          </button>
          <button
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`btn btn--sm ${theme === 'dark' ? 'btn--primary' : 'btn--ghost'}`}
            aria-pressed={theme === 'dark'}
            style={{ flex: 1 }}
          >
            🌙 다크
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
          💡 상단 네비 {theme === 'dark' ? '☀️' : '🌙'} 아이콘으로도 전환 가능
        </p>
      </div>

      {/* 📊 학습 통계 — /vocab에서 이관 */}
      {vocabAll.length > 0 && (
        <div id="vocab-stats" className="mypage-section" style={{ marginBottom: 16 }}>
          <h2 className="mypage-section__title">📊 학습 통계</h2>
          <VocabStats vocab={vocabAll} profile={profile} />
        </div>
      )}

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

            {/* 스트릭 프리즈 */}
            <div className="mypage-freeze">
              <div className="mypage-freeze__info">
                <span className="mypage-freeze__icon">🛡️</span>
                <div>
                  <p className="mypage-freeze__title">스트릭 프리즈</p>
                  <p className="mypage-freeze__desc">하루 빠져도 스트릭이 유지돼요</p>
                </div>
                <span className="mypage-freeze__count">{profile.streak_freeze_count ?? 0}개 보유</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={xp < 100 || buyFreezeMutation.isPending}
                onClick={() => buyFreezeMutation.mutate()}
              >
                {buyFreezeMutation.isPending ? '구매 중...' : '100 XP로 구매'}
              </Button>
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

      {/* 학습 히트맵 */}
      {stats?.heatmapDayCounts && (() => {
        const dc = stats.heatmapDayCounts;
        const COLS = 12, ROWS = 7, CELL = 13, GAP = 3;
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
          <div className="card mypage-section">
            <div className="mypage-section__header">
              <h2 className="mypage-section__title">📅 학습 히트맵</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{totalActive}일 활동 · {totalWords}개 단어</span>
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
              {['var(--bg-secondary)', 'var(--primary-glow)', 'var(--primary)', 'var(--accent)'].map((c, i) => (
                <span key={i} className="home-heatmap-legend__dot" style={{ background: c }} />
              ))}
              <span>많음</span>
            </div>
          </div>
        );
      })()}

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

      {/* 복습 알림 설정 */}
      <div className="card mypage-section">
        <h2 className="mypage-section__title">🔔 복습 알림</h2>
        <p className="mypage-reminder-desc">
          매일 정해진 시간에 복습 알림을 보내드려요.
        </p>

        {typeof Notification !== 'undefined' && notifPerm === 'denied' && (
          <div className="mypage-reminder-blocked">
            ⚠️ 브라우저 설정에서 알림이 차단되어 있어요. 브라우저 주소창 왼쪽 아이콘을 눌러 알림을 허용해주세요.
          </div>
        )}

        <div className="mypage-reminder-picker">
          <div className="mypage-reminder-options">
            {['', '7', '9', '12', '18', '21'].map(h => (
              <button
                key={h}
                className={`mypage-reminder-btn ${reminderHour === h ? 'mypage-reminder-btn--active' : ''}`}
                onClick={() => handleReminderChange(h)}
              >
                {h === '' ? '끄기' : `${h}시`}
              </button>
            ))}
          </div>
          {reminderHour && (
            <p className="mypage-reminder-status">
              ✅ 매일 {reminderHour}시에 알림을 보내드릴게요
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
