// 뷰어의 즉시 반응만 담당한다. DB 행·FSRS 계산·저장 정본은 바꾸지 않는다.
import { buildVocabularyWordIndex, mergeVocabularyWordIndexCards } from './vocabularyDueIndex.js';
import { fetchVocabularyLearningCards, VOCABULARY_LEARNING_CARDS_MAX } from './vocabularyLearningRows.js';
import { QUERY_CLIENT_DEFAULTS } from './queryClientDefaults.js';

// 저장 · 만기 색인(['vocab-words', userId])의 신선도 — 앱 기본값(2분)과 같다(로그인 감사 F3③ 2026-10-25 KST). 같은 키를 쓰는 단어장 글자 칸
// (LevelWordScreen)은 이미 기본값이었고 뷰어만 30초로 줄여 두어, 서재에서 자료를 하나씩 열 때마다 전체 목록(3,000단어 2.2MB)을 다시 받았다.
// 뷰어 저장 · 채점 · 되돌리기, 단어장(invalidateVocabularyLearning), 아는 단어 · 제외 · 문맥 담기는 이 키를 무효화한다. 무효화하지 않는 쓰기
// (오늘 학습 · 월드 퀘스트의 채점, 다른 기기)는 단어장 학습 목록(['vocab', userId, 'learning'], 기본값 2분)과 같은 처지가 된다.
export const VOCAB_WORDS_STALE_MS = QUERY_CLIENT_DEFAULTS.queries.staleTime;

/**
 * 단어장이 받아 둔 같은 완전 snapshot(['vocab', userId, 'learning'] — useVocabData의 fetchVocabLearningData, 같은 /api/learning/vocabulary)이
 * 신선하면 그것으로 색인을 만든다 — 단어장 → 뷰어에서 같은 2.2MB를 다시 받지 않는다. 새 조회 함수는 없다(정본 그대로 · 색인 함수도 같다).
 * 쓰지 않는 경우(undefined — 지금처럼 받는다): 다른 계정 · 실패 · 기기 사본(offline · 불완전) · 무효화됨(채점 뒤 낡음 표시) · 신선도 밖.
 * 받은 시각은 그 snapshot의 dataUpdatedAt 그대로 둔다(useQuery initialDataUpdatedAt) — 신선도가 늘어나지 않는다.
 * @returns {object | undefined} buildVocabularyWordIndex 결과
 */
export function vocabWordsFromLearningCache(queryClient, userId, { staleTime = VOCAB_WORDS_STALE_MS, now = Date.now() } = {}) {
  if (!userId) return undefined;
  const state = queryClient.getQueryState(['vocab', userId, 'learning']);
  const snapshot = state?.data;
  if (!snapshot || state.status !== 'success' || state.isInvalidated || snapshot.offline || snapshot.complete !== true || snapshot.actorId !== userId) return undefined;
  if (!(now - state.dataUpdatedAt < staleTime)) return undefined;
  try {
    return buildVocabularyWordIndex(snapshot);
  } catch {
    return undefined;
  }
}
export const REVIEW_SRS_FIELDS = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];
let reviewTicket = 0;

export function insertConfirmedVocabulary(queryClient, userId, row) {
  if (!userId || !row?.id || row.user_id !== userId) return;
  queryClient.setQueryData(['vocab-words', userId], (cur) => {
    const byKey = new Map(cur?.byKey || []);
    const surfaces = new Set(cur?.surfaces || []);
    const bases = new Set(cur?.bases || []);
    // ignoreDuplicates의 INSERT 반환만 사용한다. 기존 개인 뜻/일정을 덮지 않는다.
    if (row.word_text && !byKey.has(`surface:${row.word_text}`)) {
      byKey.set(`surface:${row.word_text}`, row);
      surfaces.add(row.word_text);
    }
    if (row.base_form && !byKey.has(`base:${row.base_form}`)) {
      byKey.set(`base:${row.base_form}`, row);
      bases.add(row.base_form);
    }
    return { ...cur, byKey, surfaces, bases };
  });
}

export function beginVocabularyReview(queryClient, userId, vocab, nextStats) {
  const ticket = ++reviewTicket;
  const prev = Object.fromEntries(REVIEW_SRS_FIELDS.map(key => [key, vocab[key]]));
  queryClient.setQueryData(['vocab-words', userId], cur => {
    if (!cur?.byKey) return cur;
    let hit = false;
    const byKey = new Map([...cur.byKey].map(([key, row]) => {
      if (row?.id !== vocab.id) return [key, row];
      hit = true;
      return [key, { ...row, ...nextStats, __pendingReview: ticket }];
    }));
    return hit ? { ...cur, byKey } : cur;
  });
  return { userId, wordId: vocab.id, prev, ticket };
}

