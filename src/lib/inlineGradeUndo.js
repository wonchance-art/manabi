// 채점 한 번 되돌리기(W R3 undo 모델) — 뷰어 인라인 복습과 HSK 단어 페이지가 같이 쓴다(2026-10-19 KST 뷰어에서 옮김).
// 서버 행은 그 채점이 아직 마지막일 때만(last_reviewed_at 일치) 채점 직전 5필드로 돌리고, 보상 이벤트 한 건(source 'ui' · undo)을 남긴다.
// 캐시 되돌리기 · 무효화 · 알림은 호출부가 한다(화면마다 캐시 모양이 다르다).
// last = { wordId, itemKey, lang, rating, prev(5필드), reviewedAt, queued }.
import { assertLegacyFsrsAllowed } from './fsrsLegacyBoundary';
import { logReviewEvents } from './reviewEvents';

export async function revertInlineGrade(supabase, { userId, last }) {
  await assertLegacyFsrsAllowed(supabase, { userId, cardId: last.wordId,
    itemKey: last.itemKey, language: last.lang });
  if (last.queued) {
    // 기존 outbox는 전송과 삭제 사이의 잠금을 제공하지 않는다. 성공을 가장해
    // 화면만 되돌리거나 전송 중인 기록을 지우지 않고, 후속 outbox 개편까지 보존한다.
    throw new Error('오프라인에 저장한 채점은 동기화 중일 수 있어 여기서 취소할 수 없어요.');
  }
  const { last_reviewed_at: prevReviewedAt = null, ...prevStats } = last.prev || {};
  const { data, error } = await supabase.from('user_vocabulary')
    .update({ ...prevStats, last_reviewed_at: prevReviewedAt }).eq('id', last.wordId)
    .eq('user_id', userId).eq('last_reviewed_at', last.reviewedAt).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('이후 복습 기록이 있어 되돌리지 않았어요.');
  logReviewEvents(userId, [{
    lang: last.lang, source: 'ui', item_key: last.itemKey, correct: true,
    detail: { qtype: 'undo', undo_of: { item_key: last.itemKey, rating: last.rating, reviewed_at: last.reviewedAt } },
  }]);
}
