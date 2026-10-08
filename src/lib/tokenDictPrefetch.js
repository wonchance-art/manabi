// 표제어 사전 행 미리 받기(AE-R1 설계서 §5.3 · VIEWER-V2-ROUNDS-001 §2.2 T2 → T0).
// 지금 카드는 탭마다 morpheme_dictionary를 한 행씩 읽는다(ViewerPage `['token-dict', lang, key]`).
// 자료를 열 때 고유 표제어를 100개씩 `.in('base_form', …)`으로 받아 **같은 캐시 키를 같은 모양으로**
// 채운다 — 카드 쪽 조회 코드는 그대로이고(재사용), 같은 데이터가 더 일찍 캐시에 있을 뿐이다.
// - 읽기 권한 경로가 같다: 같은 supabase 클라이언트·같은 표·같은 RLS(인증 사용자 SELECT,
//   마이그레이션 20260415000200). 비로그인은 RLS가 막으므로 아예 요청하지 않는다.
// - 개인 데이터가 아니다(공유 사전). 쓰기 0.
// - 실패·이상 응답이면 아무것도 채우지 않는다 → 카드는 지금처럼 단건 조회한다(조용한 폴백).
// - 이미 캐시에 있는 키는 덮지 않는다(교정 직후 값 등 더 새 값 보존).

/** 카드 조회와 같은 열·같은 순서 — 캐시에 넣는 객체 모양이 단건 조회 결과와 같아야 한다. */
export const TOKEN_DICT_COLUMNS = ['meanings', 'reading', 'pos'];
export const TOKEN_DICT_CHUNK = 100;

/** ViewerPage 단건 조회와 같은 캐시 키(그 쿼리의 queryKey 리터럴과 소스 계약으로 묶는다). */
export function tokenDictQueryKey(language, key) {
  return ['token-dict', language, key];
}

/** 카드의 사전 키 — ViewerPage `selectedLexKey || selectedToken?.text`(sep_link ‖ base_form ‖ text). */
export function tokenDictKeyOf(token) {
  return token?.sep_link || token?.base_form || token?.text || '';
}

// PostgREST in.(…) 값 — 큰따옴표·역슬래시·제어 문자는 supabase-js가 이스케이프하지 않으므로 뺀다
// (그 드문 키는 카드를 열 때 단건 경로로 간다).
const UNSAFE = /["\\\u0000-\u001f]/u;
const LEXICAL = /[\p{L}\p{N}]/u;

/**
 * 자료의 고유 표제어 — 분석 순서(json.sequence) 첫 등장 순. 개행·글자 없는 토큰(문장부호)은 뺀다.
 * @returns {string[]}
 */
export function collectTokenDictKeys(processedJson) {
  const dictionary = processedJson?.dictionary;
  const sequence = Array.isArray(processedJson?.sequence) ? processedJson.sequence : Object.keys(dictionary || {});
  if (!dictionary) return [];
  const keys = new Set();
  for (const id of sequence) {
    const token = dictionary[id];
    if (!token || token.pos === '개행') continue;
    const key = tokenDictKeyOf(token);
    if (!key || !key.trim() || !LEXICAL.test(key) || UNSAFE.test(key)) continue;
    keys.add(key);
  }
  return [...keys];
}

export function chunkKeys(keys, size = TOKEN_DICT_CHUNK) {
  const out = [];
  for (let i = 0; i < keys.length; i += size) out.push(keys.slice(i, i + size));
  return out;
}

/**
 * 한 묶음 응답 → 캐시에 넣을 [키, 값] 목록. 응답이 배열이 아니거나 base_form 없는 행이 있으면
 * 신뢰하지 않고 null(아무것도 채우지 않음). 요청한 키 중 행이 없는 키는 null — 단건 조회의
 * maybeSingle()이 행 없음에 돌려주는 값과 같다.
 */
export function tokenDictEntriesFromRows(chunk, rows) {
  if (!Array.isArray(rows)) return null;
  const byKey = new Map();
  for (const row of rows) {
    if (!row || typeof row.base_form !== 'string') return null;
    if (byKey.has(row.base_form)) return null; // (base_form, language) 유일 — 어기면 단건 경로에 맡긴다
    byKey.set(row.base_form, Object.fromEntries(TOKEN_DICT_COLUMNS.map((column) => [column, row[column] ?? null])));
  }
  return chunk.map((key) => [key, byKey.has(key) ? byKey.get(key) : null]);
}

/**
 * 미리 받기 실행. 캐시에 없는 키만 100개씩 순서대로 요청한다.
 * @param {{supabase, queryClient, language:string, keys:string[], signal?:AbortSignal}} input
 * @returns {Promise<{requests:number, filled:number, failed:boolean}>}
 */
export async function prefetchTokenDict({ supabase, queryClient, language, keys, signal }) {
  const pending = (keys || []).filter((key) => queryClient.getQueryData(tokenDictQueryKey(language, key)) === undefined);
  let requests = 0, filled = 0;
  for (const chunk of chunkKeys(pending)) {
    if (signal?.aborted) break;
    requests += 1;
    let rows;
    try {
      let query = supabase
        .from('morpheme_dictionary')
        .select(['base_form', ...TOKEN_DICT_COLUMNS].join(', '))
        .eq('language', language)
        .in('base_form', chunk);
      if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) return { requests, filled, failed: true };
      rows = data;
    } catch {
      return { requests, filled, failed: true };
    }
    if (signal?.aborted) break;
    const entries = tokenDictEntriesFromRows(chunk, rows);
    if (!entries) return { requests, filled, failed: true };
    for (const [key, value] of entries) {
      const queryKey = tokenDictQueryKey(language, key);
      if (queryClient.getQueryData(queryKey) !== undefined) continue; // 그사이 단건 조회가 채웠으면 그 값을 둔다
      queryClient.setQueryData(queryKey, value);
      filled += 1;
    }
  }
  return { requests, filled, failed: false };
}

/**
 * 미리 받기 조건(설계서 §5.3·§11.2): 로그인(RLS) · 한국어 아님(사전 미지원, 카드 조회도 꺼짐) ·
 * 분석 완료(completed·partial). 수업 모드도 같은 카드 조회를 쓰므로 같은 조건으로 켠다.
 */
export function tokenDictPrefetchEnabled({ user, language, processedJson, status }) {
  const state = processedJson?.status || status;
  return !!user?.id && !!language && language !== 'Korean'
    && (state === 'completed' || state === 'partial') && !!processedJson?.dictionary;
}
