import {requireUser} from '@/lib/supabaseServer';
import {fail, checkDb, reply, errorReply} from './learningContext';
import {isStudyNote, noteFromMaterial, noteMaterialRow, NOTE_LIMIT} from '@/lib/studyNotes';
import {materialIdValid, UUID} from '@/lib/learningSources';

export {reply, errorReply};
export async function noteAuth() {
  const auth = await requireUser();
  if (auth.error) fail(auth.status, auth.error);
  return auth;
}
export async function noteBody(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > NOTE_LIMIT + 4096) fail(413, '노트가 너무 커요. 페이지를 나눠 주세요.');
  const body = JSON.parse(text);
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, '노트 내용을 확인해 주세요.');
  return body;
}
export async function readOwnNote(db, userId, id) {
  if (!materialIdValid('reading', id)) fail(404, '노트를 찾지 못했어요.');
  const {data, error} = await db.from('reading_materials').select('id,owner_id,title,visibility,processed_json,raw_text').eq('id', id).eq('owner_id', userId).maybeSingle();
  checkDb(error);
  if (!data || data.owner_id !== userId || data.visibility !== 'private' || !isStudyNote(data)) fail(404, '내 계정의 개인 노트만 열 수 있어요.');
  return data;
}
export function noteResponse(row) {
  return {id: String(row.id), title: row.title, revision: row.processed_json.metadata.studyNote.revision, document: noteFromMaterial(row)};
}
export async function updateOwnNote(db, userId, id, body) {
  const current = await readOwnNote(db, userId, id);
  if (!UUID.test(body.revision || '') || current.processed_json.metadata.studyNote.revision !== body.revision) fail(409, '다른 창이나 기기에서 노트를 수정했어요. 내 초안은 이 기기에 보관되어 있습니다.');
  if (body.document?.key !== current.processed_json.metadata.studyNote.document.key) fail(400, '노트 식별자를 변경할 수 없어요.');
  let next;
  try { next = noteMaterialRow(userId, body.title, body.document, crypto.randomUUID()); } catch (error) { fail(400, error.message); }
  // An origin is fixed at creation; editing a note cannot grant a new material reference.
  next.processed_json.metadata.studyNote.document.origin = current.processed_json.metadata.studyNote.document.origin;
  const {data, error} = await db.from('reading_materials').update(next).eq('id', id).eq('owner_id', userId)
    .eq('processed_json->metadata->studyNote->>revision', body.revision).select('id,title,processed_json').maybeSingle();
  checkDb(error);
  if (!data) fail(409, '저장 중 다른 기기에서 수정했어요. 내 초안을 백업한 뒤 최신 노트를 확인하세요.');
  return noteResponse(data);
}
