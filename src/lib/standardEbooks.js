// Standard Ebooks 정본 책(LIT-SRC-EN-1, 오너 「ㄱㄱ」 2026-10-16 KST — 영어 시범 3편) — 저장·네트워크 없는 순수 함수.
//
// 출처: Standard Ebooks(https://standardebooks.org). 미국 퍼블릭 도메인 원문을 다시 교정·구조화한 판이고, 교정·서식 기여는
// CC0 1.0(전 세계 퍼블릭 도메인 헌정)이다. 원문의 다른 나라 권리는 우리가 따로 본다 → standardEbooksRightsVerdict.
// 원문은 리포에 고정한다: 판 저장소의 한 커밋(entry.commit)에서 본문 XHTML 파일만 source/에 복사하고 파일마다 SHA-256을
// entry.json에 적는다(아오조라 source.txt + textSha256과 같은 원리). 빌드(scripts/lib/standard-ebooks-build.mjs)가 이 모듈로
// 장 초안을 만든다 — 장 모양은 정본 문학책(literaturePublish.js)과 같아서 게시(준비 → 분석 → 검수 → 공개)를 그대로 쓴다.
//
// 장 나눔: 판의 본문 파일 하나(장·단편·stave)가 기본 단위. 영어 학습 한 번 분량(10–15분)을 넘으면 그 파일 안에서 문단 경계로
// 고르게 나눈다(목표 SE_TARGET_WORDS 단어) — 「A Scandal in Bohemia (2/4)」. 문단 한가운데는 자르지 않는다.
// 바꾼 점(edits — 뷰어 출처 줄이 밝힌다): 장 분할, 글자 정리(단어 결합자·줄 안 공백 제거 등 보이지 않는 조판 문자), 삽화 생략.

import { koreaPublicDomainVerdict } from './rightsKorea.js';

export const SE_PROVIDER = 'standardebooks';
export const SE_BOOK_VERSION = 1;
export const SE_LANGUAGE = 'English';
export const SE_TARGET_WORDS = 2200;
export const SE_LICENSE = 'CC0-1.0';
export const SE_EDITS = Object.freeze(['chapter-split-by-manabi', 'typography-normalized', 'illustrations-omitted']);

const KEY_PATTERN = /^se-[a-z0-9]+(?:-[a-z0-9]+)*(?:_[a-z0-9]+(?:-[a-z0-9]+)*){1,4}$/u; // 번역본은 _<번역자>가 붙는다(명상록 george-long) · 공저 · 번역자 둘(전쟁과 평화 louise-maude_aylmer-maude)
const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;

/** 판 저장소 이름(standardebooks/<작가>_<작품>) → 책 key. */
export const standardEbooksBookKey = (repo) => `se-${String(repo).split('/').pop()}`;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, name) => {
    if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
    if (Object.hasOwn(ENTITIES, name)) return ENTITIES[name];
    throw new Error(`모르는 문자 참조 ${whole}`);
  });
}

/** 보이지 않는 조판 문자 정리 — 단어 결합자·줄표 앞 결합자·연한 하이픈은 지우고, 줄 안 고정 공백은 보통 공백으로. */
function normalizeTypography(text) {
  return text.replace(/[⁠­​ ]/gu, '').replace(/[   ]/gu, ' ');
}

/** 요소 안쪽 → 글자(줄바꿈 <br/>만 살린다). 태그가 남으면 throw(모르는 구조를 글자로 흘리지 않는다). 책 안 상호참조 <a>(명상록 「[Book IV]」)는 글자만. */
function blockText(inner) {
  const flat = inner.replace(/\s+/gu, ' ').replace(/<br\s*\/>/gu, '\n');
  const stripped = flat.replace(/<\/?(?:span|em|i|b|strong|abbr|time|q|cite|small|sup|sub|var|code|bdi|dfn|s|u|a)\b[^>]*>/gu, '');
  if (/[<>]/u.test(stripped)) throw new Error(`본문 블록에 모르는 태그가 있다: ${stripped.slice(0, 80)}`);
  return normalizeTypography(decodeEntities(stripped)).split('\n').map((line) => line.replace(/ {2,}/gu, ' ').trim()).filter(Boolean).join('\n');
}

/**
 * 판 본문 XHTML 하나 → {title, blocks}. title은 문서 <title>(「II: The Pool of Tears」·「Stave I: Marley’s Ghost」·
 * 「A Scandal in Bohemia」), blocks는 문단(시 행은 \n으로 이은 한 블록). 장 제목 머리(hgroup·h2)와 삽화(figure)는 뺀다 —
 * 제목은 장 제목으로 따로 쓰고, 그림은 싣지 않는다. 단편 안 절 번호(h3 「II」)는 문단으로 남긴다(첫 블록이면 뺀다).
 * 알려진 블록 밖에 글자가 남으면 throw — 모르는 구조의 본문이 조용히 사라지지 않게(fail-closed).
 */
