'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

async function fetchUserStats(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: matCount }, { data: vocabData, count: vocabCount }, { data: recentMats }, { count: todayVocabCount }] = await Promise.all([
    supabase.from('reading_materials').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
    supabase.from('user_vocabulary').select('interval', { count: 'exact' }).eq('user_id', userId),
    supabase.from('reading_materials').select('id, title, created_at, processed_json').eq('owner_id', userId).order('created_at', { ascending: false }).limit(3),
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', todayStart.toISOString()),
  ]);

  return {
    totalMaterials: matCount || 0,
    totalVocab: vocabCount || 0,
    masteredVocab: vocabData?.filter(v => v.interval > 14).length || 0,
    recentMaterials: recentMats || [],
    todayVocab: todayVocabCount || 0,
  };
}

export default function MyPage() {
  const { user, profile, signOut } = useAuth();

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
        <Button variant="ghost" size="sm" onClick={handleSignOut}>로그아웃</Button>
      </div>

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
              <div className="stat-card__label">분석한 자료</div>
              <div className="stat-card__value stat-card__value--accent">{stats.totalMaterials}건</div>
              <div className="stat-card__sub">지식의 지평이 넓어지고 있어요</div>
            </div>
          </div>

          <div className="mypage-grid">
            {/* Recent Activities */}
            <div>
              <h2 className="mypage-section-title">🕒 최근 학습한 자료</h2>
              {stats.recentMaterials.length > 0 ? (
                <div className="mypage-recent-list">
                  {stats.recentMaterials.map(m => {
                    const language = m.processed_json?.metadata?.language || 'Japanese';
                    return (
                      <Link key={m.id} href={`/viewer/${m.id}`} className="card mypage-recent-item">
                        <div className="mypage-recent-item__left">
                          <span className="card__flag">{language === 'English' ? '🇬🇧' : '🇯🇵'}</span>
                          <div>
                            <h4 className="mypage-recent-item__title">{m.title}</h4>
                            <span className="mypage-recent-item__date">
                              {new Date(m.created_at).toLocaleDateString('ko-KR')} 학습
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
