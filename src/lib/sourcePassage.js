import { composerOf, COMPOSER_LANGUAGES } from './materialComposer';
import { safeLibraryReturn } from './libraryReturn';

export const PASSAGE_MAX_CHARS = 1500;
export const passageOf = material => composerOf(material)?.passage || null;
export const codePointLength = text => Array.from(text || '').length;
const cpSlice = (text, start, end) => Array.from(text).slice(start, end).join('');

export function quoteRange(text, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > codePointLength(text)) return null;
  return { exact: cpSlice(text, start, end), prefix: cpSlice(text, Math.max(0, start - 40), start),
    suffix: cpSlice(text, end, end + 40), start, end };
}

// Offsets are Unicode code points. DOM offsets remain UTF-16 and are converted at the boundary.
export function findPassageQuote(text, quote) {
  if (!quote?.exact) return null;
  const matches = [];
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(quote.exact, from);
    if (index < 0) break;
    const before = text.slice(0, index), after = text.slice(index + quote.exact.length);
    if ((!quote.prefix || before.endsWith(quote.prefix)) && (!quote.suffix || after.startsWith(quote.suffix))) {
      matches.push(index);
    }
    from = index + 1; // Repeated source strings can overlap (for example, ああ in あああ).
  }
  const expected = Number.isInteger(quote.start) ? cpSlice(text, 0, quote.start).length : -1;
  const index = matches.includes(expected) ? expected : matches.length === 1 ? matches[0] : null;
  if (index === null) return null;
  const start = codePointLength(text.slice(0, index));
  return { start, end: start + codePointLength(quote.exact) };
}

export function passageBlocks(text) {
  const result = [];
  let offset = 0, previousEnd = 0;
  for (const match of text.matchAll(/[^\n]+/g)) {
    offset += codePointLength(text.slice(previousEnd, match.index));
    const end = offset + codePointLength(match[0]);
    if (match[0].trim()) result.push({ text: match[0], start: offset, end });
    offset = end; previousEnd = match.index + match[0].length;
  }
  return result;
}

// PDF.js supplies explicit BR nodes; textContent alone would silently join their words.
export function domSourceText(node) {
  if (node.nodeType === 3) return node.textContent || '';
  if (node.nodeName === 'BR') return '\n';
  return Array.from(node.childNodes || []).map(domSourceText).join('');
}

export function selectedSourceRange(element, selection) {
  if (!element || !selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return null;
  const prefix = range.cloneRange(); prefix.selectNodeContents(element); prefix.setEnd(range.startContainer, range.startOffset);
  const selected = domSourceText(range.cloneContents());
  const start = codePointLength(domSourceText(prefix.cloneContents()));
  return quoteRange(domSourceText(element), start, start + codePointLength(selected));
}

export function domPassageRange(element, quote) {
  const found = findPassageQuote(domSourceText(element), quote);
  if (!found) return null;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: node => node.nodeType === 3 || node.nodeName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  });
  let cursor = 0, start = null, end = null, node;
  while ((node = walker.nextNode())) {
    const text = node.nodeType === 3 ? node.textContent : '\n', length = codePointLength(text);
    if (node.nodeType === 3) {
      if (!start && found.start >= cursor && found.start <= cursor + length) start = [node, cpSlice(text, 0, found.start - cursor).length];
      if (!end && found.end >= cursor && found.end <= cursor + length) end = [node, cpSlice(text, 0, found.end - cursor).length];
    }
    cursor += length;
  }
  if (!start || !end) return null;
  const range = document.createRange(); range.setStart(...start); range.setEnd(...end);
  return range;
}

export function samePassageSource(a, b) {
  if (!a || !b || a.kind !== b.kind || a.textVersion !== b.textVersion) return false;
  if (a.kind === 'body') return (a.revision || null) === (b.revision || null);
  if (a.assetHash !== b.assetHash) return false;
  return a.kind === 'pdf' ? a.page === b.page : a.spinePath === b.spinePath && a.spineIndex === b.spineIndex;
}

export function passageLocation(source) {
  if (source?.kind === 'pdf') return `${source.page}쪽`;
  if (source?.kind === 'epub') return `${source.chapter}장`;
  return '작성한 본문';
}

export function sourcePassageHref(material, returnTo) {
  const parent = composerOf(material)?.parentId;
  if (!parent || !passageOf(material)) return null;
  const params = new URLSearchParams({ passage: String(material.id), returnTo: safeLibraryReturn(returnTo) });
  return `/viewer/${encodeURIComponent(parent)}?${params}`;
}

export async function openSourcePassage(client, material, source, text, language) {
  if (!COMPOSER_LANGUAGES.includes(language)) throw new Error('PASSAGE_LANGUAGE');
  if (!text.trim() || codePointLength(text) > PASSAGE_MAX_CHARS) throw new Error('PASSAGE_LENGTH');
  const { data, error } = await client.rpc('open_source_passage', {
    p_parent: String(material.id), p_source: source, p_text: text, p_language: language,
  });
  if (error) throw error;
  if (!data?.id || !passageOf(data)) throw new Error('PASSAGE_UNCERTAIN');
  return data;
}

export function passageError(error) {
  if (['PGRST202', '42883'].includes(error?.code)) return '구간 학습 연결을 준비하고 있어요. 원본은 그대로 읽을 수 있습니다.';
  if (/PASSAGE_SOURCE_CHANGED/.test(error?.message)) return '원본이 변경됐어요. 최신 원본에서 구간을 다시 골라 주세요.';
  if (/PASSAGE_ACCESS/.test(error?.message)) return '원본에 접근할 수 없어요. 로그인 상태와 자료를 확인해 주세요.';
  if (/PASSAGE_LENGTH/.test(error?.message)) return `학습할 내용을 1~${PASSAGE_MAX_CHARS.toLocaleString()}자로 골라 주세요.`;
  if (/PASSAGE_LANGUAGE/.test(error?.message)) return '학습할 언어를 골라 주세요.';
  return '구간을 열지 못했어요. 고른 내용은 유지했으니 다시 시도해 주세요.';
}
