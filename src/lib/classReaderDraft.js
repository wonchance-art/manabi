import { studySelectionKey } from './classStudy';
import { validClassAnchor } from './classSource';

// Reader drafts share the outbox store, but never its delivery queue or live draft key.
export function readerDraftScope(owner, team, day, material) {
  return JSON.stringify(['reader', owner, team, day, String(material)]);
}
export function readerDraftValue(value) {
  if (!value || typeof value.input !== 'string' || value.input.length > 300) return null;
  const picked = value.selection;
  if (!picked) return { input: value.input, selection: null, meaning: '', reading: '' };
  if (typeof picked.text !== 'string' || !picked.text.trim() || picked.text.length > 5000
    || typeof value.meaning !== 'string' || value.meaning.length > 500
    || typeof value.reading !== 'string' || value.reading.length > 500) return null;
  const source = picked.source;
  if (!source || (source.kind !== 'manual' && (!source.materialId || typeof source.quote !== 'string'))) return null;
  if (source.kind !== 'manual' && (source.quote !== picked.text || (source.anchor && (!validClassAnchor(source.anchor) || source.anchor.exact !== picked.text)))) return null;
  return { input: value.input, selection: { text: picked.text, source: source.kind === 'manual' ? {kind:'manual'} : {
    materialId: String(source.materialId), quote: source.quote,
    ...(source.tokenId ? {tokenId:source.tokenId} : {}), ...(source.anchor ? {anchor:source.anchor} : {}),
  } }, meaning: value.meaning, reading: value.reading };
}
export const readerDraftContext = selection => selection?.source?.kind === 'manual' || !selection ? 'manual' : studySelectionKey(selection);
export function newestReaderDrafts(rows, scope) {
  const found = new Map();
  for (const row of [...rows].sort((a,b)=>b.updatedAt-a.updatedAt)) {
    const value = readerDraftValue(row.value);
    if (row.scope !== scope || row.kind !== 'draft' || row.category !== 'reader' || !value || typeof row.id !== 'string' || typeof row.revision !== 'string'
      || row.context !== readerDraftContext(value.selection) || found.has(row.context)) continue;
    found.set(row.context, {...row,value});
  }
  return [...found.values()];
}
export function hydrateReaderDrafts(rows, scope, edits) {
  const merged=new Map(newestReaderDrafts(rows,scope).map(row=>[row.context,row]));
  // A user edit made while IndexedDB was loading wins even after a clock change.
  for(const row of edits)merged.set(row.context,row);
  return [...merged.values()];
}
export function classroomSaveLabel({error, online, queue, loading}) {
  if (error) return '수업 기록 확인 필요';
  if (queue.some(row=>row.status==='error')) return '저장 확인 필요';
  if (queue.length) return online ? `${queue.length}개 서버 저장 대기` : `${queue.length}개 이 기기에 보관 · 오프라인`;
  if (!online) return '오프라인 · 저장 상태 확인 대기';
  if (loading) return '수업 기록 확인 중…';
  return '서버 저장 확인됨';
}
export const isClassComposing = (event, composing) => !!(composing || event?.isComposing || event?.nativeEvent?.isComposing || event?.keyCode === 229 || event?.nativeEvent?.keyCode === 229);
