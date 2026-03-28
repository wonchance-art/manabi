'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { LEVELS } from '../lib/constants';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

async function fetchUserStats(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const heatmapStart = new Date(todayStart);
  heatmapStart.setDate(heatmapStart.getDate() - 83); // 12주 = 84일

  const [{ count: completedCount }, { data: vocabData, count: vocabCount }, { data: recentProgress }, { count: todayVocabCount }, { data: heatmapData }] = await Promise.all([
    supabase.from('reading_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
    supabase.from('user_vocabulary').select('interval', { count: 'exact' }).eq('user_id', userId),
    supabase.from('reading_progress').select('material_id, updated_at, reading_materials(id, title, processed_json)').eq('user_id', userId).order('updated_at', { ascending: false }).limit(3),
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', todayStart.toISOString()),
    supabase.from('user_vocabulary').select('created_at').eq('user_id', userId).gte('created_at', heatmapStart.toISOString()),
  ]);

  // 날짜별 카운트 집계
  const dayCounts = {};
  (heatmapData || []).forEach(v => {
    const day = v.created_at.slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  return {
    completedMaterials: completedCount || 0,
    totalVocab: vocabCount || 0,
    masteredVocab: vocabData?.filter(v => v.interval > 14).length || 0,
    recentProgress: recentProgress || [],
    todayVocab: todayVocabCount || 0,
    heatmapDayCounts: dayCounts,
  };
}

export default function MyPage() {
  const { user, profile, fetchProfile, signOut } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLanguages, setEditLanguages] = useState(['Japanese']);
  const [editLevelJp, setEditLevelJp] = useState('N3 중급');
  const [editLevelEn, setEditLevelEn] = useState('B1 중급');

  // 프로필 미설정 신규 유저는 편집 폼 자동 오픈
  useEffect(() => {
    if (profile && !profile.learning_language?.length && !isEditing) {
      setEditName(profile.display_name || '');
      setEditLanguages(['Japanese']);
      setEditLevelJp(profile.learning_level_japanese || 'N3 중급');
      setEditLevelEn(profile.learning_level_english || 'B1 중급');
      setIsEditing(true);
    }
  }, [profile]);

  function startEdit() {
    setEditName(profile?.display_name || '');
    setEditLanguages(profile?.learning_language || ['Japanese']);
    setEditLevelJp(profile?.learning_level_japanese || 'N3 중급');
    setEditLevelEn(profile?.learning_level_english || 'B1 중급');
    setIsEditing(true);
  }

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!editName.trim()) throw new Error('닉네임을 입력해주세요.');
      const { error } = await supabase.from('profiles').update({
        display_name: editName.trim(),
        learning_language: editLanguages,
        learning_level_japanese: editLevelJp,
        learning_level_english: editLevelEn,
      }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      fetchProfile(user.id, user.user_metadata);
      queryClient.invalidateQueries({ queryKey: ['user-stats', user.id] });
      setIsEditing(false);
      toast('프로필이 저장됐습니다.', 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: () => fetchUserStats(user.id),
    enabled: !!user,
  });

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user) {
    return (
      <div className="page-container mypage-guest">
        <h2>로그인이 필요한 페이지입니다</h2>
        <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header page-header--row" style={{ alignItems: 'center' }}>
        <div className="mypage-profile">
          <div className="mypage-avatar">{profile?.display_name?.[0] || '👤'}</div>
          <div>
            <h1 className="page-header__title mypage-title">
              {profile?.display_name || '학습자'}님의 대시보드
            </h1>
            <p className="page-header__subtitle">오늘도 성장을 향한 한 걸음을 내디뎌 보세요</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={isEditing ? () => setIsEditing(false) : startEdit}>
            {isEditing ? '취소' : '✏️ 프로필 편집'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>로그아웃</Button>
        </div>
      </div>

      {isEditing && (
        <div className="card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {profile && !profile.learning_language?.length && (
            <div style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '12px 16px', fontSize: '0.875rem', color: 'var(--primary-light)' }}>
              👋 학습 언어와 수준을 설정하면 맞춤 자료를 추천받을 수 있어요!
            </div>
          )}
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>프로필 편집</h3>
          <div className="form-field">
            <label className="form-label">닉네임</label>
            <input
              className="form-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="form-field">
            <label className="form-label">학습 언어</label>
            <div className="toggle-group">
              {['Japanese', 'English'].map(lang => (
                <button
                  key={lang}
                  type="button"
                  className={`toggle-btn ${editLanguages.includes(lang) ? 'toggle-btn--primary' : ''}`}
                  onClick={() => setEditLanguages(prev =>
                    prev.includes(lang)
                      ? prev.length > 1 ? prev.filter(l => l !== lang) : prev
                      : [...prev, lang]
                  )}
                >
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
          <Button onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending} size="md">
            {updateProfileMutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <Spinner message="성장 리포트를 분석 중..." />
      ) : (
        <>
          {/* Stats Overview */}
          <div className="stats-grid mypage-stats">
            <div className="stat-card">
              <div className="stat-card__label">현재 스트릭</div>
              <div className="stat-card__value mypage-streak">🔥 {profile?.streak_count || 0}일</div>
              <div className="stat-card__sub">꾸준함이 실력을 만듭니다!</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">수집한 어휘</div>
              <div className="stat-card__value stat-card__value--primary">{stats.totalVocab}개</div>
              <div className="stat-card__sub">마스터 어휘: {stats.masteredVocab}개</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">완료한 자료</div>
              <div className="stat-card__value stat-card__value--accent">{stats.completedMaterials}건</div>
              <div className="stat-card__sub">지식의 지평이 넓어지고 있어요</div>
            </div>
          </div>

          {/* 학습 히트맵 */}
          {(() => {
            const dayCounts = stats.heatmapDayCounts || {};
            const COLS = 12; // 12주
            const ROWS = 7;  // 월~일
            const CELL = 14;
            const GAP = 3;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 오늘 기준으로 84일 배열 (과거 → 오늘)
            const days = Array.from({ length: COLS * ROWS }, (_, i) => {
              const d = new Date(today);
              d.setDate(d.getDate() - (COLS * ROWS - 1 - i));
              return d.toISOString().slice(0, 10);
            });

            const maxCount = Math.max(1, ...Object.values(dayCounts));
            const totalActive = Object.keys(dayCounts).length;
            const totalWords = Object.values(dayCounts).reduce((a, b) => a + b, 0);

            function cellColor(count) {
              if (!count) return 'var(--bg-elevated)';
              const level = Math.ceil((count / maxCount) * 4);
              const colors = ['', 'var(--primary-glow)', 'var(--primary)', 'var(--accent)', 'var(--accent)'];
              return colors[level] || colors[4];
            }

            const W = COLS * (CELL + GAP) - GAP;
            const H = ROWS * (CELL + GAP) - GAP;

            return (
              <div className="card mypage-heatmap">
                <div className="mypage-heatmap__header">
                  <h3 className="mypage-section-title" style={{ margin: 0 }}>🗓 학습 활동 (최근 12주)</h3>
                  <span className="mypage-heatmap__summary">{totalActive}일 활동 · {totalWords}개 단어</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
                    {days.map((day, i) => {
                      const col = Math.floor(i / ROWS);
                      const row = i % ROWS;
                      const x = col * (CELL + GAP);
                      const y = row * (CELL + GAP);
                      const count = dayCounts[day] || 0;
                      return (
                        <rect
                          key={day}
                          x={x} y={y}
                          width={CELL} height={CELL}
                          rx={3}
                          fill={cellColor(count)}
                          opacity={day > today.toISOString().slice(0, 10) ? 0 : 1}
                        >
                          <title>{day}: {count}개</title>
                        </rect>
                      );
                    })}
                  </svg>
                </div>
                <div className="mypage-heatmap__legend">
                  <span>적음</span>
                  {['var(--bg-elevated)', 'var(--primary-glow)', 'var(--primary)', 'var(--accent)'].map((c, i) => (
                    <rect key={i} style={{ width: 12, height: 12, background: c, borderRadius: 2, display: 'inline-block' }} />
                  ))}
                  <span>많음</span>
                </div>
              </div>
            );
          })()}

          <div className="mypage-grid">
            {/* Recent Activities */}
            <div>
              <h2 className="mypage-section-title">🕒 최근 학습한 자료</h2>
              {stats.recentProgress.length > 0 ? (
                <div className="mypage-recent-list">
                  {stats.recentProgress.map(p => {
                    const m = p.reading_materials;
                    if (!m) return null;
                    const language = m.processed_json?.metadata?.language || 'Japanese';
                    return (
                      <Link key={p.material_id} href={`/viewer/${p.material_id}`} className="card mypage-recent-item">
                        <div className="mypage-recent-item__left">
                          <span className="card__flag">{language === 'English' ? '🇬🇧' : '🇯🇵'}</span>
                          <div>
                            <h4 className="mypage-recent-item__title">{m.title}</h4>
                            <span className="mypage-recent-item__date">
                              {new Date(p.updated_at).toLocaleDateString('ko-KR')} 학습
                            </span>
                          </div>
                        </div>
                        <span className="mypage-recent-item__arrow">→</span>
                      </Link>
                    );
                  })}
                  <Link href="/materials" className="mypage-more-link">전체 자료 보러가기 →</Link>
                </div>
              ) : (
                <div className="card empty-state">
                  아직 학습한 자료가 없습니다. 자료를 추가해 보세요!
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="mypage-section-title">🎯 오늘의 목표</h2>
              <div className="card mypage-goal-card">
                <div className="mypage-goal-row">
                  <span>새로운 단어 5개 수집 ({stats.todayVocab}/5)</span>
                  <span className="mypage-goal-status">{stats.todayVocab >= 5 ? '✅ 달성!' : '진행 중'}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${Math.min(100, (stats.todayVocab / 5) * 100)}%` }} />
                </div>
                <Link href="/materials/add" className="btn btn--primary btn--md mypage-goal-cta">
                  학습 시작하기
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
