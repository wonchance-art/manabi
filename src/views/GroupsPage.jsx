'use client';

/**
 * 학습 그룹 — 함께 읽는 소그룹 (rfc-study-groups R1+R2, 목업 A 완형 + C).
 * R1: 그룹 만들기/코드 참가/나가기 + "이번 주 우리"(주간 거울 합계 — 등수 없음).
 * R2: 이번 주 같이 읽기(공개 자료 지정·멤버 진도 바) + 진도 게이트 토론(내가 읽은
 * 데까지만 열림 — 원문이 공개 자료라 보안 아닌 UX 게이트). R3(공동 목표)는 후속.
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
  addGroupComment,
  createGroup,
  deleteGroupComment,
  fetchGroupComments,
  fetchGroupMembers,
  fetchGroupReads,
  fetchGroupSnapshots,
  fetchMyGroups,
  fetchPublicMaterials,
  gateComments,
  groupErrorMessage,
  joinGroup,
  kstWeekStartDate,
  leaveGroup,
  pushGroupSnapshots,
  setGroupRead,
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

/* 이번 주 자료 고르기 — 공개 자료만(비공개는 그룹원이 못 읽는다, 서버 계약 동일). */
function ReadPicker({ group, weekStart, userId, onDone }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: candidates } = useQuery({
    queryKey: ['group-read-candidates', group.lang, search],
    queryFn: () => fetchPublicMaterials(group.lang, search.trim() || undefined),
    staleTime: 1000 * 60,
  });
  const setMutation = useMutation({
    mutationFn: (materialId) => setGroupRead(group.id, weekStart, materialId, userId),
    onSuccess: () => {
      toast('이번 주 같이 읽기 자료를 정했어요!', 'success');
      queryClient.invalidateQueries({ queryKey: ['group-reads'] });
      onDone?.();
    },
    onError: () => toast('잠시 후 다시 시도해 주세요.', 'warning'),
  });

  return (
    <div style={{ marginTop: 8 }}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="공개 자료 검색 (제목)"
        style={{ width: '100%', marginBottom: 8 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
        {(candidates || []).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMutation.mutate(m.id)}
            disabled={setMutation.isPending}
            style={{
              textAlign: 'left', background: 'none', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.86rem',
            }}
          >
            {m.title}
            {m.level && <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.78rem' }}>{m.level}</span>}
          </button>
        ))}
        {candidates && candidates.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
            공개 자료가 아직 없어요 — 서재에서 자료를 공개로 올리면 여기서 고를 수 있어요.
          </p>
        )}
      </div>
    </div>
  );
}

