// 青空文庫 반입의 손실 방지 경계. 네트워크·저장소·Viewer와 무관한 순수 파서로 유지한다.
// 원문 루비·주석·외자를 먼저 구조화하고, 평문은 그 결과에서만 파생한다.

export const AOZORA_DOCUMENT_VERSION = 1;

const BLOCK_TAGS = '(?:p|div|h[1-6]|section|blockquote|li)';
const ENTITY_MAP = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code) => {
    if (code[0] !== '#') return ENTITY_MAP[code.toLowerCase()] ?? whole;
    const hexadecimal = code[1]?.toLowerCase() === 'x';
    const point = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  });
}

function textNode(value) {
  return { type: 'text', value };
}

function normalizeChildren(children) {
  const normalized = [];
  for (const child of children) {
    if (child.type === 'text' && !child.value) continue;
    const previous = normalized.at(-1);
    if (child.type === 'text' && previous?.type === 'text') previous.value += child.value;
    else normalized.push(child);
  }
  return normalized;
}

function parseInlineText(source, notes, gaiji, warnings) {
  const children = [];
  let cursor = 0;
  const token = /｜([^《\n]+)《([^》\n]+)》|([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヵヶ]+)《([^》\n]+)》|※?［＃([^］]+)］/gu;

  for (const match of source.matchAll(token)) {
    if (match.index > cursor) children.push(textNode(source.slice(cursor, match.index)));
    if (match[1] != null) {
      children.push({ type: 'ruby', base: match[1], reading: match[2] });
    } else if (match[3] != null) {
      children.push({ type: 'ruby', base: match[3], reading: match[4] });
    } else {
      const raw = match[0];
      const description = match[5].trim();
      if (raw.startsWith('※') || /外字|unicode|U\+/i.test(description)) {
        const item = { type: 'gaiji', description, status: 'unresolved' };
        gaiji.push(item);
        children.push(item);
      } else {
        notes.push({ type: 'editorial-note', description });
      }
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) children.push(textNode(source.slice(cursor)));

  const danglingRuby = source.match(/[｜《》]/g)?.length;
  if (danglingRuby && !children.some((child) => child.type === 'ruby')) {
    warnings.push({ code: 'MALFORMED_RUBY', source });
  }
  return normalizeChildren(children);
}

function plainFromChildren(children) {
  return children.map((child) => {
    if (child.type === 'text') return child.value;
    if (child.type === 'ruby') return child.base;
    if (child.type === 'gaiji') return `〓［${child.description}］`;
    return '';
  }).join('');
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function makeDocument(format, fields) {
  return freezeDeep({ schemaVersion: AOZORA_DOCUMENT_VERSION, format, ...fields });
}

function splitTextColophon(source) {
  const marker = source.match(/\n-{20,}\n/);
  if (!marker) return { body: source, colophonText: '' };
  const index = marker.index;
  return { body: source.slice(0, index), colophonText: source.slice(index + marker[0].length) };
}

function parseColophon(text) {
  const colophon = {};
  for (const line of text.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const match = line.match(/^(底本|入力|校正)[：:]\s*(.+)$/);
    if (!match) continue;
    const key = { 底本: 'sourceBook', 入力: 'inputter', 校正: 'proofreader' }[match[1]];
    colophon[key] = match[2];
  }
  return colophon;
}

function textBlocks(body, notes, gaiji, warnings) {
  const lines = body.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    const value = paragraph.join('\n').trim();
    if (value) blocks.push({ type: 'paragraph', children: parseInlineText(value, notes, gaiji, warnings) });
    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    if (/^(?:第[一二三四五六七八九十百〇\d]+[章節]|[上中下])(?:\s|$)/.test(trimmed)) {
      flush();
      blocks.push({ type: 'heading', level: 1, children: parseInlineText(trimmed, notes, gaiji, warnings) });
    } else paragraph.push(line.trimEnd());
  }
  flush();
  return blocks;
}

export function parseAozoraText(source, options = {}) {
  invariant(typeof source === 'string', 'Aozora text source must be a string');
  invariant(options && typeof options === 'object' && !Array.isArray(options), 'options must be an object');
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const { body, colophonText } = splitTextColophon(normalized);
  const notes = [];
  const gaiji = [];
  const warnings = [];
  const blocks = textBlocks(body, notes, gaiji, warnings);
  return makeDocument('txt', {
    title: options.title ?? null,
    author: options.author ?? null,
    blocks,
    notes,
    gaiji,
    colophon: parseColophon(colophonText),
    warnings,
  });
}

function stripTags(value) {
  return decodeEntities(value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
}

function parseXhtmlInline(source, notes, gaiji, warnings) {
  const children = [];
  let cursor = 0;
  const ruby = /<ruby\b[^>]*>([\s\S]*?)<rt\b[^>]*>([\s\S]*?)<\/rt>(?:[\s\S]*?<\/ruby>)/gi;
  for (const match of source.matchAll(ruby)) {
    if (match.index > cursor) {
      children.push(...parseInlineText(stripTags(source.slice(cursor, match.index)), notes, gaiji, warnings));
    }
    const base = stripTags(match[1].replace(/<rp[\s\S]*?<\/rp>/gi, '')).trim();
    const reading = stripTags(match[2]).trim();
    if (base && reading) children.push({ type: 'ruby', base, reading });
    else warnings.push({ code: 'MALFORMED_RUBY', source: stripTags(match[0]) });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) children.push(...parseInlineText(stripTags(source.slice(cursor)), notes, gaiji, warnings));
  return normalizeChildren(children);
}

export function parseAozoraXhtml(source, options = {}) {
  invariant(typeof source === 'string', 'Aozora XHTML source must be a string');
  invariant(options && typeof options === 'object' && !Array.isArray(options), 'options must be an object');
  const cleaned = source.replace(/<head[\s\S]*?<\/head>/gi, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const notes = [];
  const gaiji = [];
  const warnings = [];
  const blocks = [];
  const blockPattern = new RegExp(`<(${BLOCK_TAGS.slice(3, -1)})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
  for (const match of cleaned.matchAll(blockPattern)) {
    const tag = match[1].toLowerCase();
    const children = parseXhtmlInline(match[2], notes, gaiji, warnings);
    if (!plainFromChildren(children).trim()) continue;
    blocks.push(/^h[1-6]$/.test(tag)
      ? { type: 'heading', level: Number(tag[1]), children }
      : { type: 'paragraph', children });
  }
  if (blocks.length === 0 && stripTags(cleaned).trim()) {
    blocks.push({ type: 'paragraph', children: parseXhtmlInline(cleaned, notes, gaiji, warnings) });
  }
  return makeDocument('xhtml', {
    title: options.title ?? null,
    author: options.author ?? null,
    blocks,
    notes,
    gaiji,
    colophon: options.colophon ?? {},
    warnings,
  });
}

export function aozoraDocumentToPlainText(document) {
  validateAozoraDocument(document);
  return document.blocks.map((block) => plainFromChildren(block.children)).join('\n\n');
}

export function validateAozoraDocument(document) {
  invariant(document && typeof document === 'object' && !Array.isArray(document), 'document must be an object');
  invariant(document.schemaVersion === AOZORA_DOCUMENT_VERSION, 'Unsupported Aozora document version');
  invariant(document.format === 'txt' || document.format === 'xhtml', 'Unsupported Aozora document format');
  invariant(Array.isArray(document.blocks), 'document.blocks must be an array');
  invariant(Array.isArray(document.notes), 'document.notes must be an array');
  invariant(Array.isArray(document.gaiji), 'document.gaiji must be an array');
  invariant(Array.isArray(document.warnings), 'document.warnings must be an array');
  for (const block of document.blocks) {
    invariant(block?.type === 'paragraph' || block?.type === 'heading', 'Unsupported Aozora block');
    invariant(Array.isArray(block.children), 'block.children must be an array');
    for (const child of block.children) {
      invariant(['text', 'ruby', 'gaiji'].includes(child?.type), 'Unsupported Aozora inline node');
      if (child.type === 'text') invariant(typeof child.value === 'string', 'Text node value must be a string');
      if (child.type === 'ruby') invariant(typeof child.base === 'string' && !!child.base && typeof child.reading === 'string' && !!child.reading, 'Ruby node must have base and reading');
    }
  }
  return true;
}
