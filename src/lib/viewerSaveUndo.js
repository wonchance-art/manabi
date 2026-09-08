// 신규 INSERT 반환 행만 취소 대상으로 삼는다. 이후에 다시 조회한 행으로 스냅샷을 바꾸지 않는다.
export async function prepareViewerSaveUndo(client, inserted, source, linked) {
  if (!inserted?.id) return null;
  const { data, error } = await client.from('vocabulary_contexts').select('id, material_id, locator, quote')
    .eq('vocabulary_id', inserted.id).eq('user_id', inserted.user_id);
  if (error || !Array.isArray(data)) return null;
  if (linked) {
    if (data.length !== 1 || String(data[0].material_id) !== String(source.materialId)) return null;
    if (source.tokenId ? data[0].locator?.tokenId !== source.tokenId : data[0].quote !== source.quote) return null;
  } else if (data.length) return null;
  return { id: inserted.id, expected: inserted, contextIds: data.map(row => row.id), expiresAt: Date.now() + 8000 };
}

export async function undoViewerSave(client, snapshot, userId) {
  if (!snapshot || snapshot.expected.user_id !== userId || Date.now() > snapshot.expiresAt) throw new Error('저장 취소 가능 시간이 지났어요.');
  const { data, error } = await client.rpc('viewer_undo_vocabulary_save', {
    p_id: snapshot.id, p_expected: snapshot.expected, p_context_ids: snapshot.contextIds,
  });
  if (error) {
    if (error.code === 'PGRST202') throw new Error('안전한 저장 취소 기능을 준비 중이에요. 저장한 단어는 유지됩니다.');
    throw error;
  }
  if (data !== true) throw new Error('단어가 없거나 저장 취소 결과를 확인하지 못했어요.');
}
