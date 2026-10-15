// 승인된 青空文庫 카탈로그 항목 + 파싱 문서 → 기존 공개 책(reading_materials · metadata.book) 장 초안.
// 저장·분석·네트워크 호출은 하지 않는 순수 함수다. 결과는 scripts/build-literature.mjs가 chapters.json으로 쓴다.
//
// 원칙(설계 §3.2·§3.3):
//   · 장 분할은 기존 정본 splitTextIntoChapters를 쓴다. 見出し 주석이 2개 이상이면 그 표제로만 나눈다(추정 패턴 미사용).
//   · raw_text는 문단(원문 한 줄)마다 빈 줄로 띄운 평문이다. 루비·주석은 빼고, 들여쓰기 전각 공백은 지운다.
//     긴 줄을 나누지 않는다 — 분석 요청 분할은 analyzeText(splitAnalysisLine)가 맡는다(#1412).
//   · 루비 잠금은 **최종 장 raw_text** 기준 오프셋이다. 투영 텍스트에 사설 영역 표식(U+E000/U+E001)으로 루비 기준을
//     감싸 분할을 통과시킨 뒤, 장마다 표식을 걷어 내며 위치를 센다 — 분할 단계의 다듬기(trim)·이음(\n\n)이 위치를
//     바꿔도 어긋나지 않는다. autoSplitParagraphs 같은 재가공은 하지 않는다(오프셋 붕괴).
import { aozoraCatalogEntryPublishable, aozoraWorkKey, validateAozoraCatalogEntry } from './aozoraCatalog.js';
import { aozoraBlockText, aozoraRubyClass, validateAozoraDocument } from './aozoraParser.js';
import { splitTextIntoChapters } from './bookSplit.js';

export const AOZORA_MATERIAL_VERSION = 1;
/** 장 크기 — 10~15분 분량(설계 §1.2). 표제 장이 상한을 넘을 때만 문단 경계에서 더 나눈다. */
export const AOZORA_CHAPTER_TARGET_CHARS = 3000;
export const AOZORA_CHAPTER_MAX_CHARS = 6000;
/** 見出し 장이 이보다 길면 그 장만 고른 크기로 다시 나눈다(「一 (1/2)」) — 장당 10–15분(설계 §1.2). 坊っちゃん 실측: 一 7,539자. */
export const AOZORA_HEADING_CHAPTER_MAX_CHARS = 4000;
/** 첫 見出し 앞 머리말이 이 길이 이하면 첫 장 머리에 붙인다(実물 やまなし 「小さな谷川の底を写した二枚の青い幻燈です。」 21자가 한 장이 되던 문제). */
export const AOZORA_PREFACE_MERGE_MAX_CHARS = 500;
/** 고른 분할로 받아들이는 장 크기 비(가장 긴 장 / 가장 짧은 장) — 이보다 고르지 않은 후보는 이음 문단 회피보다 뒤로 둔다. */
const BALANCED_RATIO = 1.25;
/** 우리가 바꾼 점(취급 규준 「작업 이력」) — 뷰어 출처 줄이 이 코드로 문구를 고른다. */
export const AOZORA_EDIT_NOTES = Object.freeze(['ruby-reading-aid', 'chapter-split-by-manabi']);
/** Unicode에 없는 작은 가나를 보통 크기로 바꾼 책에만 더하는 편집 표시(AOZORA_SUBSTITUTED_GAIJI). */
export const AOZORA_SMALL_KANA_EDIT = 'small-kana-as-full';
/** 교정자 없는 青空文庫 입력본을 오너 승인(entry.unproofreadApproval)으로 수록한 책에만 더하는 표시 — 뷰어 출처 줄이 밝힌다. */
export const AOZORA_UNPROOFREAD_EDIT = 'unproofread-source';