export function preservePendingVocabularyReviews(fresh, current) {
  if (!current?.byKey || !fresh?.byKey) return fresh;
  const pending = new Map([...current.byKey.values()].filter(row => row?.__pendingReview).map(row => [row.id, row]));
  if (!pending.size) return fresh;
  const byKey = new Map([...fresh.byKey].map(([key, row]) => [key, pending.has(row.id) ? { ...pending.get(row.id), ...(typeof row.is_excluded === 'boolean' ? { is_excluded: row.is_excluded } : {}) } : row]));
  for (const [key, row] of current.byKey) {
    if (row?.__pendingReview && !byKey.has(key)) byKey.set(key, row);
  }
  return { ...fresh, byKey,
    surfaces: new Set([...fresh.surfaces, ...[...pending.values()].map(row => row.word_text).filter(Boolean)]),
    bases: new Set([...fresh.bases, ...[...pending.values()].map(row => row.base_form).filter(Boolean)]),
  };
}

export function settleVocabularyReview(queryClient, context, patch) {
  if (!context) return;
  const { userId, wordId, ticket, prev } = context;
  queryClient.setQueryData(['vocab-words', userId], cur => {
    if (!cur?.byKey) return cur;
    let hit = false;
    const byKey = new Map([...cur.byKey].map(([key, row]) => {
      // 늦은 실패가 다른 단어/후속 평가/새 서버 행을 되감지 않는다.
      if (row?.id !== wordId || row.__pendingReview !== ticket) return [key, row];
      hit = true;
      const restored = { ...row };
      delete restored.__pendingReview;
      for (const [field, value] of Object.entries(patch || prev)) {
        if (value === undefined) delete restored[field]; else restored[field] = value;
      }
      return [key, restored];
    }));
    return hit ? { ...cur, byKey } : cur;
  });
}

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * 저장 · 채점 뒤 색인(['vocab-words', userId])에 그 카드만 새로 받아 붙인다(SNAPSHOT-CARDS-001, 오너 「A안 적용」 2026-10-26 KST).
 * 전에는 저장 한 번마다 이 키를 무효화해 전체 snapshot(모든 언어 · 모든 단어, 운영 1.6~4 s)을 다시 받았다 — 운영 로그에서 단어 저장과
 * 전체 snapshot RPC가 1:1로 움직였다. 막 담은 카드의 서버 판정(다음 복습 · 만기 · 아는 단어 · 제외)은 같은 판정의 카드 몇 장 읽기로 받고
 * (브라우저가 판정을 계산하지 않는다), 붙인 뒤 낡음 표시만 한다(refetchType 'none' — 다음 마운트 · 초점 · 신선도 밖에서 평소대로 받는다).
 * 평가 전송 중 행은 전체 받기와 같은 길(preservePendingVocabularyReviews)로 지킨다. 다른 계정의 응답 · 계정 전환 뒤 도착한 응답은 버린다.
 * 지금처럼(무효화 → 전체 다시 받기)으로 물러서는 경우: id 없음(이미 있던 단어 — upsert가 행을 돌려주지 않았다) · 50장 넘음 · 색인 없음 ·
 * 좁은 읽기 실패 · 붙일 수 없음(mergeVocabularyWordIndexCards = null) · 그 사이 전체 받기가 진행 중(그 받기가 저장 전 것일 수 있다 — 무효화가
 * 취소하고 새로 받는다, 전과 같은 동작).
 * @returns {Promise<'patched'|'full'|'discarded'|'skipped'>}
 */
export async function refreshVocabWordsCards(queryClient, userId, ids, { fetchCards = fetchVocabularyLearningCards, getActorId = () => userId } = {}) {
  if (!userId) return 'skipped';
  const queryKey = ['vocab-words', userId];
  const full = async () => { await queryClient.invalidateQueries({ queryKey }); return 'full'; };
  const wanted = [...new Set((ids || []).filter(value => typeof value === 'string' && CARD_ID.test(value)))];
  if (!wanted.length || wanted.length > VOCABULARY_LEARNING_CARDS_MAX || !queryClient.getQueryData(queryKey)?.byKey) return full();
  let cards;
  try { cards = await fetchCards(userId, wanted, { getActorId }); }
  catch (error) { return error?.code === 'vocabulary_learning_owner_mismatch' ? 'discarded' : full(); }
  if (cards?.actorId !== userId || getActorId() !== userId) return 'discarded';
  if (queryClient.isFetching({ queryKey, exact: true }) > 0) return full();
  let patched = false;
  try {
    queryClient.setQueryData(queryKey, current => {
      const next = mergeVocabularyWordIndexCards(current, cards, { ids: wanted });
      if (!next) return current;
      patched = true;
      return preservePendingVocabularyReviews(next, current);
    });
  } catch { patched = false; } // 저장은 이미 끝났다 — 색인 패치의 뜻밖 실패는 전처럼 전체로(저장 경로에 오류를 올리지 않는다)
  if (!patched) return full();
  await queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
  return 'patched';
}
