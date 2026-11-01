'use client';
/**
 * 내 이번 주 스냅샷을 내 그룹들에 올리는 훅 — 그룹 화면(/groups)과 현황(/progress)이 같이 쓴다(STATS-MAP-001).
 * 예전에는 /groups를 열 때만 올라가서 현황만 보는 멤버가 그룹 「이번 주 우리」 합계에서 빠졌다(과소 집계).
 * 그룹 목록은 홈의 그룹 칸과 같은 키(['study-groups', userId])라 대개 캐시에서 온다. 그룹이 없으면 아무것도 쓰지 않는다.
 * 쓰기는 pushGroupSnapshots 정본 그대로 — 그룹마다 5분 스로틀(sessionStorage) · 실패는 조용히 · 원장은 내보내지 않고 합계만.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMyGroups, pushGroupSnapshots } from './studyGroups';

export function useGroupSnapshotPush(userId, weekly) {
  const queryClient = useQueryClient();
  const { data: groups } = useQuery({
    queryKey: ['study-groups', userId],
    queryFn: () => fetchMyGroups(userId),
    enabled: !!userId,
    staleTime: 1000 * 60,
  });
  const groupKey = (groups || []).map(group => group.id).join(',');
  useEffect(() => {
    if (!userId || !weekly || !groupKey) return undefined;
    let alive = true;
    let storage = null;
    try { storage = window.sessionStorage; } catch { /* 저장소를 못 쓰면 스로틀 없이 */ }
    pushGroupSnapshots(groupKey.split(','), userId, weekly, storage)
      .then(() => { if (alive) queryClient.invalidateQueries({ queryKey: ['group-snapshots'] }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId, weekly, groupKey, queryClient]);
}
