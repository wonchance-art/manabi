import {boundaryCoveringToken} from './boundaryEdits';
import {bookSourceHref} from './textbook/sources';
import {absoluteSourceSpan, exactSourceQuote} from './viewerLocalizedContext';
import {viewerCacheKey} from './viewerReliability';
// 브라우저/서버 공용. 주소는 저장된 URL을 신뢰하지 않고 검증된 식별자로 다시 만든다.
export const LEARNING_LANGUAGES = ['Japanese','Chinese','French','English','Korean'];
export const LANGUAGE_BASE = { Japanese: '/japanese', Chinese: '/chinese', French: '/french', English: '/english' };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const materialIdValid = (kind, id) => kind === 'pdf' ? UUID.test(String(id)) : kind === 'reading' && /^\d{1,19}$/.test(String(id)) && BigInt(id) > 0n && BigInt(id) <= 9223372036854775807n;
export const normalizeLearningWord = (word) => String(word || '').normalize('NFC').trim();

// bookId 없는 교재 출처 = 옛 네 언어 교재 챕터. 그 공개 URL은 #1287부터 관리자 보관함으로만 열려
// 학습자 링크로 내면 홈으로 튕긴다. 새 책 위치와의 대응은 데이터로 확정되지 않았으므로 추측해 옮기지 않는다.
// 출처 행 자체(문장·번역·위치)는 그대로 두고, 화면은 링크 대신 보관 안내를 보인다(VIEWER-R0-BUGS-001 버그 3).
export function sourceArchived(source) {
  const loc = source?.locator || {};
  return source?.kind === 'textbook' && !loc.bookId && !!LANGUAGE_BASE[source.lang]
    && /^[a-z0-9_-]{1,160}$/i.test(source.chapter_slug || '');
}