const OPEN = '\uE000';
const CLOSE = '\uE001';
/** 장보다 긴 문단을 문장 끝에서 나눈 조각의 머리 표식 — 분할기는 문단 경계로 보고, 장 안에서는 다시 이어 붙인다. */
const SENTENCE_JOIN = '\uE002';
// 문장 끝 — 。！？ 뒤 닫는 괄호까지(「…た。」의 」 앞에서 자르지 않는다). 루비 기준(漢字 연속)에는 없는 글자다.
const SENTENCE_END = /[。！？!?][」』）〕】〉》"'”’]*/gu;
const HEADING_PREFIX = '# ';
const headingTest = (line) => line.startsWith(HEADING_PREFIX) && line.length > HEADING_PREFIX.length;
const EDGE_SPACE = /^[\s\u3000]+|[\s\u3000]+$/gu;

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

/**
 * 잠금 대상 루비 — 사전 furigana와 같은 뜻(한자의 읽기)인 것만: 기준에 한자가 있고 읽기가 가나뿐.
 * ノート《帳面》·かげろう《陽炎》 같은 의미 주석·当て字 표시는 독음이 아니므로 잠그지 않는다(기준 글자만 남고 개수는 진단에).
 */
export function aozoraRubyLockable(ruby) {
  return Array.from(ruby.base).some((char) => aozoraRubyClass(char) === 'kanji')
    && /^[\p{Script=Hiragana}\p{Script=Katakana}ー・]+$/u.test(ruby.reading);
}

/** 문단 블록 → 표식 텍스트. 잠글 루비는 OPEN 기준 CLOSE로 감싸고 순서대로 queue에 싣는다. */
function markedParagraph(block, queue, counts) {
  return block.children.map((child) => {
    if (child.type === 'text') return child.value;
    if (child.type === 'gaiji') return child.status === 'resolved' ? child.char : '〓';
    if (!aozoraRubyLockable(child)) {
      counts.annotationRuby += 1;
      return child.base;
    }
    queue.push({ base: child.base, reading: child.reading });
    return `${OPEN}${child.base}${CLOSE}`;
  }).join('').replace(EDGE_SPACE, '');
}

/**
 * 장 목표보다 긴 문단 → 문장 끝에서 묶은 조각들(둘째부터 SENTENCE_JOIN 머리). 짧은 문단은 그대로 한 줄.
 * 실물: 吾輩は猫である 한 문단 1만 1천 자 · 駈込み訴え 전체가 두 문단 — 문단 경계만으로는 장 상한 안에 들 수 없어
 * 분할기가 글자 수로 잘라 문장이 찢겼다. 문장 끝에서만 자르면 문장은 온전하고, 장 안의 조각은 원래 한 문단으로 다시 붙는다.
 */
function sentencePieces(paragraph, longChars, pieceChars) {
  if (paragraph.replace(/[\uE000\uE001]/gu, '').length <= longChars) return [paragraph];
  const sentences = [];
  let start = 0;
  for (const match of paragraph.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    // 「…た。」と言った — 인용 뒤 조사·쉼표가 이어지면 아직 한 문장이다.
    if (end < paragraph.length && !/^[\uE000\uE001]?(?:と|って|、|。)/u.test(paragraph.slice(end))) { sentences.push(paragraph.slice(start, end)); start = end; }
  }
  sentences.push(paragraph.slice(start));
  const pieces = [];
  for (const sentence of sentences) {
    if (pieces.length && pieces.at(-1).length + sentence.length <= pieceChars) pieces[pieces.length - 1] += sentence;
    else pieces.push(sentence);
  }
  // 조각 머리가 공백이면 분할기의 다듬기(trim)가 원문 글자를 지운다 — 그런 경계는 앞 조각에 붙여 둔다.
  return pieces.reduce((out, piece) => {
    if (out.length && /^[\s\u3000]/u.test(piece)) out[out.length - 1] += piece;
    else out.push(piece);
    return out;
  }, []).map((piece, index) => (index ? `${SENTENCE_JOIN}${piece}` : piece));
}

/** 구조 문서 → 분할 입력 텍스트(표식 포함)와 루비 queue. 연속 표제는 한 줄로 합친다(빈 장 방지). */
function projectDocument(document, { longChars = Infinity, pieceChars = Infinity } = {}) {
  const headingBlocks = document.blocks.filter((block) => block.type === 'heading');
  const useHeadings = headingBlocks.length >= 2;
  const queue = [];
  const counts = { annotationRuby: 0 };
  const lines = [];
  const paragraphs = [];
  const headingTexts = new Set();
  let headingRubyCount = 0;
  let pendingHeading = null;
  const flushHeading = () => {
    if (pendingHeading == null) return;
    headingTexts.add(pendingHeading);
    lines.push(`${HEADING_PREFIX}${pendingHeading}`);
    pendingHeading = null;
  };
  for (const block of document.blocks) {
    if (block.type === 'heading' && useHeadings) {
      // 표제 루비는 장 제목에만 남고 raw_text에 없다 — 잠금 대상이 아니라 개수만 진단에 남긴다.
      headingRubyCount += block.children.filter((child) => child.type === 'ruby').length;
      const text = aozoraBlockText(block).replace(EDGE_SPACE, '');
      pendingHeading = pendingHeading == null ? text : `${pendingHeading}\u3000${text}`;
      continue;
    }
    flushHeading();
    const paragraph = markedParagraph(block, queue, counts);
    if (!paragraph) continue;
    invariant(!useHeadings || !headingTest(paragraph), 'Aozora paragraph collides with the heading projection prefix');
    invariant(!paragraph.includes(SENTENCE_JOIN), 'Aozora paragraph contains the sentence-join marker');
    lines.push(...sentencePieces(paragraph, longChars, pieceChars));
    paragraphs.push(paragraph.replace(/[\uE000\uE001]/gu, ''));
  }
  flushHeading();
  return { text: lines.join('\n\n'), queue, paragraphs, useHeadings, headingTexts, headingRubyCount, annotationRubyCount: counts.annotationRuby };
}

/** 장 표식 텍스트 → 평문 + 장 로컬 루비 잠금. queue 위치는 장을 넘어 이어진다. */
function unmarkChapter(markedText, queue, cursor) {
  let rawText = '';
  const rubyLocks = [];
  const dropped = [];
  let open = null;
  for (const char of markedText) {
    if (char === OPEN) {
      invariant(open == null, 'Nested Aozora ruby markers');
      open = { start: rawText.length, ruby: queue[cursor.index] };
      cursor.index += 1;
    } else if (char === CLOSE) {
      if (open) {
        const base = rawText.slice(open.start);
        invariant(base === open.ruby.base, 'Aozora ruby base drifted during chapter split');
        rubyLocks.push({ start: open.start, end: rawText.length, base, reading: open.ruby.reading });
        open = null;
      }
      // 장 머리의 짝 잃은 CLOSE — 앞 장 끝에서 이미 dropped로 셌다.
    } else {
      rawText += char;
    }
  }
  if (open) dropped.push(open.ruby); // 장 경계가 루비 기준 한가운데를 가른 경우(문단 하나가 상한을 넘을 때만)
  return { rawText, rubyLocks, dropped };
}

/**
 * 見出し 없는 원작의 길이 분할 — 장 수를 round(전체/목표)로 정하고, 그 수 안에 드는 가장 작은 목표 크기를 찾는다.
 * splitTextIntoChapters는 목표를 넘기 전에 장을 닫아 꼬리가 짧게 남는다(실물 「鼻」 2837·2752·230자). 장 수를 먼저
 * 정하면 장 크기가 고르다(2,9xx·2,9xx). 분할 자체는 정본 splitTextIntoChapters가 그대로 한다(문단 경계만).
 */
function balancedLengthSplit(length, targetChars, maxChars, split, { partLimit = Infinity, keepBalanced = false } = {}) {
  const count = Math.max(1, Math.round(length / targetChars), Math.ceil(length / partLimit));
  const step = Math.max(1, Math.ceil(targetChars / 60));
  let first = null;
  let firstClean = null;
  for (let target = Math.ceil(length / count), tries = 0; target <= maxChars && tries < 40; target += step) {
    const parts = split(target);
    if (parts.length > count) continue;
    if (parts.some((part) => part.text.length > partLimit)) break; // 더 큰 목표는 더 큰 조각만 만든다 — 장 수를 늘린 첫 후보로
    first ??= parts;
    // 고른 크기 안에서는 장 머리가 앞 문단에 매달린 이음 문단(と答えた。· 、…)이 아닌 경계를 고른다(실물 「鼻」 2장 머리).
    const clean = parts.slice(1).every((part) => !continuesPrevious(part.text));
    // keepBalanced: 목표를 키울수록 앞 장이 커지고 꼬리가 준다 — 이음 문단을 피한 첫 후보가 고르지 않으면(실물 人間椅子
    // 3,2xx×4 · 2,113자) 더 찾아 고르면서 깨끗한 후보를 고르고, 없을 때만 그 첫 후보로 물러난다.
    // 見出し 장 안 나눔(坊っちゃん)에는 켜지 않는다 — 이미 게시됐을 수 있는 장 경계를 바꾸지 않는다(켜면 「六」 네 조각이 바뀐다).
    if (clean && (!keepBalanced || balancedParts(parts))) return parts;
    if (clean) firstClean ??= parts;
    tries += 1;
  }
  return firstClean ?? first ?? split(targetChars);
}

/** 첫 見出し 앞의 짧은 머리말(見出し가 아닌 첫 조각)은 따로 한 장으로 두지 않고 첫 見出し 장 머리에 붙인다 — 목차는 작가 見出し 그대로. */
function mergeShortPreface(sections, projection) {
  const [lead, next, ...rest] = sections;
  const leadTitle = String(lead?.title || '').replace(/[\uE000\uE001]/gu, '');
  if (!next || projection.headingTexts.has(leadTitle) || lead.text.length > AOZORA_PREFACE_MERGE_MAX_CHARS) return sections;
  return [{ ...next, text: `${lead.text}\n\n${next.text}` }, ...rest];
}

function balancedParts(parts) {
  const sizes = parts.map((part) => part.text.length);
  return Math.max(...sizes) < Math.min(...sizes) * BALANCED_RATIO;
}

/** 앞 문단에 이어지는 문단인가 — 인용 뒤 조사(と·って)·쉼표로 시작하면 앞 대사의 꼬리다. 표식(U+E000)은 건너뛴다. */
function continuesPrevious(text) {
  const head = String(text || '').replace(/^[\uE000-\uE002\s\u3000]+/u, '');
  return /^(?:と|って|、|。)/u.test(head);
}

// 장 이름(오너 확정 2026-10-14 「1과 2과」 개편) — 작가의 見出し(一·二…)는 그대로 쓰고, manabi가 분량으로 나눈 장은
// 작가의 장으로 오인되지 않게 「1/2」처럼 나눈 위치만 적는다(교재의 「과」·연재의 「편」을 쓰지 않는다). 한 장이면 「전문」
// (「전편」은 前篇 — 뒷부분이 따로 있는 것처럼 읽힌다, 에디터 검토).
export const LITERATURE_DIVISION = Object.freeze({ HEADING: 'heading', SPLIT: 'split', WHOLE: 'whole' });

function chapterTitle(part, order, total, projection) {
  const title = String(part.title || '').replace(/[\uE000\uE001]/gu, '');
  const base = title.replace(/ \(\d+\/\d+\)$/u, '');
  if (projection.useHeadings && projection.headingTexts.has(base)) return title;
  return total === 1 ? '전문' : `${order}/${total}`;
}

/** 자료 제목 — 見出し 장은 「작품 — 一」, 나눈 장은 「작품 (1/2)」, 한 장이면 작품명만. */
function chapterMaterialTitle(entry, title, division) {
  if (division === LITERATURE_DIVISION.WHOLE) return entry.title;
  return division === LITERATURE_DIVISION.HEADING ? `${entry.title} — ${title}` : `${entry.title} (${title})`;
}

function literatureMetadata(entry, document) {
  const { colophon } = document;
  return {
    schemaVersion: AOZORA_MATERIAL_VERSION,
    provider: 'aozora',
    workKey: aozoraWorkKey(entry),
    personId: entry.personId,
    workId: entry.workId,
    title: entry.title,
    author: entry.author,
    publishedYear: entry.publishedYear,
    authorDeathYear: entry.authorDeathYear,
    charset: entry.charset,
    cardUrl: entry.cardUrl,
    sourceFileUrl: entry.sourceFileUrl,
    sourceSha256: entry.sourceSha256,
    textSha256: entry.textSha256,
    attribution: { ...entry.attribution },
    rights: { ...entry.rights, reviewedJurisdictions: [...entry.rights.reviewedJurisdictions] },
    colophon: {
      sourceBook: [...colophon.sourceBook],
      parentBook: [...colophon.parentBook],
      inputter: colophon.inputter,
      proofreader: colophon.proofreader,
    },
    edits: [...AOZORA_EDIT_NOTES, ...(document.gaiji.some((item) => item.substituted) ? [AOZORA_SMALL_KANA_EDIT] : []),
      ...(colophon.proofreader ? [] : [AOZORA_UNPROOFREAD_EDIT])],
  };
}

/** 투영 텍스트 → 장 조각. */
function chapterParts(projection, targetChars, maxChars) {
  const split = (target) => splitTextIntoChapters(projection.text, { targetChars: target, maxChars, headingTest });
  // 見出し 장은 작가의 목차대로 두되, 한 장이 상한보다 길면 그 장만 見出し 없는 원작과 같은 고른 분할로 나눈다
  // (예전에는 6,000자 넘을 때만 앞에서부터 잘라 「一 (1/2)」 5,538자 · 「一 (2/2)」 2,001자처럼 꼬리가 짧았다 — 坊っちゃん 실측).
  return projection.useHeadings
    ? mergeShortPreface(splitTextIntoChapters(projection.text, { targetChars, maxChars: Number.MAX_SAFE_INTEGER, headingTest }), projection).flatMap((section) => {
      if (section.text.length <= AOZORA_HEADING_CHAPTER_MAX_CHARS) return [section];
      const pieces = balancedLengthSplit(section.text.length, targetChars, maxChars,
        (target) => splitTextIntoChapters(section.text, { targetChars: target, maxChars, headings: false }), { partLimit: AOZORA_HEADING_CHAPTER_MAX_CHARS });
      return pieces.length > 1 ? pieces.map((piece, index) => ({ ...piece, title: `${section.title} (${index + 1}/${pieces.length})` })) : [section];
    })
    : balancedLengthSplit(projection.text.length, targetChars, maxChars, split, { keepBalanced: true, partLimit: AOZORA_HEADING_CHAPTER_MAX_CHARS });
}

/**
 * 見出し 없는 긴 원작의 짧은 꼬리 장 — 마지막 장이 목표의 2/3 미만이면 끝 두 장을 합쳐 반씩 다시 나눈다(같은 문단·문장 조각 경계).
 * 실물 ドグラ・マグラ 146장: 고른 크기 탐색이 장 수가 많으면 꼬리를 못 맞춰 끝 장이 1,739자였다. 기존 작품은 꼬리가 이미 2/3 이상이라 그대로.
 */
function evenTail(parts, targetChars) {
  if (parts.length < 2 || parts.at(-1).text.length >= (targetChars * 2) / 3) return parts;
  const joined = `${parts.at(-2).text}\n\n${parts.at(-1).text}`;
  // 반 크기에서 시작해 두 조각이 될 때까지 목표를 조금씩 키운다(앞 조각이 반보다 조금 짧으면 셋으로 남는다).
  for (let target = Math.ceil(joined.length / 2); target < joined.length; target += 50) {
    const halves = splitTextIntoChapters(joined, { targetChars: target, maxChars: joined.length, headings: false });
    if (halves.length > 2) continue;
    const ok = halves.length === 2 && halves.every((half) => half.text.length >= (targetChars * 2) / 3 && half.text.length <= AOZORA_HEADING_CHAPTER_MAX_CHARS);
    return ok ? [...parts.slice(0, -2), ...halves] : parts;
  }
  return parts;
}

const partsSpread = (parts) => { const sizes = parts.map((part) => part.text.length); return Math.max(...sizes) / Math.min(...sizes); };
/** 고른 분할의 창(목표의 2/3 이상 · 1.4배 안) 밖인가 — 한 장이면 해당 없음. */
function unevenParts(parts, targetChars) {
  if (parts.length < 2) return false;
  return Math.min(...parts.map((part) => part.text.length)) < (targetChars * 2) / 3 || partsSpread(parts) >= 1.4;
}

/** 장 조각이 문단 한가운데서 시작하는가(문장 조각 표식으로 시작하는 장은 문장 끝에서 이어진 것이라 제외). */
function startsMidParagraph(text, projection) {
  if (text.startsWith(SENTENCE_JOIN)) return false;
  const head = text.replace(/[\uE000\uE001]/gu, '').split('\n\n')[0];
  return !projection.paragraphs.some((paragraph) => paragraph.startsWith(head));
}

/**
 * 승인된 카탈로그 항목 + 파싱 문서 → 책 초안 {schemaVersion, book, chapters, diagnostics}.
 * 공개 불가 항목·제목/저자 불일치·판권 누락·미해결 외자·파서 경고가 있으면 실패한다(fail-closed —
 * 사람이 원문을 확인하기 전에는 공개 책을 만들지 않는다).
 */
export function createAozoraMaterialDraft(entry, document, options = {}) {
  validateAozoraCatalogEntry(entry);
  validateAozoraDocument(document);
  invariant(aozoraCatalogEntryPublishable(entry), 'Aozora entry is not publishable');
  invariant(options && typeof options === 'object' && !Array.isArray(options), 'options must be an object');
  invariant(document.blocks.length > 0, 'Aozora document has no readable blocks');
  invariant(document.header.title === entry.title, 'Document title does not match catalog entry');
  invariant(document.header.author === entry.author, 'Document author does not match catalog entry');
  invariant(document.colophon.sourceBook.length > 0, 'Aozora colophon must name the source book (底本)');
  invariant(typeof document.colophon.inputter === 'string' && document.colophon.inputter,
    'Aozora colophon must name the inputter (入力)');
  // 교정자 없는 입력본은 기본 거부 — 오너가 그 작품 하나를 승인한 기록(entry.unproofreadApproval)이 있을 때만 받는다(夢十夜, 2026-10-15).
  invariant((typeof document.colophon.proofreader === 'string' && document.colophon.proofreader) || entry.unproofreadApproval,
    'Aozora colophon must name the proofreader (校正)');
  invariant(!entry.unproofreadApproval || !document.colophon.proofreader, 'unproofreadApproval is only for texts without a proofreader');
  const unresolved = document.gaiji.filter((item) => item.status !== 'resolved');
  invariant(unresolved.length === 0,
    `Aozora document has ${unresolved.length} unresolved gaiji (lines ${unresolved.map((item) => item.line).join(', ')})`);
  invariant(document.warnings.length === 0,
    `Aozora document has parser warnings: ${document.warnings.map((item) => `${item.code}@${item.line ?? '-'}`).join(', ')}`);

  const maxChars = options.maxChars ?? AOZORA_CHAPTER_MAX_CHARS;
  const targetChars = options.targetChars ?? AOZORA_CHAPTER_TARGET_CHARS;
  // 먼저 문단 경계로만 나눈다. 그래도 문단 한가운데서 시작하는 장이 생길 때만(장보다 긴 문단 — 猫·駈込み訴え) 긴 문단을
  // 문장 끝 조각으로 바꿔 다시 나눈다. 문단 경계로 다 들어가는 작품(기존 26편 전부)은 장 경계가 한 글자도 바뀌지 않는다.
  // 見出し 없는 원작은 문단이 커서 고르게 못 나눌 때(가장 짧은 장이 목표의 2/3 미만 · 1.4배 넘게 들쭉날쭉 — 陰翳礼讃
  // 1,972자 첫 장 · ドグラ・マグラ 1,739자 끝 장)도 문장 끝 조각으로 다시 나눠 더 고른 쪽을 쓴다.
  let projection = projectDocument(document);
  let parts = chapterParts(projection, targetChars, maxChars);
  const torn = parts.some((part) => startsMidParagraph(part.text, projection));
  if (torn || (!projection.useHeadings && unevenParts(parts, targetChars))) {
    const sentenceProjection = projectDocument(document, { longChars: Math.round((targetChars * 2) / 3), pieceChars: Math.round(targetChars / 4) });
    const sentenceParts = chapterParts(sentenceProjection, targetChars, maxChars);
    if (torn || partsSpread(sentenceParts) < partsSpread(parts)) {
      projection = sentenceProjection;
      parts = sentenceParts;
    }
  }
  if (!projection.useHeadings) parts = evenTail(parts, targetChars);
  invariant(parts.length > 0, 'Aozora document produced no chapters');

  const key = aozoraWorkKey(entry);
  const division = projection.useHeadings ? LITERATURE_DIVISION.HEADING
    : parts.length === 1 ? LITERATURE_DIVISION.WHOLE : LITERATURE_DIVISION.SPLIT;
  const literature = literatureMetadata(entry, document);
  const cursor = { index: 0 };
  const droppedRuby = [];
  const continued = [];
  const chapters = parts.map((part, index) => {
    const order = index + 1;
    // 장 안의 문장 조각은 원래 한 문단으로 다시 잇고, 장 머리의 조각 표식은 「문장 끝에서 이어진 장」으로 센다.
    continued.push(part.text.startsWith(SENTENCE_JOIN));
    const joined = part.text.replaceAll(`\n\n${SENTENCE_JOIN}`, '').replaceAll(SENTENCE_JOIN, '');
    const { rawText, rubyLocks, dropped } = unmarkChapter(joined, projection.queue, cursor);
    droppedRuby.push(...dropped);
    invariant(rawText.trim(), 'Aozora chapter cannot be empty');
    const title = chapterTitle(part, order, parts.length, projection);
    return {
      order,
      title,
      materialTitle: chapterMaterialTitle(entry, title, division),
      rawText,
      metadata: {
        language: 'Japanese',
        level: entry.level,
        book: { key, title: entry.title, author: entry.author, order, total: parts.length },
        literature: { ...literature, rubyLocks },
      },
    };
  });
  invariant(cursor.index === projection.queue.length, 'Aozora ruby markers were lost during chapter split');

  const mappedRubyCount = chapters.reduce((sum, chapter) => sum + chapter.metadata.literature.rubyLocks.length, 0);
  return freezeDeep({
    schemaVersion: AOZORA_MATERIAL_VERSION,
    book: { key, title: entry.title, author: entry.author, level: entry.level, total: chapters.length, division },
    chapters,
    diagnostics: {
      sourceBlockCount: document.blocks.length,
      headingCount: document.blocks.filter((block) => block.type === 'heading').length,
      splitByHeadings: projection.useHeadings,
      rubyCount: projection.queue.length,
      mappedRubyCount,
      droppedRubyCount: droppedRuby.length,
      // 문단 한가운데서 시작하는 장 수 — 한 문단이 장 상한보다 길어 글자 수로 잘린 경우(문장이 찢긴다). 빌드는 0만 통과.
      // 문장 끝에서 이어진 장(sentenceSplitCount)은 문장이 온전하므로 여기서 세지 않는다.
      midParagraphSplitCount: chapters.filter((chapter, index) => {
        if (continued[index]) return false;
        const head = chapter.rawText.split('\n\n')[0];
        return !projection.paragraphs.some((paragraph) => paragraph.startsWith(head));
      }).length,
      // 기존 작품(문장 끝 분할 없음)의 chapters.json을 바꾸지 않게, 있을 때만 적는다.
      ...(continued.some(Boolean) ? { sentenceSplitCount: continued.filter(Boolean).length } : {}),
      headingRubyCount: projection.headingRubyCount,
      annotationRubyCount: projection.annotationRubyCount,
      noteCount: document.notes.length,
      resolvedGaijiCount: document.gaiji.length,
      chapterChars: chapters.map((chapter) => chapter.rawText.length),
    },
  });
}
