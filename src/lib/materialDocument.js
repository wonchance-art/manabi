import { COMPOSER_LANGUAGES, composerOf, composerTitle, newComposerDraft, validateComposer,
  attachmentPath, safeAssetPath, normalizeSourceUrl, uploadOriginal } from './materialComposer';
import { createImportAttempt, saveImportOnce } from './materialImport';

export function isStudySnapshot(material) { return composerOf(material)?.role === 'study'; }
export function documentOf(material) {
  if (!composerOf(material) || isStudySnapshot(material)) return null;
  if (material.document_json?.version === 1) return material.document_json;
  const original = composerOf(material);
  return { version: 1, revision: null, body: material.raw_text || '',
    language: material.processed_json?.metadata?.language || '', assets: original.assets || [],
    links: original.links || [], retainedAssets: [], excerpt: original.excerpt || '', hasBody: original.hasBody };
}


// List payloads carry a summary only, not another full copy of every authored body.
export function documentListRow(material) {
  if (!material.document_revision) return material;
  return { ...material, document_json: { version: 1, revision: material.document_revision,
    language: material.document_language || '', excerpt: material.document_excerpt || '',
    assets: material.document_assets || [], hasBody: material.document_has_body } };
}

export function editableMaterial(material, ownerId) {
  return !!ownerId && material?.owner_id === ownerId && material.visibility === 'private'
    && !!documentOf(material);
}

export function editDraft(material, id) {
  const doc = documentOf(material);
  if (!doc) throw new Error('MATERIAL_NOT_EDITABLE');
  return { ...newComposerDraft(id), materialId: String(material.id), baseRevision: doc.revision,
    title: material.title || '', body: doc.body, language: doc.language || '',
    files: doc.assets.map(asset => ({ ...asset })), links: [...doc.links] };
}

function nextDocument(material, draft) {
  validateComposer(draft);
  const previous = documentOf(material);
  const assets = draft.files.map(file => ({ kind: file.kind, name: file.name, size: file.size, hash: file.hash,
    path: attachmentPath(material.owner_id, material.processed_json.metadata.importAttempt, file) }));
  if (assets.some(asset => !safeAssetPath(material, asset))) throw new Error('INVALID_ORIGINAL');
  const kept = new Map([...(previous.retainedAssets || []), ...previous.assets].map(asset => [asset.path, asset]));
  assets.forEach(asset => kept.delete(asset.path));
  return { version: 1, revision: draft.id, body: draft.body,
    language: COMPOSER_LANGUAGES.includes(draft.language) ? draft.language : '',
    hasBody: !!draft.body.trim(), excerpt: draft.body.trim().slice(0, 120),
    assets, links: draft.links.map(normalizeSourceUrl), retainedAssets: [...kept.values()] };
}

export async function readEditableMaterial(client, id, ownerId) {
  const { data, error } = await client.from('reading_materials').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  if (!editableMaterial(data, ownerId)) throw new Error('MATERIAL_NOT_EDITABLE');
  return data;
}

export function createDocumentSave(ownerId, draft) { return { ownerId, draft, pending: null }; }

// Only the authored document is replaced. In-flight analysis may still write its
// own processed_json without losing this edit or moving existing vocabulary tokens.
export async function saveDocumentOnce(client, save, onStage = () => {}) {
  if (save.pending) return save.pending;
  save.pending = (async () => {
    const { draft, ownerId } = save;
    onStage('저장된 글을 확인하고 있어요…');
    const material = await readEditableMaterial(client, draft.materialId, ownerId);
    if (!Object.hasOwn(material, 'document_json')) throw new Error('EDIT_SCHEMA_PENDING');
    if (documentOf(material).revision === draft.id) return material;
    if (documentOf(material).revision !== draft.baseRevision) throw new Error('EDIT_CONFLICT');
    const doc = nextDocument(material, draft);
    for (const [index, file] of draft.files.entries()) {
      onStage(`원본을 보관하고 있어요… ${index + 1} / ${draft.files.length}`);
      await uploadOriginal(client, ownerId, { id: material.processed_json.metadata.importAttempt }, file);
    }
    onStage('변경 내용을 저장하고 있어요…');
    let query = client.from('reading_materials').update({ title: composerTitle(draft), document_json: doc })
      .eq('id', material.id).eq('owner_id', ownerId);
    query = draft.baseRevision === null ? query.is('document_json', null)
      : query.eq('document_json->>revision', draft.baseRevision);
    const { data, error } = await query.select('id');
    if (error) throw error;
    if (!data?.length) {
      const latest = await readEditableMaterial(client, material.id, ownerId);
      if (documentOf(latest).revision === draft.id) return latest;
      throw new Error('EDIT_CONFLICT');
    }
    return { ...material, id: data[0].id, title: composerTitle(draft), document_json: doc };
  })();
  try { return await save.pending; } finally { save.pending = null; }
}

export function documentError(error) {
  if (error?.message === 'EDIT_CONFLICT') return '다른 곳에서 먼저 수정한 글이 있어요. 내 초안은 유지했으며 최신 글을 덮어쓰지 않았어요.';
  if (error?.message === 'MATERIAL_NOT_EDITABLE') return '수정할 수 없는 자료예요. 삭제되었거나 다른 계정의 자료일 수 있어요.';
  if (error?.message === 'EDIT_SCHEMA_PENDING' || /document_json/.test(error?.message || '')) return '수정 기능의 저장소 연결을 준비하고 있어요. 기존 자료는 그대로 읽을 수 있습니다.';
  return null;
}

async function studyAttemptId(root, body, language) {
  const bytes = new TextEncoder().encode(JSON.stringify([root.owner_id, String(root.id), body, language]));
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  // Existing composer unique index serializes the same root/body/language in all tabs.
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function openDocumentStudy(client, material, language) {
  if (!COMPOSER_LANGUAGES.includes(language)) throw new Error('LANGUAGE_REQUIRED');
  const latest = await readEditableMaterial(client, material.id, material.owner_id);
  const doc = documentOf(latest);
  if (!doc.body.trim()) throw new Error('BODY_REQUIRED');
  if (doc.revision !== documentOf(material).revision) throw new Error('EDIT_CONFLICT');
  const json = latest.processed_json;
  if (doc.body === latest.raw_text && json.metadata.language === language) return latest;
  // First use of an unclassified v1 original can keep its established source address.
  if (doc.body === latest.raw_text && !json.sequence?.length && json.status === 'saved' && !json.metadata.language) {
    const next = { ...json, status: 'pending', metadata: { ...json.metadata, language } };
    const { data, error } = await client.from('reading_materials').update({ processed_json: next })
      .eq('id', latest.id).eq('owner_id', latest.owner_id).eq('processed_json', JSON.stringify(json)).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('EDIT_CONFLICT');
    return { ...latest, processed_json: next };
  }
  const id = await studyAttemptId(latest, doc.body, language);
  const row = { owner_id: latest.owner_id, visibility: 'private', title: latest.title, raw_text: doc.body,
    processed_json: { status: 'pending', sequence: [], dictionary: {}, last_idx: -1, metadata: { language,
      composer: { version: 1, role: 'study', parentId: String(latest.id), sourceRevision: doc.revision,
        hasBody: true, excerpt: doc.excerpt, assets: [], links: [] } } } };
  const attempt = createImportAttempt(row, id);
  attempt.uncertain = true;
  try { return await saveImportOnce(client, attempt); }
  catch (error) { if (error?.code !== '23505') throw error; return saveImportOnce(client, attempt); }
}
