// 브라우저/서버 공용. 주소는 저장된 URL을 신뢰하지 않고 검증된 식별자로 다시 만든다.
export const LEARNING_LANGUAGES = ['Japanese','Chinese','French','English'];
export const LANGUAGE_BASE = { Japanese: '/japanese', Chinese: '/chinese', French: '/french', English: '/english' };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const materialIdValid = (kind, id) => kind === 'pdf' ? UUID.test(String(id)) : kind === 'reading' && /^\d{1,19}$/.test(String(id)) && BigInt(id) > 0n && BigInt(id) <= 9223372036854775807n;
export const normalizeLearningWord = (word) => String(word || '').normalize('NFC').trim();

export function sourceHref(source) {
  const loc = source.locator || {};
  if (source.kind === 'textbook' && LANGUAGE_BASE[source.lang] && /^[a-z0-9_-]{1,160}$/i.test(source.chapter_slug || '')) {
    const query = new URLSearchParams();
    if (typeof loc.revision === 'string') query.set('sourceRevision', loc.revision);
    return `${LANGUAGE_BASE[source.lang]}/grammar/${source.chapter_slug}${query.size ? `?${query}` : ''}${/^tb-[a-z0-9-]+$/.test(loc.blockId || '') ? `#${loc.blockId}` : ''}`;
  }
  if (source.kind === 'reading' && materialIdValid('reading', source.material_id)) {
    const query = new URLSearchParams();
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
