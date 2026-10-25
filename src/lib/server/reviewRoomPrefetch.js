// 복습방 첫 화면 숫자를 서버에서 미리 센다(VOCAB-FIRST-NUMBERS-001 — 로그인 감사 F2 · 서재 LIBRARY-PREFETCH-001 선례).
// 읽기는 브라우저 API 라우트(GET vocabulary?view=learning · fsrs · capabilities)와 **같은 서버 함수**다 — 새 조회 · 새 RPC 없음.
// 로그인 확인은 requireUserClaims(쿠키 접근 토큰의 서명만 확인 — AUTH-READ-CLAIMS-001 requireUserForRead의 빠른 길)다.
// requireUserForRead의 물러서는 길(getUser)은 서버 컴포넌트에서 쓰지 않는다: 만료 임박 토큰을 갱신하면 새 쿠키를 심을 수 없어
// 브라우저의 refresh token이 버려진다(LIBRARY-PREFETCH-002). 그때는 null — 지금처럼 브라우저가 받는다.
// 페이지를 막지 않는다: page.jsx는 이 약속을 기다리지 않고 넘기고(본문 · 골격이 먼저 나간다), 숫자는 같은 HTML 응답의 뒷부분으로 온다.
// 손님 · 세션 없음 · 실패 · 예산 초과 · 호환 모드 → null. 계정 데이터는 이 요청의 응답에만 실린다(공유 캐시 없음 — 페이지는 동적 · private no-store).
import { requireUserClaims } from '@/lib/supabaseServer';
import { fsrsServiceClient, readFsrsStatus } from '@/lib/server/fsrsLearning';
import { readVocabularyLearningSnapshot } from '@/lib/server/fsrsVocabulary';
import { readLearningCapabilities } from '@/lib/server/learningCapabilities';
import { projectVocabularyLearningRows } from '@/lib/vocabularyLearningRows';
import { buildReviewRoomFirstScreen } from '@/lib/reviewRoomFirstScreen';
import { profileReviewLang } from '@/lib/reviewScope';

export const REVIEW_ROOM_PREFETCH_BUDGET_MS = 800;

const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve('timeout'), Math.max(0, ms)));

/** 명시 범위 주소 중 첫 화면 숫자를 쓸 수 없는 것(급수 · 출처 · 상태 · 종류 · 무효) — 서버가 읽지 않는다. */
export function firstScreenSkipped(reviewScope) {
  if (reviewScope?.invalid) return true;
  const scope = reviewScope?.explicit ? reviewScope.scope : null;
  return !!scope && (!!scope.level || !!scope.source || (scope.state || 'due') !== 'due' || !!scope.type);
}

async function readProfileLang(client, userId) {
  const { data, error } = await client.from('profiles').select('learning_language').eq('id', userId).maybeSingle();
  if (error) throw error;
  return profileReviewLang(data);
}

/** 이 요청의 로그인 계정(쿠키 접근 토큰의 서명 확인 — 갱신 없음). 손님 · 만료 임박 · 실패 · 시간 초과는 null. 던지지 않는다. */
export async function reviewRoomSession({ auth = requireUserClaims, budgetMs = REVIEW_ROOM_PREFETCH_BUDGET_MS } = {}) {
  try {
    const session = await Promise.race([auth(), timeout(budgetMs)]);
    return session === 'timeout' || session?.error || !session?.user?.id ? null : session;
  } catch {
    return null;
  }
}

/**
 * session = reviewRoomSession() 결과(page.jsx가 한 번 확인해 넘긴다). 없으면 여기서 확인한다.
 * @returns {Promise<null | object>} buildReviewRoomFirstScreen 결과(계정 id · 유효 시각 포함) 또는 null. 던지지 않는다.
 */
export async function prefetchReviewRoomFirstScreen(reviewScope, { budgetMs = REVIEW_ROOM_PREFETCH_BUDGET_MS, auth = requireUserClaims,
  session: given, serviceClient = fsrsServiceClient, now = Date.now } = {}) {
  const deadline = Date.now() + budgetMs;
  try {
    if (firstScreenSkipped(reviewScope)) return null;
    const session = given || await reviewRoomSession({ auth, budgetMs });
    if (!session?.user?.id) return null;
    const userId = session.user.id, service = serviceClient();
    const reads = (async () => {
      const [snapshot, fsrs, profileLang] = await Promise.all([
        readVocabularyLearningSnapshot({ serviceClient: service, userId }),
        readFsrsStatus({ authClient: session.supabase, serviceClient: service, userId }),
        readProfileLang(session.supabase, userId),
      ]);
      // 브라우저와 같은 모양(응답 본문 JSON)으로 맞춘다 — 날짜 등은 JSON을 거친 값으로 센다.
      const fsrsBody = JSON.parse(JSON.stringify(fsrs));
      const learning = projectVocabularyLearningRows(snapshot, { actorId: userId });
      // 한국어 능력은 한국어 표현이 있을 때만 숫자를 바꾼다 — 없으면 읽지 않는다(능력 지문 RPC가 무겁다).
      const capabilities = learning.rows.some(row => row.language === 'Korean') ? await readLearningCapabilities(session.supabase) : null;
      return buildReviewRoomFirstScreen({ actorId: userId, learning, fsrs: fsrsBody, capabilities, profileLang, now: now() });
    })();
    reads.catch(() => {});
    const result = await Promise.race([reads, timeout(deadline - Date.now())]);
    return result === 'timeout' ? null : result;
  } catch {
    return null;
  }
}