export function parseStandardEbooksXhtml(xhtml) {
  const title = /<title>([\s\S]*?)<\/title>/u.exec(xhtml);
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/u.exec(xhtml);
  if (!title || !body) throw new Error('XHTML에 <title>과 <body>가 있어야 한다');
  const notesOmitted = /epub:type="noteref"/u.test(body[1]);
  const content = body[1]
    .replace(/<!--[\s\S]*?-->/gu, '') // 편집 주석(「<!--sic-->」) — 본문이 아니다
    .replace(/<figure\b[\s\S]*?<\/figure>/gu, '')
    .replace(/<hgroup\b[\s\S]*?<\/hgroup>/gu, '')
    .replace(/<h2\b[\s\S]*?<\/h2>/gu, '')
    .replace(/<li\b[^>]*>(\s*<p\b[\s\S]*?)<\/li>/gu, '$1') // 문단을 품은 목록 항목(일지·편지) — 안쪽 문단을 그대로
    .replace(/<table\b[\s\S]*?<\/table>/gu, tableToBlock) // 표(월든 집 짓기 비용 · 개츠비 일과표) — 행마다 한 줄인 문단 하나
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*\/?>/gu, '$1') // 글 속 작은 그림(모비 딕 퀴퀘그의 서명 표시) — 그림 대신 대체 글자
    .replace(/(<\/p>\s*)<cite\b[^>]*>([\s\S]*?)<\/cite>/gu, '$1<p>— $2</p>') // 제사(題詞) 출처 — 「— Job」 한 줄 문단
    .replace(/<a\b[^>]*epub:type="noteref"[^>]*>[\s\S]*?<\/a>/gu, ''); // 미주 번호 — 미주는 싣지 않는다
  const blocks = [];
  const pattern = /<(p|h[3-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/gu;
  for (const match of content.matchAll(pattern)) {
    const text = blockText(match[2]);
    if (!text) continue;
    if (/^h[3-6]$/u.test(match[1]) && blocks.length === 0) continue; // 단편 첫 절 「I」 — 제목 바로 아래 번호는 군더더기
    blocks.push(text);
  }
  const leftover = content.replace(pattern, '').replace(/<[^>]+>/gu, '');
  if (leftover.trim()) throw new Error(`알려진 블록 밖에 본문 글자가 있다: ${leftover.trim().slice(0, 80)}`);
  if (blocks.length === 0) throw new Error('본문 문단이 없다');
  return { title: blockText(title[1]), blocks, notesOmitted };
}

/** 표 → 문단 하나(행마다 한 줄, 칸 글자는 공백으로). 칸 안 꾸밈 태그는 글자만 남긴다 — 표는 드물고 글자가 전부다. */
function tableToBlock(table) {
  const flat = (inner) => normalizeTypography(decodeEntities(inner.replace(/<\/?(?:div|p|br|td|th|li)\b[^>]*>/gu, ' ').replace(/<[^>]+>/gu, ''))).replace(/\s+/gu, ' ').trim();
  const lines = [];
  const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/u.exec(table);
  if (caption && flat(caption[1])) lines.push(flat(caption[1]));
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gu)].map((cell) => flat(cell[1])).filter(Boolean);
    if (cells.length) lines.push(cells.join(' '));
  }
  const escape = (line) => line.replace(/[<>&]/gu, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char]);
  return lines.length ? `<p>${lines.map(escape).join('<br/>')}</p>` : '';
}

export const wordCount = (text) => (String(text).match(/\S+/gu) || []).length;

/**
 * 문단들 → 문단 경계로 나눈 묶음. 묶음 수 n = round(전체 단어 / 목표)(최소 1), 경계는 누적 단어가 k·전체/n에 가장 가까운 문단 사이.
 * 빈 묶음은 만들지 않는다.
 */
export function splitBlocksByWords(blocks, target = SE_TARGET_WORDS) {
  const counts = blocks.map(wordCount);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const parts = Math.max(1, Math.min(blocks.length, Math.round(total / target)));
  if (parts === 1) return [blocks];
  const cuts = [];
  let cumulative = 0;
  let k = 1;
  for (let index = 0; index < blocks.length - 1 && k < parts; index += 1) {
    const before = cumulative;
    cumulative += counts[index];
    const goal = (k * total) / parts;
    if (cumulative >= goal) {
      const cut = Math.abs(before - goal) < Math.abs(cumulative - goal) && index > (cuts.at(-1) ?? 0) ? index : index + 1;
      if (cut > (cuts.at(-1) ?? 0) && cut < blocks.length) cuts.push(cut);
      k += 1;
    }
  }
  const bounds = [0, ...cuts, blocks.length];
  return bounds.slice(1).map((end, index) => blocks.slice(bounds[index], end)).filter((group) => group.length > 0);
}

/** 권리 판정 — 한국 공개 가능(① 한국 만료 · ② 본국 만료, 공통 정본 rightsKorea). */
export function standardEbooksRightsVerdict(literature = {}) {
  return koreaPublicDomainVerdict(literature);
}