export function sourceHref(source) {
  const loc = source.locator || {};
  if(source.kind === 'textbook' && loc.bookId) return bookSourceHref(source);
  if (sourceArchived(source)) return null;
  if (source.kind === 'reading' && materialIdValid('reading', source.material_id)) {
    if (UUID.test(loc.noteCandidate || '') && typeof loc.notePage === 'string') {
      const query = new URLSearchParams({candidate: loc.noteCandidate, page: loc.notePage});
      return `/notes/${source.material_id}?${query}`;
    }
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

// 원문 전체의 raw revision만 사용한다. 표시 locale·토큰 ID·재분석은 출처가 아니다.
export async function learningSourceRevision(rawText) {
  if (typeof rawText !== 'string') return null;
  return viewerCacheKey('reading-source', 'raw-utf16-v1', rawText);
}

function rawLineContext(rawText, span) {
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  for (const line of rawText.matchAll(lines)) {
    if (!line[0]) continue;
    const start = line.index, end = start + line[0].length;
    if (span.start >= start && span.end <= end) {
      if (line[0].length > 4000) return null;
      return {quote: line[0], quoteSpan: {start, end, unit: 'utf16'}};
    }
  }
  return null;
}

export function koreanTokenContext(json, tokenId, rawText) {
  if (json?.metadata?.language !== 'Korean' || !json?.sequence?.includes(tokenId)) return null;
  const token = json.dictionary?.[tokenId], sourceSpan = absoluteSourceSpan(rawText, token?.sourceSpan);
  if (!sourceSpan || typeof token?.text !== 'string' || /\s/u.test(token.text)
    || !/[\p{L}\p{N}]/u.test(token.text) || exactSourceQuote(rawText, sourceSpan, token.text) === null) return null;
  const context = rawLineContext(rawText, sourceSpan);
  return context ? {token, sourceSpan, ...context, language: 'Korean'} : null;
}

/** 선택 표기와 lemma는 별개다. drag 선택에는 분석된 어절의 신뢰할 span이 없다. */
export async function koreanReadingSource({materialId, rawText, token, sourceRevision} = {}) {
  if (!materialIdValid('reading', materialId) || !token?.id) return null;
  const context = koreanTokenContext({metadata: {language: 'Korean'}, sequence: [token.id],
    dictionary: {[token.id]: token}}, token.id, rawText);
  if (!context) return null;
  // 여러 토큰의 같은 raw revision을 호출부가 한 번 계산할 수 있다. 서버는 다시 검증한다.
  const revision = sourceRevision === undefined ? await learningSourceRevision(rawText) : sourceRevision;
  if (typeof revision !== 'string' || !/^reading-source:v2:[a-f0-9]{64}$/.test(revision)) return null;
  return {kind: 'reading', materialId: String(materialId), tokenId: token.id,
    sourceRevision: revision, sourceSpan: context.sourceSpan,
    surface: token.text, quote: context.quote, quoteSpan: context.quoteSpan};
}

function koreanSourceTarget(json, {locator, quote}, {rawText, sourceRevision} = {}) {
  if (json?.metadata?.language !== 'Korean' || locator?.version !== 1
    || typeof sourceRevision !== 'string' || !sourceRevision || locator.sourceRevision !== sourceRevision) return null;
  const span = absoluteSourceSpan(rawText, locator.sourceSpan);
  if (!span || exactSourceQuote(rawText, span, locator.surface) === null) return null;
  const line = rawLineContext(rawText, span), quoteSpan = absoluteSourceSpan(rawText, locator.quoteSpan);
  if (!line || !quoteSpan || quoteSpan.start !== line.quoteSpan.start || quoteSpan.end !== line.quoteSpan.end
    || exactSourceQuote(rawText, quoteSpan, quote) === null) return null;
  const candidates = (json.sequence || []).filter(id => {
    const token = json.dictionary?.[id];
    if (token?.text !== locator.surface) return false;
    const currentSpan = absoluteSourceSpan(rawText, token.sourceSpan);
    return currentSpan && currentSpan.start === span.start && currentSpan.end === span.end
      && exactSourceQuote(rawText, currentSpan, token.text) !== null;
  });
  if (candidates.length) return candidates.length === 1 && koreanTokenContext(json, candidates[0], rawText) ? candidates[0] : null;
  // AD-R3 §7.5 한국어 나누기: 저장한 어절을 나눴으면 같은 범위 토큰이 없다. 그 범위 시작에서 시작하는 나눈 조각(boundary 'user')들이
  // 범위를 정확히 덮고 이어 붙인 글자가 저장 표면과 같을 때만 첫 조각으로 돌아간다(원래대로 하면 위 정확 일치로 돌아간다).
  const sequence = json.sequence || [];
  const first = sequence.findIndex(id => {
    const token = json.dictionary?.[id], currentSpan = token?.boundary === 'user' && absoluteSourceSpan(rawText, token.sourceSpan);
    return currentSpan && currentSpan.start === span.start && currentSpan.end < span.end;
  });
  if (first < 0) return null;
  let text = '', at = span.start;
  for (let i = first; i < sequence.length && at < span.end; i++) {
    const token = json.dictionary?.[sequence[i]], currentSpan = token?.boundary === 'user' && absoluteSourceSpan(rawText, token.sourceSpan);
    if (!currentSpan || currentSpan.start !== at || exactSourceQuote(rawText, currentSpan, token.text) === null) return null;
    text += token.text;
    at = currentSpan.end;
  }
  return at === span.end && text === locator.surface && koreanTokenContext(json, sequence[first], rawText) ? sequence[first] : null;
}

// Resolve against the current analysis. A stale ID or repeated word is not enough
// to assert that we found the saved occurrence.
export function readingSourceTarget(json, {locator = {}, quote = '', lang} = {}, rawSource = {}) {
  if (json?.metadata?.language === 'Korean' || lang === 'Korean' || locator.version === 1) {
    return koreanSourceTarget(json, {locator, quote}, rawSource);
  }
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
  // 묶기·나누기(AD-R3 §4.3): 저장 id가 경계 기록 base에 있으면 그 자리를 통째로 덮는 지금 토큰 하나로 돌아간다.
  const coveringId=boundaryCoveringToken(json,locator.tokenId,surface);
  const covering=coveringId?spans.find(s=>s.id===coveringId):null;
  if(covering && inside(covering.start,covering.end)) return covering.id;
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
  // 보관된 옛 교재 문맥은 링크 없이 문장만 남긴다(archived). 대표 문맥은 열 수 있는 것을 먼저 고른다.
  const valid=contexts.map(c=>({...c,href:sourceHref(c),...(sourceArchived(c)?{archived:true}:{})})).filter(c=>c.href || c.archived);
  const quote=compactSource(word?.source_sentence);
  const match=c=>c.href&&String(c.material_id)===String(word?.source_material_id);
  const primary=valid.find(c=>match(c)&&quote&&compactSource(c.quote)===quote) || valid.find(match) || valid.find(c=>c.href) || valid[0];
  if(primary) return {primary,others:valid.filter(c=>c.id!==primary.id)};
  const fallback=word?.source_material_id?{kind:'reading',material_id:word.source_material_id,quote:word.source_sentence || '',locator:{surface:word.word_text},legacy:true}:null;
  return {primary:fallback && sourceHref(fallback)?{...fallback,href:sourceHref(fallback)}:word?.source_sentence?{quote:word.source_sentence,legacy:true}:null,others:[]};
}

export function tokenContext(json, tokenId) {
  if (json?.metadata?.language === 'Korean') return null;
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
