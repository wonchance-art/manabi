'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { getXPLevel as getLevel, getLevelProgress } from '../lib/xp';
import EmptyState from '../components/EmptyState';

const RANK_MEDAL = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#f7c948', '#adb5bd', '#cd7f32'];

export default function LeaderboardPage() {
  const { user } = useAuth();

  const { data: leaders = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, xp, streak_count, level')
        .order('xp', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: myRank } = useQuery({
    queryKey: ['leaderboard-myrank', user?.id],
    enabled: !!user && leaders.length > 0,
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('xp', (leaders.find(l => l.id === user.id)?.xp ?? 0) + 1);
      return (count ?? 0) + 1;
    },
  });

  const myEntry = leaders.find(l => l.id === user?.id);
  const myInTop20 = !!myEntry;

  return (
    <div className="page-container" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="lb-header">
        <h1 className="lb-header__title">🏆 랭킹</h1>
        <p className="lb-header__sub">XP 기준 상위 20명</p>
      </div>

      {/* My rank banner (if outside top 20) */}
      {user && !myInTop20 && myRank && (
        <div className="lb-my-rank">
          <span className="lb-my-rank__num">#{myRank}</span>
          <span className="lb-my-rank__label">나의 순위</span>
        </div>
      )}

      {isLoading ? (
        <div className="lb-list">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="lb-entry lb-entry--skeleton">
              <div className="skeleton" style={{ width: 36, height: 20, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: 6, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: '100%', height: 4, borderRadius: 4 }} />
              </div>
              <div className="skeleton" style={{ width: 50, height: 28, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="lb-list">
          {leaders.map((entry, idx) => {
            const level = getLevel(entry.xp ?? 0);
            const progress = getLevelProgress(entry.xp ?? 0);
            const isMe = entry.id === user?.id;
            const rank = idx + 1;
            const barColor = rank <= 3 ? RANK_COLORS[rank - 1] : 'var(--accent)';

            return (
              <div key={entry.id} className={`lb-entry ${isMe ? 'lb-entry--me' : ''}`}>
                {/* Rank */}
                <div className={`lb-rank ${rank <= 3 ? 'lb-rank--medal' : ''}`}>
                  {rank <= 3 ? RANK_MEDAL[rank - 1] : `#${rank}`}
                </div>

                {/* Avatar */}
                <div className={`lb-avatar ${isMe ? 'lb-avatar--me' : ''}`}>
                  {entry.display_name?.[0]?.toUpperCase() || '?'}
                </div>

                {/* Name + XP bar */}
                <div className="lb-info">
                  <div className="lb-info__name-row">
                    <span className="lb-info__name">
                      {entry.display_name || '익명'}
                    </span>
                    {isMe && <span className="lb-tag lb-tag--me">나</span>}
                    {entry.streak_count > 0 && (
                      <span className="lb-streak">🔥{entry.streak_count}</span>
                    )}
                  </div>
                  <div className="lb-xp-track">
                    <div className="lb-xp-fill" style={{ width: `${progress}%`, background: barColor }} />
                  </div>
                </div>

                {/* Level + XP */}
                <div className="lb-score">
                  <div className="lb-score__level">Lv.{level}</div>
                  <div className="lb-score__xp" style={rank <= 3 ? { color: RANK_COLORS[rank - 1] } : undefined}>
                    {(entry.xp ?? 0).toLocaleString('ko-KR')} XP
                  </div>
                </div>
              </div>
            );
          })}

          {leaders.length === 0 && (
            <EmptyState
              icon="🏆"
              title="아직 랭킹 데이터가 없어요"
              desc="단어를 복습하고 자료를 읽으면 XP가 쌓여요!"
            />
          )}
        </div>
      )}
    </div>
  );
}
