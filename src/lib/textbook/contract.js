// The manuscript is the editable source. Generated HTML and PDF are immutable artifacts.
export const BOOK_ID = 'japanese-n5';
export const BOOKS = Object.freeze({
  'japanese-n5': Object.freeze({id:'japanese-n5',level:'N5',language:'Japanese',lessons:42,slugPrefix:'n5-book'}),
  'japanese-n4': Object.freeze({id:'japanese-n4',level:'N4',language:'Japanese',lessons:42,slugPrefix:'n4-book'}),
});
export const isBookId = id => typeof id==='string'&&Object.hasOwn(BOOKS,id);
export const bookUnitSlug = (bookId,lesson) => isBookId(bookId)&&Number.isInteger(lesson)&&lesson>=1&&lesson<=BOOKS[bookId].lessons?`${BOOKS[bookId].slugPrefix}-u${String(lesson).padStart(2,'0')}`:null;
export const EDITION_ID = /^[a-f0-9]{24}$/;
export const BOOK_UNIT_SLUG = /^n[45]-book-u(0[1-9]|[1-3][0-9]|4[0-2])$/;
const locked = new Set(['id','bookId','number','language','level','version','revision','source','editorialChanges','type','kind','target','targets','page_order','pattern_pages','shape','source_ids','unit','start','stage','reviewed','additionalUnit','duration','audioEnabled','save_practice','role','answer_group']);
export function editableFields(value, path=[], result=[]) {
  if (typeof value==='string') { result.push({path,value}); return result; }
  if (Array.isArray(value)) value.forEach((v,i)=>editableFields(v,[...path,i],result));
  else if(value&&typeof value==='object') Object.entries(value).forEach(([k,v])=>{if(!locked.has(k))editableFields(v,[...path,k],result)});
  return result;
}
// A saved draft can predate the current generated candidate. These fields identify
// the output process, not editable content; always take them from the server base.
export function withCandidateMetadata(manuscript, base) {
  const result={...manuscript};
  for(const key of ['revision','source','editorialChanges']) {
    if(Object.hasOwn(base,key))result[key]=base[key];
    else delete result[key];
  }
  return result;
}
export function validateManuscript(manuscript, base) {
  if(!manuscript||typeof manuscript!=='object'||Array.isArray(manuscript))return '원고 형식이 올바르지 않아요.';
  // Structural editing is a separate migration; existing record IDs and task identities survive copy edits.
  function sameShape(a,b,key='') {
    if(locked.has(key))return JSON.stringify(a)===JSON.stringify(b);
    if(typeof b==='string')return typeof a==='string'&&a.length<=12000&&(!b.trim()||!!a.trim());
    if(Array.isArray(b))return Array.isArray(a)&&a.length===b.length&&b.every((v,i)=>sameShape(a[i],v));
    if(b&&typeof b==='object')return a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>Object.hasOwn(a,k)&&sameShape(a[k],b[k],k));
    return a===b;
  }
  return sameShape(withCandidateMetadata(manuscript,base),base)?null:'원고의 과·문항 구조나 식별자가 바뀌었어요. 내용과 번역만 편집해 주세요.';
}
export function withField(manuscript,path,value) {
  const result=structuredClone(manuscript);let item=result;
  for(const key of path.slice(0,-1)){if(['__proto__','constructor','prototype'].includes(String(key)))throw new Error('Invalid path');item=item[key]}
  const last=path.at(-1);if(['__proto__','constructor','prototype'].includes(String(last)))throw new Error('Invalid path');item[last]=value;return result;
}
export const canonical = value => Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export function manuscriptContent(book){return Object.fromEntries(Object.entries(book).filter(([k])=>!['revision','source','editorialChanges'].includes(k)))}
export const bookHref=(edition,page='cover',bookId=BOOK_ID)=>isBookId(bookId)?`/books/${bookId}?edition=${edition}#${page}`:null;
