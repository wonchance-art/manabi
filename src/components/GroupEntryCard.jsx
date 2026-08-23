'use client';

/**
 * 홈 진입 카드 — 학습 그룹(목업 B의 R1 축소형, §9-5 홈 확정).
 * 그룹이 있으면 첫 그룹의 "이번 주 우리" 합계 요약, 없으면 함께 읽기 안내(목업 C 축약).
 * R2에서 같이 읽기 자료·내 진도 줄(목업 B 완형)로 확장한다. 조회 실패는 카드 생략(무해성).
 */
import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import {
  fetchGroupSnapshots,
  fetchMyGroups,
  kstWeekStartDate,
  sumGroupSnapshots,
} from '../lib/studyGroups';

export default function GroupEntryCard() {
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

  if (!user || !groups) return null;

  if (groups.length === 0) {
    return (
      <Link href="/groups" className="card" style={{ display: 'block', padding: '14px 18px', textDecoration: 'none' }}>
        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          👥 <strong style={{ color: 'var(--text-primary)' }}>함께 읽기</strong> — 그룹을 만들거나 초대 코드로 참가해 보세요 →
        </span>
      </Link>
    );
  }

  const first = groups[0];
  const sum = sumGroupSnapshots((snapshots || []).filter((r) => r.group_id === first.id));
  const parts = [];
  if (sum.reviews > 0) parts.push(`복습 ${sum.reviews}`);
  if (sum.added > 0) parts.push(`담은 말 ${sum.added}`);
  if (sum.met > 0) parts.push(`만난 말 ${sum.met}`);
  if (sum.reads > 0) parts.push(`완독 ${sum.reads}`);

  return (
    <Link href="/groups" className="card" style={{ display: 'block', padding: '14px 18px', textDecoration: 'none' }}>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>👥 {first.name}</div>
      <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        {parts.length > 0 ? `이번 주 우리: ${parts.join(' · ')}` : '이번 주 함께한 기록이 아직 없어요'}
        {' →'}
      </div>
    </Link>
  );
}
