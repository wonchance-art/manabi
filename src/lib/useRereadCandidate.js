'use client';

/**
 * 재독 후보 조회 훅 (#1077-12) — 완독 14일 지난 자료 1건을 '이어서' 덱의 항목 서술로 준다.
 * 조회를 훅으로 분리한 이유: 덱이 **항목 개수를 미리 알아야** 캐러셀 껍데기(점·걸침)를
 * 씌울지 결정한다. 컴포넌트가 스스로 null을 반환하는 구조로는 개수를 셀 수 없다.
 * 후보 없음·게스트·조회 실패는 null(무해성).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { pickRereadCandidates } from './rereadSchedule';

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

/** @returns {{key, href, kicker, title, meta}|null} — 덱 항목 서술(렌더는 덱이 한다). */
export function useRereadCandidate() {
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

  return {
    key: 'reread',
    href: `/viewer/${candidate.material_id}`,
    kicker: '다시 읽기 · 두 번째는 훨씬 빨라요',
    title,
    meta: `${candidate.daysSince}일 만에 →`,
  };
}
