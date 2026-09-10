/**
 * 팀 목록(index)·자료 페이로드 — 서버 부품 (v2-AB R2 상세 5604199672 §3).
 *
 * 비공개 원본은 RLS로 익명에게 닫혀 있다. 이 모듈만 service role로 읽되, **루트 소유자의 행**이면서
 * 팀에 속한 것(교재 과 = metadata.book.key === team.bookKey, 정리본 = metadata.team.key === key)만 내준다.
 * 학생 복제본은 metadata.team이 있어도 소유자가 달라 절대 나가지 않는다(계약).
 * 순수 판정(indexFromRows·materialBelongsToTeam·toPayload)은 Supabase 없이 계약 테스트가 돈다.
 */
import {createHash} from 'node:crypto';
import {sharedSnapshot,stableJson} from '../classCopyModel';
import { createClient } from '@supabase/supabase-js';
import { getTeam } from '../classBoard';
import {classHistoryEntries,filterClassHistory} from '../classStudyHistory';
import { getBook } from '../bookMeta';

export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

/** 팀 루트(가장 먼저 만든 것) — 없으면 null. */
export async function loadTeamRoot(admin, key) {
  const { data, error } = await admin
    .from('reading_materials')
    .select('id, owner_id, title, created_at, processed_json')
    .filter('processed_json->metadata->team->>key', 'eq', key)
    .filter('processed_json->metadata->team->>root', 'eq', 'true')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  const root = data?.[0];
  const team = root ? getTeam(root.processed_json?.metadata) : null;
  if (!root || !team?.root) return null;
  return { root, team };
}

const revisionOf=row=>createHash('sha256').update(stableJson(sharedSnapshot(row))).digest('hex');
const countLines = (t) => String(t || '').split('\n').filter((l) => l.trim()).length;
const updatedOf = (row) => row?.updated_at || row?.processed_json?.metadata?.updated_at || row?.created_at || null;

/** 순수 — 조회 행들을 학생 목록으로. 팀에 속하지 않는 행은 여기서도 걸러진다(2차 방어). */
export function indexFromRows({ team, chapterRows = [], noteRows = [] }) {
  const chapters = chapterRows
    .filter((r) => getBook(r.processed_json?.metadata)?.key === team.bookKey)
    .map((r) => ({
      id: r.id, title: r.title, order: getBook(r.processed_json?.metadata).order,
      status: r.processed_json?.status || 'idle', updatedAt: updatedOf(r), contentRevision:revisionOf(r),
    }))
    .sort((a, b) => a.order - b.order);
  const notes = noteRows
    .filter((r) => { const t = getTeam(r.processed_json?.metadata); return t && !t.root && t.key === team.key && t.day; })
    .map((r) => ({
      id: r.id, title: r.title, day: getTeam(r.processed_json?.metadata).day,
      lines: countLines(r.raw_text), updatedAt: updatedOf(r), contentRevision:revisionOf(r),
    }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const bookTitle = chapterRows.map((r) => getBook(r.processed_json?.metadata)?.title).find(Boolean) || null;
  return {
    team: { key: team.key, name: team.name, lang: team.lang, bookKey: team.bookKey, bookTitle, bookTotal: team.bookTotal, chapterId: team.chapterId },
    chapters,
    notes,
  };
}

export async function buildTeamIndex(admin, root, team, historyOptions=null) {
  const chaptersQ = team.bookKey
    ? admin.from('reading_materials')
      .select('id, title, raw_text, created_at, processed_json, lesson_explanation_ko, conversation_script, direction, source_pdf_id, page_start, page_end, document_json')
      .eq('owner_id', root.owner_id)
      .filter('processed_json->metadata->book->>key', 'eq', team.bookKey)
    : Promise.resolve({ data: [], error: null });
  const notesQ = admin.from('reading_materials')
    .select('id, title, raw_text, created_at, processed_json, lesson_explanation_ko, conversation_script, direction, source_pdf_id, page_start, page_end, document_json')
    .eq('owner_id', root.owner_id)
    .filter('processed_json->metadata->team->>key', 'eq', team.key)
    .filter('processed_json->metadata->team->>root', 'is', null);
  const [c, n] = await Promise.all([chaptersQ, notesQ]);
  if (c.error) throw c.error;
  if (n.error) throw n.error;
  if(!historyOptions)return indexFromRows({team,chapterRows:c.data||[],noteRows:n.data||[]});
  const index=indexFromRows({team,chapterRows:c.data||[],noteRows:n.data||[]});
  const notes=index.notes.map(note=>({...note,entries:classHistoryEntries(n.data.find(r=>String(r.id)===String(note.id)),index.chapters.map(ch=>ch.id))}));
  const filtered=filterClassHistory(notes,historyOptions.search,historyOptions.extras);
  const offset=historyOptions.offset||0;
  const coverage=await admin.from('class_teaching_coverage').select('day,material_ids,updated_at').eq('root_id',root.id).order('day',{ascending:false});
  if(coverage.error)throw coverage.error;
  return {notes:filtered.slice(offset,offset+20),coverage:coverage.data||[],next:offset+20<filtered.length?offset+20:null};
}

/** 순수 — 이 행이 팀의 것인가: 'chapter' | 'note' | null. 소유자가 다르면 무조건 null. */
export function materialBelongsToTeam(row, team, root) {
  if (!row || !team || !root || row.owner_id !== root.owner_id) return null;
  const meta = row.processed_json?.metadata;
  if (team.bookKey && getBook(meta)?.key === team.bookKey) return 'chapter';
  const t = getTeam(meta);
  if (t && !t.root && t.key === team.key && t.day) return 'note';
  return null;
}

/** 순수 — 학생에게 내주는 페이로드(뷰어가 읽는 필드만). */
export function toPayload(row, kind) {
  return {
    id: row.id, title: row.title, kind,
    lesson_explanation_ko:row.lesson_explanation_ko??null,conversation_script:row.conversation_script??null,direction:row.direction??'read',source_pdf_id:row.source_pdf_id??null,page_start:row.page_start??null,page_end:row.page_end??null,document_json:row.document_json??null,
    language: row.processed_json?.metadata?.language || null,
    raw_text: row.raw_text, processed_json: row.processed_json,
    visibility: row.visibility, owner_id: row.owner_id, created_at: row.created_at,
    updatedAt: updatedOf(row), contentRevision:revisionOf(row),
  };
}

export async function loadTeamMaterial(admin, root, team, id) {
  const { data, error } = await admin
    .from('reading_materials')
    .select('*')
    .eq('id', id)
    .eq('owner_id', root.owner_id)
    .maybeSingle();
  if (error) throw error;
  const kind = materialBelongsToTeam(data, team, root);
  return kind ? toPayload(data, kind) : null;
}
