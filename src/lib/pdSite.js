// 퍼블릭 도메인 전자책 사이트 정본 책(LIT-SRC-PD-1, 오너 「동물농장, 1984 … 노인과 바다, 자기만의 방 … 어린 왕자, 이방인, 시지프 신화」
// 2026-10-17 KST) — 저장·네트워크 없는 순수 함수.
//
// 미국에서 아직 보호 중이라 Standard Ebooks · Gutenberg(미국)에 없는 작품을, 그 나라에서 퍼블릭 도메인인 전자책 사이트의 판에서 받는다.
//   · Faded Page(캐나다 — Distributed Proofreaders Canada 교정본): 노인과 바다 · 자기만의 방 · L’Étranger · Le Mythe de Sisyphe
//   · Project Gutenberg Australia: Animal Farm · Nineteen Eighty-Four · Le Petit Prince
// 한국에서 공개할 수 있는지는 rightsKorea(한국 법)로 따로 판정한다 — 그 사이트 나라의 판정을 빌리지 않는다.
// 두 사이트 모두 「화면에 맞춘 바꿈 밖의 수정」이면 머리말·사이트 표지를 떼라고 한다 — 우리는 사이트 머리말·판권·후기를 싣지 않고
// 본문만 장으로 나눠 보인다(장 분할 · 보이지 않는 조판 문자 정리 · 삽화·각주 생략은 화면에 맞춘 바꿈으로 본다).
//
// 원문은 리포에 고정한다: 사이트 HTML 한 파일을 바이트 그대로 source/에 두고 SHA-256을 entry.json에 적는다(scripts/literature/pd-add-work.mjs).
// 사이트마다 · 책마다 HTML 모양이 달라서, 본문의 시작 · 끝 · 장 제목 · 부(part) 제목을 entry.parse에 정규식으로 적는다. 모르는 구조는 throw.

import { koreaPublicDomainVerdict } from './rightsKorea.js';
import { splitBlocksByWords, wordCount } from './standardEbooks.js';

export const PD_PROVIDER = 'pdsite';
export const PD_BOOK_VERSION = 1;
export const PD_SITES = Object.freeze({
  fp: Object.freeze({ name: 'Faded Page', host: 'www.fadedpage.com', country: 'CA' }),
  gau: Object.freeze({ name: 'Project Gutenberg Australia', host: 'gutenberg.net.au', country: 'AU' }),
});
export const PD_LANGUAGES = Object.freeze(['English', 'French']);
export const PD_TARGET_WORDS = 2200;
export const PD_EDITS = Object.freeze(['chapter-split-by-manabi', 'typography-normalized', 'illustrations-omitted', 'site-front-matter-omitted']);
const SCENE_BREAK = '⁂';

const KEY_PATTERN = /^pd-(fp|gau)-[a-z0-9]+(?:-[a-z0-9]+)*_[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', shy: '',
  Agrave: 'À', agrave: 'à', Acirc: 'Â', acirc: 'â', Ccedil: 'Ç', ccedil: 'ç', Eacute: 'É', eacute: 'é', Egrave: 'È', egrave: 'è',
  Ecirc: 'Ê', ecirc: 'ê', Euml: 'Ë', euml: 'ë', Icirc: 'Î', icirc: 'î', Iuml: 'Ï', iuml: 'ï', Ocirc: 'Ô', ocirc: 'ô', OElig: 'Œ', oelig: 'œ',
  Ucirc: 'Û', ucirc: 'û', Ugrave: 'Ù', ugrave: 'ù', Uuml: 'Ü', uuml: 'ü',
};
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, body) => {
    if (body[0] === '#') return String.fromCodePoint(body[1].toLowerCase() === 'x' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1)));
    if (Object.hasOwn(NAMED, body)) return NAMED[body];
    throw new Error(`모르는 문자 참조 ${whole}`);
  });
}
const normalizeTypography = (text) => text.replace(/[⁠­​﻿]/gu, '').replace(/[     ]/gu, ' ');
const INLINE = /<\/?(?:span|i|b|em|strong|small|big|sup|sub|a|font|u|s|cite|abbr)\b[^>]*>/giu;

/** 블록 안쪽 → 글자(<br>만 줄바꿈). 남은 태그가 있으면 throw. */
function blockText(inner) {
  const flat = inner.replace(/\s+/gu, ' ').replace(/<br\b[^>]*>/giu, '\n').replace(INLINE, '');
  if (/[<>]/u.test(flat)) throw new Error(`본문 블록에 모르는 태그가 있다: ${flat.slice(0, 80)}`);
  return normalizeTypography(decodeEntities(flat)).split('\n').map((line) => line.replace(/ {2,}/gu, ' ').trim()).filter(Boolean).join('\n');
}

