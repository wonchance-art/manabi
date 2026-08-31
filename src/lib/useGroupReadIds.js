'use client';

/**
 * 내 그룹들이 **이번 주 같이 읽는** 자료 id 집합 (v2-F R3 — 공개 자료 고르기).
 *
 * 자료실 목록에서 "우리 그룹이 읽는 것"을 한눈에 고르라고 만든 것이다. 뷰어용
 * `fetchGroupsReadingMaterial`은 자료 1건당 1조회라 목록(12+)에는 못 쓴다 —
 * 목록형 `fetchGroupReads`를 쓴다.
 *
 * **쿼리 키는 useGroupEntryItem과 일부러 같다**(`study-groups`·`group-reads`).
 * 홈에서 이미 채워 둔 캐시를 그대로 타므로 자료실 진입에 추가 왕복이 0이다 —
 * 새 조회 경로를 신설하지 않는다는 3문 체크 ②의 실행.
 *
 * 게스트·무그룹·조회 실패는 전부 빈 Set(무해성) — 배지가 안 뜰 뿐 목록은 그대로다.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { fetchGroupReads, fetchMyGroups, kstWeekStartDate } from './studyGroups';

/**
 * reads 행 → material_id 집합 (순수 — 훅 밖에서 검증 가능하게 분리).
 * 조회 실패(undefined)·빈 배열·material_id 결측 행을 전부 빈 Set/무시로 흡수한다.
 */
export function groupReadIdSet(reads) {
  return new Set((reads || []).map((r) => r?.material_id).filter(Boolean));
}

/** @returns {Set<string>} 이번 주 같이 읽기로 지정된 material_id 집합 */
export function useGroupReadIds() {
  const { user } = useAuth();
  const weekStart = kstWeekStartDate();

  const { data: groups } = useQuery({
    queryKey: ['study-groups', user?.id],
    queryFn: () => fetchMyGroups(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  const groupIds = useMemo(() => (groups || []).map((g) => g.id), [groups]);

  const { data: reads } = useQuery({
    queryKey: ['group-reads', user?.id, groupIds.join(','), weekStart],
    queryFn: () => fetchGroupReads(groupIds, weekStart),
    enabled: groupIds.length > 0,
    staleTime: 1000 * 60,
  });

  return useMemo(() => groupReadIdSet(reads), [reads]);
}
