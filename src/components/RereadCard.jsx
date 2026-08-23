'use client';

/**
 * 재독 홈 카드 (#1077-12 목업 ②) — 완독 후 14일 지난 자료를 조용히 되부른다.
 * 후보 없음·게스트·조회 실패는 카드 생략(무해성). 선정은 rereadSchedule 엔진.
 */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { pickRereadCandidates } from '../lib/rereadSchedule';

async function fetchCompletedRows(userId) {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('material_id, is_completed, completed_at, reading_materials(title)')
    .eq('user_id', userId)
    .eq('is_completed', true)
    .order('completed_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export default function RereadCard() {
  const { user } = useAuth();
  const { data: rows } = useQuery({
    queryKey: ['reread-candidate', user?.id],
    queryFn: () => fetchCompletedRows(user.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
  if (!user || !rows) return null;

  const candidate = pickRereadCandidates({ progressRows: rows })[0];
  if (!candidate) return null;
  const title = rows.find((r) => r.material_id === candidate.material_id)?.reading_materials?.title;
  if (!title) return null;

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
        📖 다시 읽어볼까요
      </div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        「{title}」 — 완독하고 {candidate.daysSince}일 지났어요. 두 번째는 훨씬 빨라요.
      </div>
      <Link href={`/viewer/${candidate.material_id}`} className="btn btn--secondary btn--sm">다시 읽기 →</Link>
    </div>
  );
}
