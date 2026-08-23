/**
 * 학습 그룹 R1 — 함께 읽는 소그룹 (rfc-study-groups §4.1~4.2, 오너 §9 권고안 승인).
 * 원칙(§3): 개인 원장은 비공개 — 공유는 각자 스스로 밀어 넣는 주간 스냅샷 합계 숫자뿐.
 * 등수·정렬 없음(§9-7 그룹 합계만). 실패는 조용히(그룹 표면만 비활성 — 개인 학습 무영향).
 * 주간 경계는 growthStats.kstWeekStartMs 정본만 쓴다(신설 금지).
 */
import { supabase } from './supabase';
import { kstWeekStartMs } from './growthStats';

/** 그룹 상한(§9-2 오너 확정) — 서버 RPC와 같은 값(계약 테스트로 동치 핀). */
export const MAX_GROUPS_PER_USER = 3;

/** 이번 주 시작일 'YYYY-MM-DD'(KST) — 스냅샷 PK의 week_start. weekRangeLabel과 같은 변환. */
export function kstWeekStartDate(nowMs = Date.now()) {
  return new Date(kstWeekStartMs(nowMs) + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 내 주간 리포트(buildWeeklyReport 산출) → 스냅샷 행 필드.
 * accuracy 대신 correct(정수)를 실어 합계 쪽에서 정답률을 재계산한다(반올림 누적 방지).
 */
export function snapshotFromWeekly(weekly, nowMs = Date.now()) {
  if (!weekly) return null;
  return {
    week_start: kstWeekStartDate(nowMs),
    reviews: weekly.reviews?.total || 0,
    correct: weekly.reviews?.correct || 0,
    added: weekly.newWords || 0,
    met: weekly.metWords || 0,
    reads: weekly.readsCompleted || 0,
  };
}

/**
 * 스냅샷 행 합산 — "이번 주 우리"(그룹 합계, 등수 없음).
 * accuracy는 합산 후 재계산(표본 0이면 null — 0 무표기 결).
 */
export function sumGroupSnapshots(rows) {
  const sum = { reviews: 0, correct: 0, added: 0, met: 0, reads: 0 };
  for (const r of rows || []) {
    sum.reviews += r?.reviews || 0;
    sum.correct += r?.correct || 0;
    sum.added += r?.added || 0;
    sum.met += r?.met || 0;
    sum.reads += r?.reads || 0;
  }
  return {
    ...sum,
    accuracy: sum.reviews > 0 ? sum.correct / sum.reviews : null,
    hasAny: sum.reviews > 0 || sum.added > 0 || sum.met > 0 || sum.reads > 0,
  };
}

/** RPC 오류 → 사용자 문구(그 외는 일반 문구 — 원문 미노출). */
export function groupErrorMessage(error) {
  const msg = String(error?.message || '');
  if (msg.includes('invalid code')) return '코드가 올바르지 않아요. 다시 확인해 주세요.';
  if (msg.includes('group full')) return '이 그룹은 정원이 가득 찼어요.';
  if (msg.includes('group limit')) return `그룹은 ${MAX_GROUPS_PER_USER}개까지 함께할 수 있어요.`;
  return '잠시 후 다시 시도해 주세요.';
}

/** 내 그룹 목록 — 멤버십에서 그룹을 딸려 온다(멤버만 조회 가능한 RLS 안). */
export async function fetchMyGroups(userId) {
  const { data, error } = await supabase
    .from('study_group_members')
    .select('group_id, joined_at, study_groups (id, name, lang, join_code, capacity, created_at)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || [])
    .map((row) => row.study_groups)
    .filter(Boolean)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/** 그룹별 멤버 수 — 헤더 "멤버 4" 표기용. */
export async function fetchGroupMemberCounts(groupIds) {
  const counts = {};
  await Promise.all((groupIds || []).map(async (gid) => {
    const { count, error } = await supabase
      .from('study_group_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('group_id', gid);
    if (!error) counts[gid] = count || 0;
  }));
  return counts;
}

/** 이번 주 스냅샷 행 — 내 그룹들 것만(RLS가 멤버 밖을 걸러 준다). */
export async function fetchGroupSnapshots(groupIds, weekStartDate) {
  if (!groupIds?.length) return [];
  const { data, error } = await supabase
    .from('study_group_snapshots')
    .select('group_id, user_id, reviews, correct, added, met, reads')
    .in('group_id', groupIds)
    .eq('week_start', weekStartDate);
  if (error) throw error;
  return data || [];
}

const PUSH_THROTTLE_MS = 5 * 60 * 1000;

/**
 * 내 주간 스냅샷을 그룹들에 upsert — 그룹 화면 진입 때 호출(5분 스로틀).
 * 실패·게스트·마이그레이션 미적용은 조용히(무해성 — 표시는 이미 있는 행으로만).
 */
export async function pushGroupSnapshots(groupIds, userId, weekly, storage) {
  if (!groupIds?.length || !userId) return;
  const row = snapshotFromWeekly(weekly);
  if (!row) return;
  const now = Date.now();
  for (const gid of groupIds) {
    const key = `group-snap:${gid}`;
    try {
      const last = Number(storage?.getItem?.(key) || 0);
      if (now - last < PUSH_THROTTLE_MS) continue;
    } catch {}
    try {
      const { error } = await supabase
        .from('study_group_snapshots')
        .upsert({ group_id: gid, user_id: userId, ...row, updated_at: new Date().toISOString() }, {
          onConflict: 'group_id,user_id,week_start',
        });
      if (!error) {
        try { storage?.setItem?.(key, String(now)); } catch {}
      }
    } catch {}
  }
}

export async function createGroup(name, lang) {
  const { data, error } = await supabase.rpc('create_group', { p_name: name, p_lang: lang });
  if (error) throw error;
  return data?.[0] || null; // { group_id, join_code }
}

export async function joinGroup(code) {
  const { data, error } = await supabase.rpc('join_group', { p_code: code });
  if (error) throw error;
  return data; // group id
}

export async function leaveGroup(groupId, userId) {
  const { error } = await supabase
    .from('study_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}
