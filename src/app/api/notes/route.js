import {noteAuth, noteBody, reply, errorReply, noteResponse} from '@/lib/server/studyNotes';
import {noteMaterialRow, isStudyNote} from '@/lib/studyNotes';
import {checkDb, fail, accessibleMaterial} from '@/lib/server/learningContext';

export async function POST(request) {
  try {
    const {supabase: db, user} = await noteAuth(), body = await noteBody(request);
    let row;
    try { row = noteMaterialRow(user.id, body.title, body.document, crypto.randomUUID()); } catch (error) { fail(400, error.message); }
    if (row.processed_json.metadata.studyNote.document.origin) {
      const origin = await accessibleMaterial(db, user.id, 'reading', row.processed_json.metadata.studyNote.document.origin.materialId);
      row.processed_json.metadata.studyNote.document.origin.title = origin.title;
    }
    const existing = await db.from('reading_materials').select('id,title,processed_json').eq('owner_id', user.id).eq('processed_json->metadata->>importAttempt', body.document.key).maybeSingle();
    checkDb(existing.error);
    if (existing.data) { if (!isStudyNote(existing.data)) fail(409, '이미 사용한 노트 식별자예요.'); return reply(noteResponse(existing.data)); }
    const {data, error} = await db.from('reading_materials').insert(row).select('id,title,processed_json').single();
    if (error?.code === '23505') {
      const retry = await db.from('reading_materials').select('id,title,processed_json').eq('owner_id', user.id).eq('processed_json->metadata->>importAttempt', body.document.key).maybeSingle();
      checkDb(retry.error); if (retry.data && isStudyNote(retry.data)) return reply(noteResponse(retry.data));
    }
    checkDb(error); return reply(noteResponse(data), 201);
  } catch (error) { return errorReply(error); }
}
