// 검색에 싣는 뷰어 자료 = 우리가 만든 공개 자료(LAUNCH-META-002 — 오너 기본값 2026-11-06 KST 「우리 공개 자료만 색인」).
// 「우리」는 관리자 계정(profiles.role = 'admin')이 소유한 공개(visibility 'public') 자료다. 다른 계정이 공개로 돌린 자료는 화면은 그대로 열리고
// 검색에서만 빠진다(그 계정의 글이 검색 결과 · 사이트 지도에 우리 이름으로 오르지 않게). 운영 실측(같은 날): 공개 123건 전부 관리자 소유(분석된 것은 5건 — 아래 isAnalyzedMaterial).
//
// 관리자 목록은 service_role로 읽는다(profiles.role은 공개 뷰 public_profiles에 없다). 인스턴스마다 10분 기억한다 — 뷰어 메타데이터마다
// 조회를 늘리지 않게. 키가 없거나 조회가 실패하면 null(「모름」)이다: 부르는 쪽은 모름을 「남의 자료」로 치지 않는다(잠깐의 장애로 공개 자료를 빼지 않게 —
// 뷰어 제목 조회 실패와 같은 원칙).
import { createClient } from '@supabase/supabase-js';
import { withoutRetiredSeries } from '@/lib/constants';

export const CURATOR_TTL_MS = 10 * 60 * 1000;
export const CURATOR_TIMEOUT_MS = 2500;

let memo = { at: 0, ids: null };
let clientOverride;

function serviceClient() {
  if (clientOverride !== undefined) return clientOverride;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return key && url ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/** 테스트 전용 — 클라이언트를 바꿔 끼우고 기억을 비운다(null이면 키 없음과 같다 · undefined면 원래대로). */
export function __setCuratorClient(client) {
  clientOverride = client;
  memo = { at: 0, ids: null };
}

/** 관리자 계정 id 집합 — 모르면 null. */
export async function curatorIds(now = Date.now()) {
  if (memo.ids && now - memo.at < CURATOR_TTL_MS) return memo.ids;
  const client = serviceClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('profiles').select('id').eq('role', 'admin')
      .abortSignal(AbortSignal.timeout(CURATOR_TIMEOUT_MS));
    if (error || !Array.isArray(data)) return null;
    memo = { at: now, ids: new Set(data.map((row) => row.id)) };
    return memo.ids;
  } catch {
    return null;
  }
}

// 「분석된 자료」 = 뷰어 SSR과 같은 판정(lib/viewerSsr SSR_STATUSES — completed · partial)에 문장이 하나 이상. 분석 전(idle) 자료는 본문이 비어
// 검색 · 사이트 지도에 싣지 않는다(LAUNCH-META-003 — 운영 실측 2026-11-07 KST: 공개 123건 중 분석됨 5 · idle 118, processed_json은 모두 있다).
export const ANALYZED_STATUSES = Object.freeze(['completed', 'partial']);

/** 행이 분석된 자료인지 — processed_json이 있으면 상태 · 문장으로, 제목 조회처럼 상태 칸(analysis_status)만 있으면 상태로. 둘 다 없으면 null(모름). */
export function isAnalyzedMaterial(row) {
  const json = row?.processed_json;
  if (json && typeof json === 'object') {
    return ANALYZED_STATUSES.includes(json.status) && Array.isArray(json.sequence) && json.sequence.length > 0;
  }
  if (row && 'analysis_status' in row) return ANALYZED_STATUSES.includes(row.analysis_status);
  return null;
}

/**
 * 이 자료를 검색에 실을지 — true(싣는다) · false(남의 자료 · 비공개 · 분석 전이라 뺀다).
 * 관리자 목록을 모르면(ids null) 공개 · 분석 여부만 본다(모름을 남의 자료로 치지 않는다). 행에 공개 · 소유자 칸이 없으면(옛 조회) 판단하지 않고 싣는다.
 */
export function isIndexableMaterial(row, ids) {
  if (!row || !('visibility' in row)) return true;
  if (row.visibility !== 'public') return false;
  if (isAnalyzedMaterial(row) === false) return false;
  if (!ids) return true;
  return Boolean(row.owner_id) && ids.has(row.owner_id);
}

/**
 * 사이트 지도용 — 관리자 소유 · 공개 · 분석된(상태 completed · partial + 첫 문장 있음) 자료 id(오름차순). 키가 없으면(로컬 · CI) 빈 목록.
 * 키가 있는데 조회가 실패하면 던진다 — 사이트 지도 판을 다시 만들 때 실패하면 Next는 직전 판을 계속 준다(자료 123건이 한 시간 빠지지 않게).
 */
export async function curatedMaterialIds() {
  const client = serviceClient();
  if (!client) return [];
  const ids = await curatorIds();
  if (!ids) throw new Error('curated materials: 관리자 목록을 읽지 못했어요');
  if (!ids.size) return [];
  // 은퇴 표식 자료는 목록과 같이 색인에서도 뺀다(정본 판정 withoutRetiredSeries — SEED-EXPOSE-001).
  const { data, error } = await withoutRetiredSeries(client.from('reading_materials').select('id'))
    .eq('visibility', 'public').in('owner_id', [...ids])
    .in('processed_json->>status', [...ANALYZED_STATUSES]).not('processed_json->sequence->0', 'is', null)
    .order('id', { ascending: true })
    .abortSignal(AbortSignal.timeout(CURATOR_TIMEOUT_MS));
  if (error || !Array.isArray(data)) throw new Error(`curated materials: ${error?.code || 'no data'}`);
  return data.map((row) => row.id);
}