/** 표 → 문단 하나(행마다 한 줄). 각주 표(summary="footnote_n")는 각주라 뺀다. */
function tableToBlock(table) {
  if (/summary=['"]footnote/iu.test(table)) return '';
  const flat = (inner) => normalizeTypography(decodeEntities(inner.replace(/<\/?(?:div|p|br|td|th|li)\b[^>]*>/giu, ' ').replace(/<[^>]+>/gu, ''))).replace(/\s+/gu, ' ').trim();
  const lines = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)]
    .map((row) => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/giu)].map((cell) => flat(cell[1])).filter(Boolean).join(' '))
    .filter(Boolean);
  const escape = (line) => line.replace(/[<>&]/gu, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char]);
  return lines.length ? `<p>${lines.map(escape).join('<br>')}</p>` : '';
}

/**
 * 사이트 HTML → [{tag, text}] — 제목(h1–h6)과 문단(p)을 문서 순서대로. 본문 시작(parse.start)부터 끝(parse.stop) 앞까지만이고,
 * 그 사이에 블록 밖 글자가 남으면 throw(fail-closed). 삽화·각주 표·각주 번호는 뺀다. 장식 줄(* * *)은 「⁂」.
 * parse: {start?: 정규식(「tag:글자」에 맞춘다 — 없으면 첫 장 제목부터), stop: 정규식, chapter?: 정규식, part?: 정규식}
 */
