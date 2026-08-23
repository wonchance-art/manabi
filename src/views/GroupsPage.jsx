'use client';

/**
 * 학습 그룹 — 함께 읽는 소그룹 (rfc-study-groups R1, 목업 A 상단·하단 + C).
 * R1 표면: 그룹 만들기/코드 참가/나가기 + "이번 주 우리"(주간 거울 합계 — 등수 없음).
 * 같이 읽기·진도 바·토론은 R2(§4.3)에서 이 페이지에 얹는다.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { buildWeeklyReport, weekRangeLabel } from '../lib/weeklyReport';
import { fetchWeeklyReportRows } from '../lib/weeklyReportRows';
import {
  MAX_GROUPS_PER_USER,
  createGroup,
  fetchGroupMemberCounts,
  fetchGroupSnapshots,
  fetchMyGroups,
  groupErrorMessage,
  joinGroup,
  kstWeekStartDate,
  leaveGroup,
  pushGroupSnapshots,
  sumGroupSnapshots,
} from '../lib/studyGroups';
import Button from '../components/Button';

const LANG_KO = { Japanese: '일본어', English: '영어', Chinese: '중국어', French: '프랑스어' };

/** 이번 주 우리 합계 줄 — 0 축 무표기, 정답률은 표본 있을 때만(주간 카드와 같은 결). */
function groupWeekParts(sum) {
  const parts = [];
  if (sum.reviews > 0) {
    const acc = sum.accuracy != null ? ` · 정답 ${Math.round(sum.accuracy * 100)}%` : '';
    parts.push(`복습 ${sum.reviews}문항${acc}`);
  }
  if (sum.added > 0) parts.push(`새로 담은 말 ${sum.added}`);
  if (sum.met > 0) parts.push(`만난 말 ${sum.met}`);
  if (sum.reads > 0) parts.push(`완독 ${sum.reads}편`);
  return parts;
}

/* 만들기·참가 폼(목업 C) — 그룹 없음 첫 화면과 하단 "새 그룹" 토글이 공유한다. */
function GroupForms({ groupCount, onDone }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [lang, setLang] = useState('Japanese');
  const [code, setCode] = useState('');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['study-groups'] });
    onDone?.();
  };
  const createMutation = useMutation({
    mutationFn: () => createGroup(name.trim(), lang),
    onSuccess: (row) => {
      toast(`그룹을 만들었어요! 초대 코드: ${row?.join_code || ''}`, 'success');
      setName('');
      refresh();
    },
    onError: (e) => toast(groupErrorMessage(e), 'warning'),
  });
  const joinMutation = useMutation({
    mutationFn: () => joinGroup(code.trim()),
    onSuccess: () => {
      toast('그룹에 참가했어요!', 'success');
      setCode('');
      refresh();
    },
    onError: (e) => toast(groupErrorMessage(e), 'warning'),
  });
  const atLimit = groupCount >= MAX_GROUPS_PER_USER;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {atLimit ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
          그룹은 {MAX_GROUPS_PER_USER}개까지 함께할 수 있어요.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="그룹 이름 (40자까지)"
              maxLength={40}
              style={{ flex: '2 1 180px' }}
            />
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ flex: '1 1 100px' }}>
              {Object.entries(LANG_KO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Button
              size="sm"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >그룹 만들기</Button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="초대 코드 6자"
              maxLength={6}
              style={{ flex: '1 1 140px', textTransform: 'uppercase' }}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={code.trim().length < 6 || joinMutation.isPending}
              onClick={() => joinMutation.mutate()}
            >코드로 참가</Button>
          </div>
        </>
      )}
    </div>
  );
}

