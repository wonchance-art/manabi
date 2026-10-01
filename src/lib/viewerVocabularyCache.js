// 뷰어의 즉시 반응만 담당한다. DB 행·FSRS 계산·저장 정본은 바꾸지 않는다.
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
