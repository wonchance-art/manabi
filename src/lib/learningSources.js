import {bookSourceHref} from './textbook/sources';
// 브라우저/서버 공용. 주소는 저장된 URL을 신뢰하지 않고 검증된 식별자로 다시 만든다.
export const LEARNING_LANGUAGES = ['Japanese','Chinese','French','English'];
export const LANGUAGE_BASE = { Japanese: '/japanese', Chinese: '/chinese', French: '/french', English: '/english' };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const materialIdValid = (kind, id) => kind === 'pdf' ? UUID.test(String(id)) : kind === 'reading' && /^\d{1,19}$/.test(String(id)) && BigInt(id) > 0n && BigInt(id) <= 9223372036854775807n;
export const normalizeLearningWord = (word) => String(word || '').normalize('NFC').trim();

export function sourceHref(source) {
  const loc = source.locator || {};
  if(source.kind === 'textbook' && loc.bookId) return bookSourceHref(source);
  if (source.kind === 'textbook' && LANGUAGE_BASE[source.lang] && /^[a-z0-9_-]{1,160}$/i.test(source.chapter_slug || '')) {
    const query = new URLSearchParams();
    if (typeof loc.revision === 'string') query.set('sourceRevision', loc.revision);
    return `${LANGUAGE_BASE[source.lang]}/grammar/${source.chapter_slug}${query.size ? `?${query}` : ''}${/^tb-[a-z0-9-]+$/.test(loc.blockId || '') ? `#${loc.blockId}` : ''}`;
  }
  if (source.kind === 'reading' && materialIdValid('reading', source.material_id)) {
    const query = new URLSearchParams();
    if (UUID.test(source.id || '')) {
      query.set('sourceContext',source.id);
      return `/viewer/${source.material_id}?${query}`;
    }
    if (typeof loc.tokenId === 'string') query.set('sourceToken', loc.tokenId);
    if (typeof loc.surface === 'string') query.set('sourceText', loc.surface);
    return `/viewer/${source.material_id}${query.size ? `?${query}` : ''}`;
  }
  if (source.kind === 'pdf' && materialIdValid('pdf', source.pdf_id)) {
    const page = Number.isInteger(loc.page) && loc.page > 0 && loc.page <= 100000 ? `?page=${loc.page}` : '';
    return `/pdf/${source.pdf_id}${page}`;
  }
  return null;
}

const compactSource = value => String(value || '').normalize('NFC').replace(/\s+/gu,'');

// Resolve against the current analysis. A stale ID or repeated word is not enough
// to assert that we found the saved occurrence.
export function readingSourceTarget(json, {locator = {}, quote = ''} = {}) {
  const dict=json?.dictionary || {}, spans=[];
  let body='';
  for(const id of json?.sequence || []) {
    const token=dict[id], value=compactSource(token?.text);
    if(!value || token?.pos==='개행') continue;
    spans.push({id,token,start:body.length,end:body.length+value.length});body+=value;
  }
  const surface=compactSource(locator.surface), saved=compactSource(quote), ranges=[];
  if(saved) {
    for(let at=body.indexOf(saved);at>=0;at=body.indexOf(saved,at+1)) ranges.push({start:at,end:at+saved.length});
    if(!ranges.length) return null;
  }
  const inside=(start,end)=>!saved || ranges.some(r=>start>=r.start && end<=r.end);
  const exact=spans.filter(s=>s.id===locator.tokenId && (!surface || compactSource(s.token.text)===surface) && inside(s.start,s.end));
  if(exact.length===1) return exact[0].id;
  if(!surface) return null;
  const candidates=[],starts=new Map(spans.map(s=>[s.start,s])),ends=new Set(spans.map(s=>s.end));
  for(let at=body.indexOf(surface);at>=0;at=body.indexOf(surface,at+1)) {
    const end=at+surface.length;
    const first=starts.get(at);
    if(first && ends.has(end) && inside(at,end)) candidates.push(first.id);
    if(candidates.length>1) return null;
  }
  if(candidates.length===1) return candidates[0];
  if(candidates.length>1 || saved) return null;
  const bases=spans.filter(s=>compactSource(s.token.sep_link || s.token.base_form)===surface);
  return bases.length===1?bases[0].id:null;
}

export function reviewSourceContexts(word, contexts = []) {
  const valid=contexts.map(c=>({...c,href:sourceHref(c)})).filter(c=>c.href);
  const quote=compactSource(word?.source_sentence);
  const match=c=>String(c.material_id)===String(word?.source_material_id);
  const primary=valid.find(c=>match(c)&&quote&&compactSource(c.quote)===quote) || valid.find(match) || valid[0];
  if(primary) return {primary,others:valid.filter(c=>c.id!==primary.id)};
  const fallback=word?.source_material_id?{kind:'reading',material_id:word.source_material_id,quote:word.source_sentence || '',locator:{surface:word.word_text},legacy:true}:null;
  return {primary:fallback && sourceHref(fallback)?{...fallback,href:sourceHref(fallback)}:word?.source_sentence?{quote:word.source_sentence,legacy:true}:null,others:[]};
}

export function tokenContext(json, tokenId) {
  const sequence = json?.sequence || [], dictionary = json?.dictionary || {};
  const index = sequence.indexOf(tokenId);
  if (index < 0 || !dictionary[tokenId]) return null;
  let start = index, end = index;
  while (start > 0 && index - start < 15 && dictionary[sequence[start - 1]]?.pos !== '개행') start--;
  while (end + 1 < sequence.length && end - index < 15 && dictionary[sequence[end + 1]]?.pos !== '개행') end++;
  const language = json?.metadata?.language || 'Japanese';
  const quote = sequence.slice(start, end + 1).map(id => dictionary[id]?.text || '').join(['Japanese','Chinese'].includes(language) ? '' : ' ');
  return { token: dictionary[tokenId], quote, language };
}