export function parsePdSiteHtml(html, parse) {
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/iu.exec(html);
  if (!body) throw new Error('HTML에 <body>가 없다');
  let notesOmitted = false;
  const content = body[1]
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/<(script|style|noscript|iframe)\b[\s\S]*?<\/\1>/giu, '')
    .replace(/<table\b[\s\S]*?<\/table>/giu, (table) => { const block = tableToBlock(table); if (!block) notesOmitted = true; return block; })
    // 장 끝 각주 상자(국화와 칼 <div class='footnote'><p class='footnote'>[1] Reported in …</p></div>) — 각주는 싣지 않는다
    .replace(/<div\b[^>]*class=['"]footnote['"][^>]*>(?:(?!<\/?div\b)[\s\S])*<\/div>/giu, () => { notesOmitted = true; return ''; })
    // 각주 번호 — 각주로 가는 고리(<a href="#f12"><sup>[12]</sup></a>)와 홀로 선 위첨자 번호
    .replace(/<a\b[^>]*href=['"]#f\d+['"][^>]*>[\s\S]*?<\/a>/giu, () => { notesOmitted = true; return ''; })
    .replace(/<sup\b[^>]*>(?:\s*<[^>]+>)*\s*\[?\d+\]?\s*(?:<\/[^>]+>\s*)*<\/sup>/giu, () => { notesOmitted = true; return ''; })
    // 번호 목록·문답(국화와 칼 「1) As ‘a complete man’ …」 「Monk: …」) — Faded Page는 머리표를 문단 앞 span에 둔다. 문단 머리로 붙인다.
    .replace(/<span\b[^>]*class=['"]listTag['"][^>]*>((?:(?!<\/?span\b)[\s\S]|<span\b[^>]*>[^<]*<\/span>)*)<\/span>\s*<p\b[^>]*>/giu, '<p>$1 ')
    .replace(/<img\b[^>]*>/giu, '')
    .replace(/<hr\b[^>]*>/giu, '');
  const items = [];
  // 블록: 제목 · <pre>(노래 — 동물농장 「Beasts of England」, 줄을 살린다) · 문단. 닫지 않은 <p>(어린 왕자 판)는 다음 블록 앞에서 끝난다.
  const pattern = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<pre\b[^>]*>([\s\S]*?)<\/pre>|<p\b[^>]*>((?:(?!<p\b|<\/p>|<h[1-6]\b|<pre\b|<\/?div\b)[\s\S])*)(?:<\/p>)?/giu;
  for (const match of content.matchAll(pattern)) {
    const [tag, inner] = match[1] ? [match[1].toLowerCase(), match[2]] : match[3] !== undefined ? ['pre', match[3].replace(/\r?\n/gu, '<br>')] : ['p', match[4]];
    const text = blockText(inner);
    if (text) items.push({ tag, text, at: match.index, end: match.index + match[0].length });
  }
  const key = (item) => `${item.tag}:${item.text}`;
  const start = parse.start ? new RegExp(parse.start, 'u') : new RegExp(parse.chapter, 'u');
  const first = items.findIndex((item) => start.test(key(item)));
  if (first < 0) throw new Error(`본문 시작을 찾지 못했다: ${parse.start || parse.chapter}`);
  const stop = new RegExp(parse.stop, 'u');
  const last = items.findIndex((item, index) => index > first && stop.test(key(item)));
  if (last < 0) throw new Error(`본문 끝을 찾지 못했다: ${parse.stop}`);
  // 본문 구간의 블록 밖 글자 — 감싼 div 태그만 걷고 글자가 남으면 모르는 구조다
  const region = content.slice(items[first].at, items[last].at);
  const leftover = region.replace(pattern, '').replace(/<\/p>/giu, '').replace(/<[^>]+>/gu, '');
  if (normalizeTypography(decodeEntities(leftover)).trim()) throw new Error(`알려진 블록 밖에 본문 글자가 있다: ${leftover.trim().slice(0, 80)}`);
  const blocks = items.slice(first, last).map(({ tag, text }) => ({ tag, text: /^[\s*·⁂.]+$/u.test(text) && /\*/u.test(text) ? SCENE_BREAK : text }));
  return { blocks, notesOmitted };
}

/**
 * 블록 → 장. parse.part에 맞는 제목은 부(part) — 다음 장 제목 앞에 붙는다(「Part One · Chapter 1」). 부 제목 바로 뒤에 본문이 오면
 * (시지프 「Le mythe de Sisyphe」) 그 부가 곧 장이다. parse.chapter에 맞는 제목은 장. 그 밖의 제목은 본문 문단. 장 제목이 없으면 한 장.
 */
export function pdSiteSections(blocks, parse, workTitle) {
  const part = parse.part ? new RegExp(parse.part, 'u') : null;
  const chapter = parse.chapter ? new RegExp(parse.chapter, 'u') : null;
  const tidy = (text) => text.replace(/\n+/gu, ' ').replace(/\.$/u, '');
  // subtitle: 장 번호 바로 다음 머리글이 장 이름인 판(국화와 칼 「1」 + 「Assignment: Japan」) — 「1: Assignment: Japan」로 합친다.
  const subtitle = parse.subtitle ? new RegExp(parse.subtitle, 'u') : null;
  const sections = [];
  let prefix = null;
  let awaitingSubtitle = false;
  for (const block of blocks) {
    const label = `${block.tag}:${block.text}`;
    if (awaitingSubtitle && subtitle?.test(label)) { sections.at(-1).title += `: ${tidy(block.text)}`; awaitingSubtitle = false; continue; }
    awaitingSubtitle = false;
    if (part?.test(label)) { prefix = tidy(block.text); sections.push({ title: prefix, part: true, blocks: [] }); continue; }
    if (chapter?.test(label)) { sections.push({ title: prefix ? `${prefix} · ${tidy(block.text)}` : tidy(block.text), blocks: [] }); awaitingSubtitle = true; continue; }
    if (!sections.length) sections.push({ title: workTitle, blocks: [] });
    sections.at(-1).blocks.push(block.text);
  }
  // 본문 없는 부 제목은 장이 아니다(다음 장 제목의 앞머리) · 본문이 있는 부 제목은 그 자체로 장
  return sections.filter((section) => section.blocks.length > 0).map(({ title, blocks: list }) => ({ title, blocks: list }));
}

/** 권리 판정 — 한국 공개 가능(rightsKorea 공통 정본). */
export function pdSiteRightsVerdict(literature = {}) {
  return koreaPublicDomainVerdict(literature);
}

/** 게시 가능한 권리 기록인가 — 승인 · 퍼블릭 도메인 · 원산국/한국 검토 · 판정 통과. */
export function pdSiteRightsPublishable(literature) {
  const rights = literature?.rights;
  if (literature?.provider !== PD_PROVIDER || rights?.status !== 'approved' || rights?.basis !== 'public-domain') return false;
  const jurisdictions = Array.isArray(rights.reviewedJurisdictions) ? rights.reviewedJurisdictions : [];
  if (![literature.countryOfOrigin, literature.translator?.countryOfOrigin, 'KR'].filter(Boolean).every((code) => jurisdictions.includes(code))) return false;
  return pdSiteRightsVerdict(literature).ok;
}

function validateEntry(entry) {
  const problems = [];
  if (entry?.schemaVersion !== PD_BOOK_VERSION) problems.push(`schemaVersion ${PD_BOOK_VERSION}`);
  if (entry?.provider !== PD_PROVIDER) problems.push(`provider '${PD_PROVIDER}'`);
  if (!Object.hasOwn(PD_SITES, entry?.site)) problems.push(`site(${Object.keys(PD_SITES).join('·')})`);
  if (!KEY_PATTERN.test(entry?.key ?? '') || !String(entry?.key).startsWith(`pd-${entry?.site}-`)) problems.push('key(pd-<site>-<작가>_<작품>)');
  const host = PD_SITES[entry?.site]?.host;
  if (host && !String(entry?.url ?? '').startsWith(`https://${host}/`)) problems.push(`url(https://${host}/…)`);
  if (!PD_LANGUAGES.includes(entry?.language)) problems.push(`language(${PD_LANGUAGES.join('·')})`);
  for (const field of ['title', 'author', 'level']) if (typeof entry?.[field] !== 'string' || !entry[field].trim()) problems.push(field);
  if (typeof entry?.title === 'string' && entry.title.includes(' — ')) problems.push('title에 「 — 」(장 제목 구분자)를 쓰지 않는다');
  const file = entry?.file;
  if (!/^[A-Za-z0-9._-]+\.html$/u.test(file?.path ?? '') || !SHA256.test(file?.sha256 ?? '') || !['utf-8', 'windows-1252'].includes(file?.encoding)) problems.push('file {path, sha256, encoding(utf-8·windows-1252)}');
  if (typeof entry?.parse?.stop !== 'string' || (!entry.parse.chapter && !entry.parse.start)) problems.push('parse {stop, chapter 또는 start}');
  if (problems.length) throw new Error(`entry.json: ${problems.join(' · ')}`);
  return entry.key;
}

/** entry + 사이트 HTML 글자 → 정본 책 초안(literaturePublish.js가 받는 모양). 해시 대조는 빌드가 한다(바이트 기준). */
export function createPdSiteDraft(entry, html) {
  const key = validateEntry(entry);
  const verdict = pdSiteRightsVerdict(entry);
  if (!verdict.ok) throw new Error(`권리 판정 불가: ${verdict.reasons.join(' / ')}`);
  const { blocks, notesOmitted } = parsePdSiteHtml(html, entry.parse);
  const sections = pdSiteSections(blocks, entry.parse, entry.title);
  if (!sections.length) throw new Error('장이 없다');
  const pieces = [];
  for (const section of sections) {
    const groups = splitBlocksByWords(section.blocks, PD_TARGET_WORDS);
    groups.forEach((group, index) => pieces.push({ title: groups.length > 1 ? `${section.title} (${index + 1}/${groups.length})` : section.title, rawText: group.join('\n\n') }));
  }
  const total = pieces.length;
  const book = { key, title: entry.title, author: entry.author, level: entry.level, total };
  const literature = {
    schemaVersion: PD_BOOK_VERSION,
    provider: PD_PROVIDER,
    workKey: key,
    site: entry.site,
    title: entry.title,
    author: entry.author,
    publishedYear: entry.publishedYear,
    authorDeathYear: entry.authorDeathYear,
    countryOfOrigin: entry.countryOfOrigin,
    ...(entry.countryOfOrigin === 'FR' ? { mortPourLaFrance: entry.mortPourLaFrance } : {}),
    translator: entry.translator ?? null,
    url: entry.url,
    fetchedAt: entry.file.fetchedAt,
    rights: entry.rights,
    rightsBasis: verdict.basis,
    edits: [...PD_EDITS, ...(notesOmitted ? ['notes-omitted'] : [])],
  };
  const chapters = pieces.map((piece, index) => {
    const order = index + 1;
    return {
      order,
      title: piece.title,
      materialTitle: `${entry.title} — ${piece.title}`,
      rawText: piece.rawText,
      metadata: {
        language: entry.language,
        level: entry.level,
        book: { key, title: entry.title, author: entry.author, order, total },
        literature,
      },
    };
  });
  const sizes = chapters.map((chapter) => wordCount(chapter.rawText));
  return {
    schemaVersion: PD_BOOK_VERSION,
    book,
    chapters,
    diagnostics: { chapterCount: total, size: sizes.reduce((sum, value) => sum + value, 0), unit: 'words', minChapter: Math.min(...sizes), maxChapter: Math.max(...sizes) },
  };
}