function GroupCard({ group, memberCount, snapshotSum, userId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leaveMutation = useMutation({
    mutationFn: () => leaveGroup(group.id, userId),
    onSuccess: () => {
      toast('그룹에서 나왔어요.', 'success');
      queryClient.invalidateQueries({ queryKey: ['study-groups'] });
    },
    onError: () => toast('잠시 후 다시 시도해 주세요.', 'warning'),
  });

  const shareCode = async () => {
    try {
      await navigator.clipboard.writeText(group.join_code);
      toast(`초대 코드 ${group.join_code}를 복사했어요 — 친구에게 보내 주세요!`, 'success');
    } catch {
      toast(`초대 코드: ${group.join_code}`, 'info');
    }
  };

  const parts = snapshotSum ? groupWeekParts(snapshotSum) : [];
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>👥 {group.name}</h2>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          멤버 {memberCount ?? '–'}/{group.capacity} · {LANG_KO[group.lang] || group.lang}
        </span>
        <button
          type="button"
          onClick={shareCode}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-light)', fontSize: '0.82rem', fontWeight: 600, padding: 0 }}
        >코드 공유</button>
        <span style={{ flex: 1 }} />
        {confirmLeave ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            정말 나갈까요?{' '}
            <button type="button" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warning)', fontWeight: 700, padding: 0 }}>나가기</button>
            {' / '}
            <button type="button" onClick={() => setConfirmLeave(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>취소</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmLeave(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 0 }}>나가기</button>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
          이번 주 우리 ({weekRangeLabel({ startMs: snapshotSum?.weekStartMs ?? Date.now(), endMs: (snapshotSum?.weekStartMs ?? Date.now()) + 7 * 86400000 })})
        </div>
        {parts.length > 0 ? (
          <>
            <div style={{ fontSize: '0.92rem', fontVariantNumeric: 'tabular-nums' }}>{parts.join(' · ')}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>(그룹 합계 — 등수 없음)</div>
          </>
        ) : (
          <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            이번 주 함께한 기록이 아직 없어요 — 오늘 학습이 여기에 모여요.
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForms, setShowForms] = useState(false);
  const weekStart = kstWeekStartDate();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['study-groups', user?.id],
    queryFn: () => fetchMyGroups(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  const groupIds = useMemo(() => (groups || []).map((g) => g.id), [groups]);

  const { data: counts } = useQuery({
    queryKey: ['study-group-counts', user?.id, groupIds.join(',')],
    queryFn: () => fetchGroupMemberCounts(groupIds),
    enabled: groupIds.length > 0,
    staleTime: 1000 * 60,
  });
  const { data: snapshots } = useQuery({
    queryKey: ['group-snapshots', user?.id, groupIds.join(','), weekStart],
    queryFn: () => fetchGroupSnapshots(groupIds, weekStart),
    enabled: groupIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // 내 주간 리포트(프로필 카드와 같은 캐시 키) → 그룹 스냅샷 push(5분 스로틀, 실패 조용히)
  const { data: weeklyRows } = useQuery({
    queryKey: ['weekly-report', user?.id],
    queryFn: () => fetchWeeklyReportRows(user.id),
    enabled: !!user && groupIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  useEffect(() => {
    if (!user || !weeklyRows || groupIds.length === 0) return;
    const weekly = buildWeeklyReport(weeklyRows);
    let alive = true;
    pushGroupSnapshots(groupIds, user.id, weekly, typeof window !== 'undefined' ? window.sessionStorage : null)
      .then(() => {
        if (alive) queryClient.invalidateQueries({ queryKey: ['group-snapshots'] });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user, weeklyRows, groupIds, queryClient]);

  const sumsByGroup = useMemo(() => {
    const weekStartMs = new Date(`${weekStart}T00:00:00+09:00`).getTime();
    const byGroup = {};
    for (const gid of groupIds) {
      const rows = (snapshots || []).filter((r) => r.group_id === gid);
      byGroup[gid] = { ...sumGroupSnapshots(rows), weekStartMs };
    }
    return byGroup;
  }, [groupIds, snapshots, weekStart]);

  if (!user) {
    return (
      <div className="page-container" style={{ maxWidth: 680, textAlign: 'center', paddingTop: 80 }}>
        <h1 style={{ fontSize: '1.2rem', marginBottom: 8 }}>👥 함께 읽기</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
          로그인하면 그룹을 만들어 같은 자료를 함께 읽을 수 있어요.
        </p>
        <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px' }}>👥 함께 읽기</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 20px' }}>
        같은 자료를 함께 읽는 소그룹 — 주간 기록을 합계로만 나란히 봐요.
      </p>

      {isLoading ? (
        <div className="skeleton--card" style={{ height: 140 }} />
      ) : !groups?.length ? (
        /* 목업 C — 그룹 없음 첫 화면 */
        <div className="card" style={{ padding: '22px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            그룹을 만들어 초대 코드를 보내거나, 받은 코드로 참가하세요. (그룹당 8명까지)
          </p>
          <GroupForms groupCount={0} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              memberCount={counts?.[g.id]}
              snapshotSum={sumsByGroup[g.id]}
              userId={user.id}
            />
          ))}
          {groups.length < MAX_GROUPS_PER_USER && (
            <div className="card" style={{ padding: '16px 22px' }}>
              {showForms ? (
                <GroupForms groupCount={groups.length} onDone={() => setShowForms(false)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowForms(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.86rem', padding: 0 }}
                >+ 새 그룹 만들기 · 코드로 참가</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
