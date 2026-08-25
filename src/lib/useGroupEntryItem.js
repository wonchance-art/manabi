'use client';

/**
 * 함께 읽기 항목 (§9-5 홈 확정 → 2026-08-24 '이어서' 덱 흡수).
 * 같이 읽기 자료가 있으면 「자료」+내 진도, 없으면 이번 주 우리 요약, 그룹이 없으면 안내.
 * 조회 실패·게스트는 null(무해성). 렌더가 아니라 **항목 서술**을 주는 이유는
 * useRereadCandidate와 같다 — 덱이 개수를 먼저 알아야 껍데기를 결정한다.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import {
  fetchGroupReads,
  fetchGroupSnapshots,
  fetchMyGroups,
  kstWeekStartDate,
  sumGroupSnapshots,
} from './studyGroups';

/** @returns {{key, href, tone, kicker, title, meta}|null} */
export function useGroupEntryItem() {
  const { user } = useAuth();
  const weekStart = kstWeekStartDate();

  const { data: groups } = useQuery({
    queryKey: ['study-groups', user?.id],
    queryFn: () => fetchMyGroups(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  const groupIds = useMemo(() => (groups || []).map((g) => g.id), [groups]);
  const { data: snapshots } = useQuery({
    queryKey: ['group-snapshots', user?.id, groupIds.join(','), weekStart],
    queryFn: () => fetchGroupSnapshots(groupIds, weekStart),
    enabled: groupIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  const { data: reads } = useQuery({
    queryKey: ['group-reads', user?.id, groupIds.join(','), weekStart],
    queryFn: () => fetchGroupReads(groupIds, weekStart),
    enabled: groupIds.length > 0,
    staleTime: 1000 * 60,
  });

  if (!user || !groups) return null;

  // 성격이 '함께'라 색이 다르다(tone: social) — 진행·시간 민감과 섞이지 않게(오너 지시).
  const base = { key: 'group', href: '/groups', tone: 'social', meta: '→' };

  if (groups.length === 0) {
    return { ...base, kicker: '👥 함께 읽기', title: '그룹을 만들거나 초대 코드로 참가해 보세요' };
  }

  const first = groups[0];
  const firstRows = (snapshots || []).filter((r) => r.group_id === first.id);
  const sum = sumGroupSnapshots(firstRows);
  const read = (reads || []).find((r) => r.group_id === first.id);
  const myPct = firstRows.find((r) => r.user_id === user.id)?.material_pct;

  let title;
  if (read?.material) {
    title = `이번 주 「${read.material.title}」 — 내 진도 ${myPct ?? 0}%`;
  } else {
    const parts = [];
    if (sum.reviews > 0) parts.push(`복습 ${sum.reviews}`);
    if (sum.added > 0) parts.push(`담은 말 ${sum.added}`);
    if (sum.met > 0) parts.push(`만난 말 ${sum.met}`);
    if (sum.reads > 0) parts.push(`완독 ${sum.reads}`);
    title = parts.length > 0 ? `이번 주 우리: ${parts.join(' · ')}` : '이번 주 함께한 기록이 아직 없어요';
  }
  return { ...base, kicker: `👥 ${first.name}`, title };
}
