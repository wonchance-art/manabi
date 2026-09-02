'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendlyToastMessage } from './errorMessage';
import { detectLang } from './constants';
import { recordReviewCompleted } from './learn/progressStore';

// W R3 undo 스냅샷이 복원하는 SRS 5필드(persistVocabGrade 페이로드와 같은 snake_case)
export const INLINE_SRS_FIELDS = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];

/**
 * vocab-words 캐시(fetchUserVocabWords 모양 { byKey, surfaces, bases })에서 한 단어 행을 고친다 —
 * 낙관 반영(W 후속 ③). 오프라인 큐에 담긴 채점은 서버에 없으니 refetch로는 「복습 시점이에요」가
 * 안 사라진다; 캐시를 직접 고쳐야 카드가 전진한다. undo도 같은 함수로 prev를 되돌린다.
 * 같은 행이 surface·base 두 키에 걸려 있을 수 있어 id로 전부 찾는다. 캐시가 없거나 모양이
 * 다르거나 그 단어가 없으면 그대로 둔다(새 Map은 맞았을 때만 — 무의미한 리렌더 방지).
 */
export function patchVocabWordsCache(queryClient, userId, wordId, patch) {
  queryClient.setQueryData(['vocab-words', userId], (cur) => {
    if (!cur?.byKey || !wordId) return cur;
    const byKey = new Map();
    let hit = false;
    for (const [k, v] of cur.byKey) {
      if (v?.id === wordId) { byKey.set(k, { ...v, ...patch }); hit = true; } else byKey.set(k, v);
    }
    return hit ? { ...cur, byKey } : cur;
  });
}

/**
 * 뷰어 인라인 복습: 단어 카드에서 평가 시 FSRS 갱신.
 * 척도는 복습 화면 정본과 동일한 4등급(1 다시 · 2 어려움 · 3 알맞음 · 4 쉬움 — W R3, #1077
 * 5504387198). 예전 `모름/애매/알아`=1/2/3은 Easy(4)가 없어 아무리 잘 알아도 D가 2.12에
 * 머물렀다(복습 화면의 「쉬움」은 1.00). 같은 라벨 = 같은 값.
 * 저장은 복습 화면과 **같은 한 길**(recordReviewCompleted — 이벤트 + SRS + 보상 + 오프라인 큐,
 * W 후속 ③). 예전엔 여기서 persistVocabGrade·logReviewEvents·recordActivity를 따로 불러
 * 오프라인이면 「복습 저장 실패」로 채점이 유실됐다. 이제 오프라인·순간 단절은 큐에 담기고
 * 온라인 복귀 때 Layout의 flush가 보낸다(중복 제거·덮어쓰기 방지는 큐 계약 그대로).
 * 결과에 `prev`(채점 직전 5필드)·`reviewedAt`·`queued`를 실어 호출부(카드)가 undo 스냅샷을 만든다 —
 * 훅은 채점만 하고 스냅샷은 호출부가 갖는다. 큐에 담긴 채점의 undo는 큐 항목 제거(복습 화면 R2와 같다).
 */
export function useInlineReview({ user, fetchProfile, toast }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vocab, rating }) => {
      const { calculateFSRS } = await import('./fsrs');
      const nextStats = calculateFSRS(rating, {
        interval: vocab.interval ?? 0,
        ease_factor: vocab.ease_factor ?? 0,
        repetitions: vocab.repetitions ?? 0,
        next_review_at: vocab.next_review_at,
      });
      const prev = Object.fromEntries(INLINE_SRS_FIELDS.filter((k) => vocab[k] !== undefined).map((k) => [k, vocab[k]]));
      // 채점 시각은 정본 안에서 한 번 찍힌다 — 반환 reviewedAt이 이벤트 created_at·SRS·큐 항목의 열쇠.
      // 인라인 평가는 자기채점이라 flash와 동일 — 비대칭 신뢰(성공 rung 크레딧 0, 오답 자인만 강등)로 skillRung에서 다뤄진다.
      const r = await recordReviewCompleted(user?.id, {
        type: 'vocab',
        itemKey: vocab.word_text,
        lang: vocab.language || detectLang(vocab.word_text),
        correct: rating > 1,
        detail: { word_id: vocab.id, meaning: vocab.meaning, rating, qtype: 'flash' },
      }, {
        // calculateFSRS 반환 키 그대로 — DB 컬럼과 동일(snake_case, VocabPage 페이로드 계약과 같다)
        interval: nextStats.interval ?? 0,
        ease_factor: nextStats.ease_factor ?? 0,
        repetitions: nextStats.repetitions ?? 0,
        next_review_at: nextStats.next_review_at,
      });
      // 큐마저 못 쓴 환경만 실패로 표면화 — 정본이 { ok:false }를 돌려주면 삼키지 않는다
      if (!r?.ok) throw r?.error || new Error('review-save-failed');
      return { vocab, rating, nextStats, prev, reviewedAt: r.reviewedAt, queued: !!r.queued };
    },
    onSuccess: async ({ vocab, nextStats, reviewedAt, queued }) => {
      // 낙관 반영 → 무효화. 온라인이면 refetch가 정본으로 덮고, 오프라인이면 낙관값이 남아 카드가 전진한다.
      patchVocabWordsCache(queryClient, user?.id, vocab.id, { ...nextStats, last_reviewed_at: reviewedAt });
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      // 보상(streak)은 정본 안에서 기록됐다 — 여기서는 표시만 새로 고친다(큐 경로는 아직 기록 전)
      if (!queued) fetchProfile?.(user.id);
      toast?.(queued ? '복습 저장 — 연결되면 보내요' : '복습 완료!', 'success', 2000);
    },
    onError: (err) => toast?.('복습 저장 실패 — ' + friendlyToastMessage(err), 'error'),
  });
}
