import { textbookStream, resolveTextbookAnchor } from './textbookAnnotations';

export const CLASS_QUOTE_LIMIT = 5000;
const anchorKeys = new Set(['type', 'exact', 'prefix', 'suffix', 'start', 'end']);
export function validClassAnchor(anchor) {
  return !!anchor && typeof anchor === 'object' && !Array.isArray(anchor)
    && Object.keys(anchor).every(key => anchorKeys.has(key))
    && anchor.type === 'TextQuoteSelector' && typeof anchor.exact === 'string'
    && !!anchor.exact.trim() && anchor.exact.length <= CLASS_QUOTE_LIMIT
    && typeof anchor.prefix === 'string' && anchor.prefix.length <= 48
    && typeof anchor.suffix === 'string' && anchor.suffix.length <= 48
    && Number.isSafeInteger(anchor.start) && anchor.start >= 0
    && anchor.end === anchor.start + anchor.exact.length;
}

// Like textbook annotations, offsets are JavaScript UTF-16 units. Classroom
// expressions retain their existing 5,000-unit limit; annotation limits stay intact.
export function makeClassAnchor(json, first, last = first, quote) {
  const { text, tokens } = textbookStream(json);
  const from = tokens.findIndex(token => token.id === first);
  const to = tokens.findIndex(token => token.id === last);
  if (from < 0 || to < from) return null;
  const covered = text.slice(tokens[from].start, tokens[to].end);
  const exact = covered.trim();
  if (!exact || exact !== quote || exact.length > CLASS_QUOTE_LIMIT) return null;
  const start = tokens[from].start + covered.indexOf(exact), end = start + exact.length;
  return classAnchorAt(text, start, end, exact);
}

export function classAnchorAt(text, start, end, exact) {
  if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(end) || end > text.length || end - start !== exact?.length || text.slice(start, end) !== exact || !exact.trim() || exact.length > CLASS_QUOTE_LIMIT) return null;
  let prefixStart = Math.max(0, start - 48), suffixEnd = Math.min(text.length, end + 48);
  // Context may include emoji. Do not emit an unpaired surrogate in JSON/SQL.
  if (/[\uDC00-\uDFFF]/.test(text[prefixStart] || '')) prefixStart++;
  if (/[\uD800-\uDBFF]/.test(text[suffixEnd - 1] || '')) suffixEnd--;
  return { type: 'TextQuoteSelector', exact, prefix: text.slice(prefixStart, start), suffix: text.slice(end, suffixEnd), start, end };
}

export function classSentenceEnd(json, first) {
  const sequence = json?.sequence || [], start = sequence.indexOf(first);
  if (start < 0) return null;
  let last = first;
  for (let i = start; i < sequence.length; i++) {
    if (json.dictionary?.[sequence[i]]?.pos === '개행') break;
    last = sequence[i];
  }
  return last;
}

// Deliberately conservative: a fingerprint is audit data, not permission to
// guess between ambiguous occurrences. Never fall back to indexOf's first hit.
export function resolveClassSource(json, source) {
  if (source?.anchor) {
    if (!validClassAnchor(source.anchor) || source.anchor.exact !== source.quote) return null;
    return resolveTextbookAnchor(json, source.anchor);
  }
  const { text, tokens } = textbookStream(json), quote = source?.quote;
  if (typeof quote !== 'string' || !quote || quote.length > CLASS_QUOTE_LIMIT) return null;
  const token = tokens.find(t => t.id === source.tokenId && json.dictionary?.[t.id]?.text === quote);
  // Legacy token IDs may be reused by reanalysis. A repeated quote without
  // saved context is unresolved even if the old ID still exists.
  const start = text.indexOf(quote);
  if (start < 0 || text.indexOf(quote, start + 1) !== -1) return null;
  if (token) return { start: token.start, end: token.end, first: token.id, last: token.id };
  return resolveTextbookAnchor(json, { type: 'TextQuoteSelector', exact: quote });
}

export function classSourceIdentity(source) {
  if (!validClassAnchor(source?.anchor) || source.anchor.exact !== source.quote) return null;
  const a = source.anchor;
  // Token IDs, dictionary changes and server-added digests are not new occurrences.
  return [String(source.materialId), a.exact, a.start, a.end, a.prefix, a.suffix];
}

export function sourceFromClassNote(note, entryId) {
  const meta = note?.processed_json?.metadata;
  const entry = meta?.classEntries?.find(entry => entry.id === entryId);
  if (!entry) return null;
  if (typeof note.raw_text === 'string' && note.raw_text.split('\n')[entry.idx]?.trim() !== entry.text) return null;
  const saved = meta.classSources?.[entryId];
  const source = saved && { ...saved, quote: saved.quote || entry.text };
  if (source?.anchor && (!validClassAnchor(source.anchor) || source.anchor.exact !== source.quote)) return null;
  if (!/^[1-9][0-9]{0,15}$/.test(String(source?.materialId || '')) || typeof source.quote !== 'string' || !source.quote || source.quote.length > CLASS_QUOTE_LIMIT) return null;
  return { materialId: String(source.materialId), quote: source.quote,
    ...(typeof source.tokenId === 'string' ? { tokenId: source.tokenId } : {}),
    ...(validClassAnchor(source.anchor) ? { anchor: source.anchor } : {}),
    ...(typeof source.streamDigest === 'string' && /^[a-f0-9]{32}$/.test(source.streamDigest) ? { streamDigest: source.streamDigest } : {}) };
}
