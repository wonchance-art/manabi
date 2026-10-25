// 레벨 단어 목록 묶음(LEVEL-LIST-RSC-001, 2026-10-26 KST) — 단어 화면(/japanese/vocab/n5–n1 · /chinese/vocab/h1–h7)의 항목 전체를
// 화면 조각(RSC) 밖 정적 JSON(/api/level-words/{lang}/{level})으로 싣는다. 조각에 실으면 책장 레벨 타일의 미리 받기(7–15개)가
// 0.6–0.9 MB를 받았고(N3 조각 207 KB gz · H7 542 KB gz), 미리 받기를 끄면 탭이 +330 ms 늦었다(오너 우선순위 = 앱 같은 체감).
// 화면은 붙기 전에 항목을 그리지 않으므로(세션 · 상태는 붙은 뒤) 첫 그림은 같다. 받는 때를 앞당기는 두 길:
//   직접 열기 = 서버 페이지가 같은 주소를 <link rel=preload>로 문서 머리에 건다(JS와 나란히 — VOCAB-LEVEL-DOC 배제 사유 「JS 뒤에 받아 LCP +4%」를 막는다).
//   책장 타일 = 누르는 순간(warmLevelWords) 받기 시작해 화면 JS · 그리기와 겹친다(누르기 전에는 받지 않는다 — 미리 받기 비용 0).
// 주소의 v = 배포 판(빌드 커밋) — 판마다 주소가 달라 오래 캐시해도 지난 묶음이 나가지 않는다. 타일도 데이터 없이 같은 주소를 만든다.
// 이 파일은 네트워크 클라이언트 · supabase를 import하지 않는다(화면 · 라우트 · 시험이 같이 쓴다).

export const LEVEL_WORDS_VERSION = 1;
/** 배포 판 — 빌드 커밋 7자(next.config env). 커밋이 없는 로컬 빌드는 'dev'(캐시하지 않는다). */
export const LEVEL_WORDS_BUILD = process.env.NEXT_PUBLIC_BUILD_SHA || 'dev';
/** 판이 붙은 묶음은 브라우저가 1년 보관(주소가 판마다 다르다). 로컬 판은 매번 확인. */
export const LEVEL_WORDS_CACHE = LEVEL_WORDS_BUILD === 'dev' ? 'no-cache' : 'public, max-age=31536000, immutable';

export function levelWordsUrl(lang, levelKey, build = LEVEL_WORDS_BUILD) {
  return `/api/level-words/${lang}/${String(levelKey || '').toLowerCase()}?v=${encodeURIComponent(build)}`;
}

/** 묶음 받기 — 응답이 실패이거나 모양이 다르면 던진다(화면은 「다시 시도」를 띄운다). */
export async function fetchLevelWords(url, { signal, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(url, { signal });
  if (!res.ok) throw new Error(`level-words ${res.status}`);
  const body = await res.json();
  if (body?.version !== LEVEL_WORDS_VERSION || !Array.isArray(body.groups)) throw new Error('level-words shape');
  return body.groups;
}

// 누르는 순간 시작한 받기 — 화면이 처음 받을 때 한 번 넘겨받는다(같은 주소를 두 번 받지 않게). 실패한 받기는 남기지 않는다.
const warm = new Map();
export function warmLevelWords(url) {
  if (!url || warm.has(url)) return;
  const pending = fetchLevelWords(url);
  const drop = () => { if (warm.get(url) === pending) warm.delete(url); };
  pending.catch(drop);
  setTimeout(drop, 60_000); // 눌렀지만 화면이 열리지 않은 받기(취소한 이동)는 1분 뒤 놓는다 — 큰 레벨(H7)이 메모리에 남지 않게
  warm.set(url, pending);
}
/** 화면의 받기 — 먼저 시작한 받기가 있으면 그것을, 없으면 새로. */
export function requestLevelWords(url, opts) {
  const pending = warm.get(url);
  if (pending) { warm.delete(url); return pending; }
  return fetchLevelWords(url, opts);
}
