/** 저장된 문단은 현재 복습 권한·코호트·원문·일정이 같은 경우에만 재사용한다. */
export function canUseStudyPrefetch(materials, legacyRows, actorId, language, at = Date.now()) {
  if (!materials || materials.language !== language || !Array.isArray(materials.dueWords)
      || !Array.isArray(legacyRows) || !actorId) return false;
  const byId = new Map(legacyRows.map(row => [row.id, row]));
  const seen = new Set();
  const fields = ['id', 'user_id', 'word_text', 'base_form', 'language', 'meaning', 'source_sentence', 'source_ref',
    'source_material_id', 'interval', 'ease_factor', 'repetitions', 'last_reviewed_at', 'next_review_at'];
  return materials.dueWords.every(item => {
    const cached = item?.row, current = byId.get(cached?.id);
    if (!cached || !current || seen.has(cached.id) || current.user_id !== actorId || current.language !== language
        || !current.last_reviewed_at || item.word !== current.word_text || item.meaning !== current.meaning) return false;
    const due = Date.parse(current.next_review_at);
    // ms 미만의 DB timestamp는 이 브라우저 시각에서 조기 노출하지 않는다.
    const fractional = /\.\d{3}(\d+)(?:Z|[+-]\d{2}:\d{2})$/.exec(current.next_review_at || '');
    if (!Number.isFinite(due) || !Number.isFinite(at) || due + (fractional && /[1-9]/.test(fractional[1]) ? 1 : 0) > at) return false;
    seen.add(cached.id);
    return fields.every(field => (cached[field] ?? null) === (current[field] ?? null));
  });
}
