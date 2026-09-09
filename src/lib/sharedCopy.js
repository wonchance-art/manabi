/**
 * 팀 사본 → 내 자료 복제 (v2-AB R2, #1077 5603827169 §6 · 상세 5604199672 S3/S4 · 정정 ②).
 *
 * 로그인하면 기기 사본(또는 토큰으로 방금 받은 페이로드)을 **내 자료 행**으로 복제한다 —
 * raw_text·processed_json·metadata(book·translations) 그대로, 재분석 0. 원본 표시는 컬럼이 아니라
 * `metadata.source_ref`(스키마 0 — `source_ref` 컬럼은 vocab_words에만 있다). 같은 원본은 한 번만
 * (중복 0). 담으려던 단어는 복제가 끝난 **뒤** 복제본 id로 담는다(순서 계약).
 */
import { buildVocabRow, VOCAB_UPSERT } from './vocabIO';

/** 순수 — 페이로드/사본 → 내 자료 행. */
export function copyRowFromPayload(material, userId) {
  const json = material?.processed_json || { sequence: [], dictionary: {}, last_idx: -1, status: 'pending' };
  const metadata = { ...(json.metadata || {}) };
  delete metadata.passageRun;          // 분석 임대 흔적은 원본의 것
  delete metadata.viewerRevision;      // RPC 멱등 키도 원본의 것
  return {
    title: material.title,
    raw_text: material.raw_text,
    processed_json: { ...json, metadata: { ...metadata, source_ref: String(material.id), copied_at: new Date().toISOString() } },
    visibility: 'private',
    owner_id: userId,
  };
}

/** 순수 — 이미 있는 것(source_ref → 내 id)을 빼고 넣을 것만. */
export function planClaim(materials, existingBySource) {
  const toInsert = [];
  const byId = new Map();
  for (const m of materials || []) {
    if (!m?.id) continue;
    const src = String(m.id);
    const mine = existingBySource?.get(src);
    if (mine) byId.set(src, mine);
    else if (!toInsert.some((x) => String(x.id) === src)) toInsert.push(m);
  }
  return { toInsert, byId };
}

/** 내 자료 중 복제본(source_ref 있음) — source_ref → 내 id. 실패는 빈 Map(복제가 두 번 될 수 있지만 막히진 않는다). */
export async function findExistingCopies(client, userId) {
  const { data, error } = await client
    .from('reading_materials')
    .select('id, processed_json->metadata->>source_ref')
    .eq('owner_id', userId)
    .not('processed_json->metadata->source_ref', 'is', null);
  if (error) return new Map();
  const map = new Map();
  for (const r of data || []) if (r.source_ref) map.set(String(r.source_ref), r.id);
  return map;
}

/**
 * 복제 + 대기 담기.
 * @param {object} client supabase
 * @param {string} userId
 * @param {{materials: object[], pending?: object|null}} opts
 * @returns {{copied:number, skipped:number, byId:Map<string,number>, saved:boolean, savedWord:string|null}}
 */
export async function claimSharedCopies(client, userId, { materials = [], pending = null } = {}) {
  const existing = await findExistingCopies(client, userId);
  const { toInsert, byId } = planClaim(materials, existing);
  let copied = 0;
  for (const m of toInsert) {
    const { data, error } = await client.from('reading_materials').insert(copyRowFromPayload(m, userId)).select('id').single();
    if (error) throw error;
    byId.set(String(m.id), data.id);
    copied += 1;
  }
  let saved = false;
  let savedWord = null;
  if (pending?.word?.text && byId.has(String(pending.materialId))) {
    const row = buildVocabRow({
      userId,
      surface: pending.word.text,
      base: pending.word.base || pending.word.text,
      meaning: pending.word.meaning,
      pos: pending.word.pos,
      reading: pending.word.reading,
      language: pending.word.language,
      sourceSentence: pending.word.sourceSentence,
      sourceMaterialId: byId.get(String(pending.materialId)),
    });
    const { error } = await client.from('user_vocabulary').upsert(row, VOCAB_UPSERT);
    if (!error) { saved = true; savedWord = pending.word.text; }
  }
  return { copied, skipped: materials.length - toInsert.length, byId, saved, savedWord };
}