/** 게시 가능한 권리 기록인가 — 승인·퍼블릭 도메인 · 원산국·한국 검토 · 판정 통과 · 판 라이선스 CC0. */
export function standardEbooksRightsPublishable(literature) {
  const rights = literature?.rights;
  if (literature?.provider !== SE_PROVIDER || rights?.status !== 'approved' || rights?.basis !== 'public-domain') return false;
  if (literature.license !== SE_LICENSE) return false;
  const jurisdictions = Array.isArray(rights.reviewedJurisdictions) ? rights.reviewedJurisdictions : [];
  if (![literature.countryOfOrigin, literature.translator?.countryOfOrigin, 'KR'].filter(Boolean).every((code) => jurisdictions.includes(code))) return false;
  return standardEbooksRightsVerdict(literature).ok;
}

function validateEntry(entry) {
  const problems = [];
  if (entry?.schemaVersion !== SE_BOOK_VERSION) problems.push(`schemaVersion ${SE_BOOK_VERSION}`);
  if (entry?.provider !== SE_PROVIDER) problems.push(`provider '${SE_PROVIDER}'`);
  if (!/^standardebooks\/[a-z0-9-]+(?:_[a-z0-9-]+){1,4}$/u.test(entry?.repo ?? '')) problems.push('repo(standardebooks/<작가>_<작품>[_<번역자>])');
  if (!COMMIT.test(entry?.commit ?? '')) problems.push('commit(40자 SHA)');
  if (!/^https:\/\/standardebooks\.org\/ebooks\//u.test(entry?.url ?? '')) problems.push('url(standardebooks.org/ebooks/…)');
  for (const field of ['title', 'author', 'level']) if (typeof entry?.[field] !== 'string' || !entry[field].trim()) problems.push(field);
  if (typeof entry?.title === 'string' && entry.title.includes(' — ')) problems.push('title에 「 — 」(장 제목 구분자)를 쓰지 않는다');
  if (!Array.isArray(entry?.files) || entry.files.length === 0) problems.push('files(본문 XHTML 목록)');
  else entry.files.forEach((file, index) => {
    if (!/^[a-z0-9-]+\.xhtml$/u.test(file?.path ?? '') || !SHA256.test(file?.sha256 ?? '')) problems.push(`files[${index}] {path, sha256}`);
  });
  if (problems.length) throw new Error(`entry.json: ${problems.join(' · ')}`);
  const key = standardEbooksBookKey(entry.repo);
  if (!KEY_PATTERN.test(key)) throw new Error(`entry.json: repo에서 만든 key ${key}가 형식에 맞지 않는다`);
  return key;
}

/**
 * entry + 본문 파일들({path, text} — entry.files 순서) → 정본 책 초안(literaturePublish.js가 받는 모양).
 * 파일 해시 대조는 빌드가 한다(바이트 기준). 여기서는 구조·장 나눔·권리만 본다 — 권리가 통과하지 않으면 throw.
 */
export function createStandardEbooksDraft(entry, files, { targetWords = SE_TARGET_WORDS } = {}) {
  const key = validateEntry(entry);
  const verdict = standardEbooksRightsVerdict(entry);
  if (!verdict.ok) throw new Error(`권리 판정 불가: ${verdict.reasons.join(' / ')}`);
  if (files.length !== entry.files.length || files.some((file, index) => file.path !== entry.files[index].path)) {
    throw new Error('본문 파일이 entry.files와 다르다');
  }
  const pieces = [];
  let notesOmitted = false;
  for (const file of files) {
    const { title, blocks, notesOmitted: notes } = parseStandardEbooksXhtml(file.text);
    notesOmitted ||= notes;
    const groups = splitBlocksByWords(blocks, targetWords);
    groups.forEach((group, index) => pieces.push({
      title: groups.length > 1 ? `${title} (${index + 1}/${groups.length})` : title,
      rawText: group.join('\n\n'),
      sourceFile: file.path,
    }));
  }
  const total = pieces.length;
  const book = { key, title: entry.title, author: entry.author, level: entry.level, total };
  const literature = {
    schemaVersion: SE_BOOK_VERSION,
    provider: SE_PROVIDER,
    workKey: key,
    title: entry.title,
    author: entry.author,
    publishedYear: entry.publishedYear,
    authorDeathYear: entry.authorDeathYear,
    countryOfOrigin: entry.countryOfOrigin,
    translator: entry.translator ?? null,
    repo: entry.repo,
    commit: entry.commit,
    url: entry.url,
    license: SE_LICENSE,
    rights: entry.rights,
    edits: [...SE_EDITS, ...(notesOmitted ? ['notes-omitted'] : [])],
  };
  const chapters = pieces.map((piece, index) => {
    const order = index + 1;
    return {
      order,
      title: piece.title,
      materialTitle: `${entry.title} — ${piece.title}`,
      rawText: piece.rawText,
      metadata: {
        language: SE_LANGUAGE,
        level: entry.level,
        book: { key, title: entry.title, author: entry.author, order, total },
        literature: { ...literature, sourceFile: piece.sourceFile },
      },
    };
  });
  const words = chapters.map((chapter) => wordCount(chapter.rawText));
  return {
    schemaVersion: SE_BOOK_VERSION,
    book,
    chapters,
    diagnostics: { fileCount: files.length, chapterCount: total, words: words.reduce((sum, value) => sum + value, 0), minChapterWords: Math.min(...words), maxChapterWords: Math.max(...words) },
  };
}
