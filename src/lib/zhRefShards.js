// 중국어 참고 사전 조각(ZH-REFVOCAB-SHARD-001, 2026-11-08 KST) — 뷰어가 사전 전체(40개 파일 · 11,733단어 · brotli 약 740KB, JS 청크 39개)를
// 자료를 열자마자 받던 것을, 낱말을 고를 때 그 글자의 조각 하나(brotli 중앙값 약 7KB)만 받게 한다.
// 조각 = 글자(코드포인트 % 256)마다 「그 글자를 하나라도 가진 단어 전부」. 그래서
//   낱말 카드: 낱말 첫 글자의 조각에 그 낱말이 있다.
//   한자 창: 그 글자의 조각에 그 글자를 가진 단어가 전부 있다(같은 한자 타일 · 표제어 조회 — viewerHanjaPanel).
// 조각은 빌드 때 굽는 정적 응답(/api/zh-ref/<n>, force-static)이다 — 저장소에 산출물을 두지 않는다. 주소의 v = 배포 판(빌드 커밋).
// 이 파일은 네트워크 클라이언트 · supabase를 import하지 않는다(화면 · 경로 · 시험이 같이 쓴다).

export const ZH_REF_VERSION = 1;
export const ZH_REF_SHARDS = 256;
/** 배포 판 — 빌드 커밋 7자(next.config env). 커밋이 없는 로컬 빌드는 'dev'(캐시하지 않는다). levelWordsPayload와 같은 규칙. */
export const ZH_REF_BUILD = process.env.NEXT_PUBLIC_BUILD_SHA || 'dev';
export const ZH_REF_CACHE = ZH_REF_BUILD === 'dev' ? 'no-cache' : 'public, max-age=31536000, immutable';

const shardOfChar = (ch) => ch.codePointAt(0) % ZH_REF_SHARDS;

/** 낱말(또는 글자)의 조각 번호 — 첫 글자 기준. 빈 값은 -1. */
export function zhRefShardOf(text) {
  const [first] = String(text || '');
  return first ? shardOfChar(first) : -1;
}

export function zhRefShardUrl(shard, build = ZH_REF_BUILD) {
  return `/api/zh-ref/${shard}?v=${encodeURIComponent(build)}`;
}

/** 색인(표제어 → { level, word }) → 조각 하나의 항목 객체 — 그 조각에 속한 글자를 하나라도 가진 단어 전부. */
export function zhRefShardEntries(index, shard) {
  const out = {};
  for (const [word, entry] of index) {
    for (const ch of new Set(word)) {
      if (shardOfChar(ch) === shard) { out[word] = entry; break; }
    }
  }
  return out;
}

/** 조각 받기 → Map(표제어 → { level, word }). 응답이 실패이거나 모양이 다르면 던진다(부르는 쪽이 전체 색인으로 물러난다). */
export async function fetchZhRefShard(shard, { fetchImpl = fetch, build } = {}) {
  const res = await fetchImpl(zhRefShardUrl(shard, build));
  if (!res.ok) throw new Error(`zh-ref ${res.status}`);
  const body = await res.json();
  if (body?.version !== ZH_REF_VERSION || body.shard !== shard || !body.entries || typeof body.entries !== 'object') throw new Error('zh-ref shape');
  return new Map(Object.entries(body.entries));
}
