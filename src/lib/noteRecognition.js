// A recognition request is tied to visible, explicitly selected elements.
// Geometry/text only: no source material, hidden card metadata, or other pages.
export const RECOGNITION_IMAGE_LIMIT = 1500000;
export const RECOGNITION_ELEMENT_LIMIT = 500;
const types = new Set(['freedraw','text','line','arrow','rectangle','ellipse','diamond']);
const fields = ['id','type','version','versionNonce','x','y','width','height','angle','points','pressures','simulatePressure','text','originalText','fontSize','fontFamily','lineHeight','textAlign','verticalAlign','strokeColor','backgroundColor','fillStyle','strokeWidth','strokeStyle','roughness','opacity','roundness','startArrowhead','endArrowhead'];
const clean = (value, max) => typeof value === 'string' ? value.normalize('NFC').trim().slice(0,max) : '';
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])) : value;

export function recognitionElements(page, ids) {
  if (!page || !Array.isArray(ids) || !ids.length || ids.length > RECOGNITION_ELEMENT_LIMIT || new Set(ids).size !== ids.length || ids.some(id=>typeof id!=='string'||id.length>100)) throw new Error('인식할 필기를 선택해 주세요. 한 번에 500개 요소까지 가능합니다.');
  const chosen = page.elements.filter(el=>ids.includes(el.id));
  if (chosen.length!==ids.length || chosen.some(el=>el.isDeleted || el.opacity===0 || !types.has(el.type))) throw new Error('보이는 필기와 글자만 선택해 주세요. 이미지와 외부 콘텐츠는 인식 대상이 아닙니다.');
  if (!chosen.some(el=>el.type==='text'||el.type==='freedraw')) throw new Error('손글씨나 입력한 글자가 포함된 부분을 선택해 주세요.');
  return chosen;
}

export async function recognitionFingerprint(page, ids) {
  const elements = recognitionElements(page,ids).map(el=>Object.fromEntries(fields.filter(key=>el[key]!==undefined).map(key=>[key,ordered(el[key])]))).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([page.id,elements])));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function recognitionResult(raw) {
  const value = typeof raw==='string' ? JSON.parse(raw) : raw;
  if (!value || !Array.isArray(value.expressions) || value.expressions.length>20) throw new Error('인식 결과를 확인하지 못했어요. 더 작은 영역으로 다시 시도해 주세요.');
  return value.expressions.map(row=>{
    const original=clean(row?.original,300);
    if (!original || !/[\p{L}\p{N}]/u.test(original)) return null;
    const choices=(Array.isArray(row.choices)?row.choices:[]).slice(0,4).map(choice=>({text:clean(choice?.text,300),reading:clean(choice?.reading,500),meaning:clean(choice?.meaning,500)})).filter(choice=>choice.text);
    return {original,reading:clean(row.reading,500),uncertain:row.uncertain!==false,choices};
  }).filter(Boolean);
}

export function recognizedCandidates(expressions, capture, language, randomId=()=>crypto.randomUUID()) {
  return recognitionResult({expressions}).map((row,index)=>({id:randomId(),pageId:capture.pageId,elementIds:capture.elementIds,
    original:row.original,text:row.original,base:'',reading:['Japanese','Chinese'].includes(language)?row.reading:'',meaning:'',language,
    originKey:`ink:${capture.pageId}:${capture.fingerprint}:${index}`,reviewed:false,excluded:false,
    recognition:{source:'gemini',fingerprint:capture.fingerprint,uncertain:row.uncertain,choices:row.choices}}));
}
