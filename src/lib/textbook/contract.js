// The manuscript is the editable source. Generated HTML and PDF are immutable artifacts.
export const BOOK_ID = 'japanese-n5';
export const BOOKS = Object.freeze({
  'japanese-n5': Object.freeze({id:'japanese-n5',level:'N5',language:'Japanese',lessons:42,slugPrefix:'n5-book'}),
  'japanese-n4': Object.freeze({id:'japanese-n4',level:'N4',language:'Japanese',lessons:42,slugPrefix:'n4-book'}),
  'japanese-n3': Object.freeze({id:'japanese-n3',level:'N3',language:'Japanese',lessons:48,slugPrefix:'n3-book',reviewAfterLessons:Object.freeze([8,16,24,32,40,48])}),
});
export const isBookId = id => typeof id==='string'&&Object.hasOwn(BOOKS,id);
export const bookUnitSlug = (bookId,lesson) => isBookId(bookId)&&Number.isInteger(lesson)&&lesson>=1&&lesson<=BOOKS[bookId].lessons?`${BOOKS[bookId].slugPrefix}-u${String(lesson).padStart(2,'0')}`:null;
export const EDITION_ID = /^[a-f0-9]{24}$/;
// Each book keeps its own final lesson; accepting N3 must not admit N5/N4 lesson 43.
export const BOOK_UNIT_SLUG = new RegExp(`^(?:${Object.values(BOOKS).map(book=>`${book.slugPrefix}-u(?:${Array.from({length:book.lessons},(_,i)=>String(i+1).padStart(2,'0')).join('|')})`).join('|')})$`);
export function isBookPage(bookId,page,{cover=true}={}) {
  if(!isBookId(bookId)||typeof page!=='string')return false;
  if(cover&&page==='cover')return true;
  const match=/^u(0[1-9]|[1-9][0-9])(?:-[a-z0-9_-]+)?$/.exec(page);
  return !!match&&Number(match[1])<=BOOKS[bookId].lessons;
}
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
// 관리자 미리보기 표식(GUEST-STATIC-001 5단계 d2-i) — 미리보기(발행 도장 없는 판본) 안에서 교재 화면(/books/<책>)으로 가는 주소에만 붙인다.
// `?edition=<id>` 하나뿐인 요청은 middleware가 판본별 정적 판(공유 캐시 — 미리보기 없음)으로 넘기므로, 쿼리를 둘로 만들어 동적 화면(관리자 확인)에 남긴다.
// 서버는 이 값을 읽지 않는다(미리보기 여부는 발행 도장 · 관리자 확인이 정한다). 저장 · 돌아가기용 주소(safeBookReturn)에는 붙이지 않는다 — 거기는 판본 하나만 받는다.
export const previewBookHref=href=>{if(typeof href!=='string')return href;const url=new URL(href,'https://manabi.invalid');url.searchParams.set('preview','1');return url.pathname+url.search+url.hash;};
