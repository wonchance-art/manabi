/** Shared-copy compatibility helpers. New authenticated copies are created only by the class capability RPC. */

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

/** Lookup failure is not absence. Duplicate legacy rows require an explicit choice at the server. */
export async function findExistingCopies(client, userId) {
  const rows=[],links=[];
  for(let from=0;;from+=500){
    const {data,error}=await client.from('reading_materials').select('id, processed_json->metadata->>source_ref').eq('owner_id',userId).not('processed_json->metadata->source_ref','is',null).order('id').range(from,from+499);
    if(error)throw error;if(!Array.isArray(data))throw new Error('기존 자료를 확인하지 못했어요.');
    rows.push(...data);if(data.length<500)break;
  }
  for(let from=0;;from+=500){
    const {data,error}=await client.from('class_material_copies').select('source_material_id,copy_material_id').eq('owner_id',userId).order('source_material_id').range(from,from+499);
    if(error)throw error;if(!Array.isArray(data))throw new Error('대표 사본을 확인하지 못했어요.');
    links.push(...data);if(data.length<500)break;
  }
  const groups=new Map(),map=new Map();
  for(const r of rows){if(!r.source_ref)continue;const key=String(r.source_ref);groups.set(key,[...(groups.get(key)||[]),r.id]);}
  for(const [key,ids]of groups)if(ids.length===1)map.set(key,ids[0]);
  for(const r of links)map.set(String(r.source_material_id),r.copy_material_id);
  return map;
}

/** Explicit selections only; the server owns canonical-copy identity and authorization. */
export async function claimSharedCopies(client, userId, { materials = [], team, requestCopy } = {}) {
  if(!team||typeof requestCopy!=='function')throw new Error('수업 화면에서 안전하게 자료를 열어 주세요.');
  const byId=new Map();
  for(const material of materials){
    const result=await requestCopy(team,material.id,'open');
    if(!result.copyId)throw new Error('기존 사본을 먼저 선택해 주세요.');
    byId.set(String(material.id),result.copyId);
  }
  return {byId};
}
