// An import attempt owns one immutable original. Retrying analysis never inserts it again.
export function createImportAttempt(row, attemptId) {
  return {
    row: { ...row, processed_json: { ...row.processed_json, metadata: { ...row.processed_json.metadata, importAttempt: attemptId } } },
    record: null, pending: null, uncertain: false,
  };
}

export async function saveImportOnce(client, attempt) {
  if (attempt.record) return attempt.record;
  if (attempt.pending) return attempt.pending;
  attempt.pending = (async () => {
    const row = attempt.row;
    // A response can be lost after the server saved the row. Reconcile that attempt
    // before another insert; a failed reconciliation must not silently create a copy.
    if (attempt.uncertain) {
      const result = await client.from('reading_materials').select('id')
        .eq('owner_id', row.owner_id)
        .eq('processed_json->metadata->>importAttempt', row.processed_json.metadata.importAttempt).limit(1);
      if (result.error) throw result.error;
      if (result.data?.[0]?.id) return (attempt.record = { ...row, id: result.data[0].id });
    }
    attempt.uncertain = true;
    const { data, error } = await client.from('reading_materials').insert([row]).select('id');
    if (error) throw error;
    if (!data?.[0]?.id) throw new Error('저장 결과를 확인하지 못했어요. 다시 시도하면 같은 요청을 확인합니다.');
    return (attempt.record = { ...row, id: data[0].id });
  })();
  try { return await attempt.pending; } finally { attempt.pending = null; }
}

export function interruptedImportJson(text, json) {
  const failed = new Set(json.failed_indices || []);
  text.split('\n').forEach((line, index) => {
    if (line.trim() && index > (json.last_idx ?? -1)) failed.add(index);
  });
  return { ...json, status: json.sequence?.length ? 'partial' : 'pending',
    failed_indices: [...failed].sort((a, b) => a - b),
    metadata: { ...json.metadata, updated_at: new Date().toISOString() } };
}

export async function persistImportAnalysis(client, record, json) {
  const { data, error } = await client.from('reading_materials').update({ processed_json: json })
    .eq('id', record.id).eq('owner_id', record.owner_id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('자료가 삭제되었거나 저장 권한이 변경됐어요.');
}
