/**
 * 학습 snapshot 나눠 쓰기(SNAPSHOT-SHARE-001, 2026-11-02 KST) — 화면마다 같은 /api/learning/vocabulary를 다시 받지 않는다.
 * 실측(e2e 빌드 · 합성 무거운 계정 3,000단어 · 클라이언트 이동 홈 → 현황 → 단어장 → 뷰어 → 홈 → 서재 → 읽을거리 → 단어 레벨, 2회씩):
 * 44초 경로 5번 중 3번 · 129초 경로 6번 중 2~3번이 같은 계정 · 같은 자료 · 신선도 안의 다시 받기였다(요약 1.9 MB · 전체 2.1 MB, 압축 전).
 * 나눠 쓴 뒤 같은 경로가 2번 · 3번(10.0 → 4.1 MB, 12.0 → 6.0 MB). 채점 3번 뒤 배움 「N개 대기」 412 → 409 · 현황 기억 건강도 새 숫자.
 *
 * 정본은 그대로다 — 새 조회 함수 · 새 서버 모양이 없다(fetchVocabularyLearningRows · fields=summary 그대로). 바뀌는 것은 「언제 받나」뿐:
 * - 요약 소비자(배움 · 현황 · 읽을거리 맞춤도)는 요약 snapshot 한 칸(['vocab', userId, 'summary'])을 같이 쓴다.
 * - 단어장이 막 받은 완전 snapshot(['vocab', userId, 'learning'])이 신선하면 그것을 쓴다 — 요약 칸은 완전 snapshot 칸의 부분 집합이고
 *   (VOCABULARY_LEARNING_SUMMARY_FIELDS ⊂ 전체 칸), 같은 판정 · 같은 행 순서다(SNAPSHOT-LIGHT-001). 뷰어 색인의 선례(F3③)와 같은 규칙.
 * 칸 이름을 'vocab' 아래에 둔 까닭: 채점 · 아는 표시 · 제외 · 저장 · 되돌리기가 이미 ['vocab', userId]를 무효화한다 — 새 무효화 목록 없이
 * 모든 쓰기가 이 칸을 낡음으로 표시한다(계약 vocabularyLearningShare). 계정이 바뀌면 계정 캐시 비우기(accountQueryCache)가 함께 지운다.
 */
import { fetchVocabularyLearningRows } from './vocabularyLearningRows.js';

/** 요약 소비자의 신선도 — 배움 · 현황 · 읽을거리 맞춤도의 staleTime(60초)과 같다. 이보다 오래된 snapshot은 나눠 쓰지 않는다. */
export const VOCAB_SUMMARY_SHARE_MS = 60_000;
export const vocabularyLearningKey = userId => ['vocab', userId, 'learning'];
export const vocabularySummaryKey = userId => ['vocab', userId, 'summary'];

/**
 * 그 칸의 snapshot을 그대로 써도 되면 그 snapshot, 아니면 undefined(지금처럼 받는다).
 * 쓰지 않는 경우: 계정 모름 · 다른 계정 · 실패 · 기기 사본(offline · 불완전) · 무효화됨(쓰기 뒤 낡음 표시) · 신선도 밖 ·
 * (idle 요구 시) 받는 중. 받은 시각은 그 칸의 dataUpdatedAt 그대로다 — 나눠 쓴다고 신선도가 늘지 않는다.
 */
export function settledLearningSnapshot(queryClient, queryKey, userId, { staleTime, now = Date.now(), idle = false } = {}) {
  if (!userId) return undefined;
  const state = queryClient.getQueryState(queryKey);
  const snapshot = state?.data;
  if (!snapshot || state.status !== 'success' || state.isInvalidated || snapshot.offline || snapshot.complete !== true || snapshot.actorId !== userId) return undefined;
  if (idle && state.fetchStatus !== 'idle') return undefined;
  if (!(now - state.dataUpdatedAt < staleTime)) return undefined;
  return snapshot;
}

/**
 * 요약 소비자의 학습 snapshot — 신선한 완전 snapshot → 신선한 요약 snapshot → 새로 받기(같은 요약 읽기, 동시에 부르면 한 번만).
 * 받는 동안 쓰기가 칸을 무효화하면(쓰기 전 숫자일 수 있다) 끝에서 한 번 더 받는다 — 무효화 뒤 화면이 같은 받기에 올라타도
 * 쓴 뒤의 숫자를 받는다. 그래서 받기를 시작할 때 이전 무효화 표시를 지워 둔다(받는 중에는 idle 요구로 아무도 그 칸을 집지 않는다).
 * 다시 받는 동안에도 또 무효화되면 그 결과를 돌려주되 칸은 낡음으로 남긴다(다음 화면은 새로 받는다).
 */
export async function fetchSharedVocabularySummary(queryClient, userId, { now = Date.now() } = {}) {
  const fresh = settledLearningSnapshot(queryClient, vocabularyLearningKey(userId), userId, { staleTime: VOCAB_SUMMARY_SHARE_MS, now })
    || settledLearningSnapshot(queryClient, vocabularySummaryKey(userId), userId, { staleTime: VOCAB_SUMMARY_SHARE_MS, now, idle: true });
  if (fresh) return fresh;
  const queryKey = vocabularySummaryKey(userId);
  const query = () => queryClient.getQueryCache().find({ queryKey, exact: true });
  let dirty = false;
  const snapshot = await queryClient.fetchQuery({ queryKey, staleTime: 0, queryFn: async ({ signal }) => {
    let read;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (query()?.state.isInvalidated) query().setState({ isInvalidated: false });
      read = await fetchVocabularyLearningRows(userId, { signal, fields: 'summary' });
      if (!query()?.state.isInvalidated) return read;
    }
    dirty = true;
    return read;
  } });
  if (dirty) await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
  return snapshot;
}