/* 멤버별 진도 바(목업 A) — 가입순 나열, 등수·정렬 없음. */
function ReadProgressBars({ members, snapshotsByUser, userId }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0' }}>
      {members.map((m) => {
        const isMe = m.user_id === userId;
        const name = isMe ? '나' : (m.author?.display_name || '익명');
        const pct = snapshotsByUser[m.user_id]?.material_pct;
        return (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}>
            <span style={{ width: 64, flexShrink: 0, fontWeight: isMe ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {pct != null ? (
              <>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)' }} />
                </div>
                <span style={{ width: 40, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>아직 안 읽음</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* 진도 게이트 토론(목업 A) — 내가 읽은 데까지만, 앞선 댓글은 잠금 안내. */
function GroupDiscussion({ group, read, myPct, userId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const { data: comments } = useQuery({
    queryKey: ['group-comments', group.id, read.material_id],
    queryFn: () => fetchGroupComments(group.id, read.material_id),
    staleTime: 1000 * 30,
  });
  const gated = useMemo(() => gateComments(comments, myPct), [comments, myPct]);
  const addMutation = useMutation({
    mutationFn: () => addGroupComment({
      groupId: group.id, materialId: read.material_id, userId, content: input.trim(), progressPct: myPct,
    }),
    onSuccess: () => {
      setInput('');
      queryClient.invalidateQueries({ queryKey: ['group-comments', group.id, read.material_id] });
    },
    onError: () => toast('잠시 후 다시 시도해 주세요.', 'warning'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteGroupComment(id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-comments', group.id, read.material_id] }),
  });

  const total = comments?.length || 0;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
        토론 ({total}) — 내가 읽은 데까지만 보여요
      </div>
      {gated.visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {gated.visible.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, fontSize: '0.86rem', alignItems: 'baseline' }}>
              <span style={{ flexShrink: 0, fontWeight: 600 }}>
                {c.user_id === userId ? '나' : (c.author?.display_name || '익명')}
              </span>
              <span style={{ flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.76rem' }}>{c.progress_pct}% 지점</span>
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.content}</span>
              {c.user_id === userId && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(c.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, flexShrink: 0 }}
                  title="삭제"
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}
      {gated.lockedCount > 0 && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          🔒 {gated.minLockedPct}% 이후 댓글 {gated.lockedCount}개 — 거기까지 읽으면 열려요
        </div>
      )}
      {total === 0 && (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
          첫 감상을 남겨보세요 — 지금 진도({myPct}%)까지 읽은 사람에게만 보여요.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`내 진도 ${myPct}% 지점에 남기기`}
          maxLength={500}
          style={{ flex: 1 }}
        />
        <Button
          size="sm"
          disabled={!input.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >남기기</Button>
      </div>
    </div>
  );
}

function GroupCard({ group, snapshotRows, snapshotSum, read, weekStart, userId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [picking, setPicking] = useState(false);

  const { data: members } = useQuery({
    queryKey: ['group-members', group.id],
    queryFn: () => fetchGroupMembers(group.id),
    staleTime: 1000 * 60,
  });
  const snapshotsByUser = useMemo(() => {
    const map = {};
    for (const r of snapshotRows || []) map[r.user_id] = r;
    return map;
  }, [snapshotRows]);
  const myPct = snapshotsByUser[userId]?.material_pct ?? 0;

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
          멤버 {members?.length ?? '–'}/{group.capacity} · {LANG_KO[group.lang] || group.lang}
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

      {/* R2 — 이번 주 같이 읽기(목업 A 가운데): 지정 자료·멤버 진도 바·이어 읽기 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>이번 주 같이 읽기</span>
          {read?.material && (
            <>
              <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>「{read.material.title}」</span>
              <button type="button" onClick={() => setPicking((v) => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', padding: 0 }}>
                {picking ? '닫기' : '바꾸기'}
              </button>
            </>
          )}
        </div>
        {read?.material && !picking && (
          <>
            {members?.length > 0 && (
              <ReadProgressBars members={members} snapshotsByUser={snapshotsByUser} userId={userId} />
            )}
            <Link href={`/viewer/${read.material_id}`} className="btn btn--secondary btn--sm">이어 읽기 →</Link>
          </>
        )}
        {(!read?.material || picking) && (
          picking || read?.material ? (
            <ReadPicker group={group} weekStart={weekStart} userId={userId} onDone={() => setPicking(false)} />
          ) : (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                이번 주에 함께 읽을 공개 자료를 하나 정해 보세요.
              </p>
              <button type="button" onClick={() => setPicking(true)}
                className="btn btn--secondary btn--sm">이번 주 자료 고르기</button>
            </div>
          )
        )}
      </div>

      {/* R2 — 진도 게이트 토론(목업 A 가운데 둘째) */}
      {read?.material && !picking && (
        <GroupDiscussion group={group} read={read} myPct={myPct} userId={userId} />
      )}

      {/* R1 — 이번 주 우리(목업 A 하단): 주간 거울 합계, 등수 없음 */}
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

  const rowsByGroup = useMemo(() => {
    const byGroup = {};
    for (const gid of groupIds) byGroup[gid] = (snapshots || []).filter((r) => r.group_id === gid);
    return byGroup;
  }, [groupIds, snapshots]);
  const sumsByGroup = useMemo(() => {
    const weekStartMs = new Date(`${weekStart}T00:00:00+09:00`).getTime();
    const byGroup = {};
    for (const gid of groupIds) byGroup[gid] = { ...sumGroupSnapshots(rowsByGroup[gid]), weekStartMs };
    return byGroup;
  }, [groupIds, rowsByGroup, weekStart]);
  const readsByGroup = useMemo(() => {
    const byGroup = {};
    for (const r of reads || []) byGroup[r.group_id] = r;
    return byGroup;
  }, [reads]);

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
        같은 자료를 함께 읽는 소그룹 — 토론은 각자 읽은 데까지만, 주간 기록은 합계로만.
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
              snapshotRows={rowsByGroup[g.id]}
              snapshotSum={sumsByGroup[g.id]}
              read={readsByGroup[g.id]}
              weekStart={weekStart}
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
