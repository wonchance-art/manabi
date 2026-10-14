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
/** 우리가 바꾼 점(취급 규준 「작업 이력」) — 뷰어 출처 줄이 이 코드로 문구를 고른다. */
export const AOZORA_EDIT_NOTES = Object.freeze(['ruby-reading-aid', 'chapter-split-by-manabi']);

const OPEN = '\uE000';
const CLOSE = '\uE001';
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

/** 구조 문서 → 분할 입력 텍스트(표식 포함)와 루비 queue. 연속 표제는 한 줄로 합친다(빈 장 방지). */
function projectDocument(document) {
  const headingBlocks = document.blocks.filter((block) => block.type === 'heading');
  const useHeadings = headingBlocks.length >= 2;
  const queue = [];
  const counts = { annotationRuby: 0 };
  const lines = [];
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
    lines.push(paragraph);
  }
  flushHeading();
  const paragraphs = lines.filter((line) => !useHeadings || !headingTest(line)).map((line) => line.replace(/[\uE000\uE001]/gu, ''));
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
function balancedLengthSplit(length, targetChars, maxChars, split) {
  const count = Math.max(1, Math.round(length / targetChars));
  const step = Math.max(1, Math.ceil(targetChars / 60));
  for (let target = Math.ceil(length / count); target <= maxChars; target += step) {
    const parts = split(target);
    if (parts.length <= count) return parts;
  }
  return split(targetChars);
}

function chapterTitle(part, order, projection) {
  const title = String(part.title || '').replace(/[\uE000\uE001]/gu, '');
  const base = title.replace(/ \(\d+\/\d+\)$/u, '');
  return projection.useHeadings && projection.headingTexts.has(base) ? title : `${order}편`;
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
    edits: [...AOZORA_EDIT_NOTES],
  };
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
  invariant(typeof document.colophon.proofreader === 'string' && document.colophon.proofreader,
    'Aozora colophon must name the proofreader (校正)');
  const unresolved = document.gaiji.filter((item) => item.status !== 'resolved');
  invariant(unresolved.length === 0,
    `Aozora document has ${unresolved.length} unresolved gaiji (lines ${unresolved.map((item) => item.line).join(', ')})`);
  invariant(document.warnings.length === 0,
    `Aozora document has parser warnings: ${document.warnings.map((item) => `${item.code}@${item.line ?? '-'}`).join(', ')}`);

  const projection = projectDocument(document);
  const maxChars = options.maxChars ?? AOZORA_CHAPTER_MAX_CHARS;
  const targetChars = options.targetChars ?? AOZORA_CHAPTER_TARGET_CHARS;
  const split = (target) => splitTextIntoChapters(projection.text, { targetChars: target, maxChars, headingTest });
  const parts = projection.useHeadings ? split(targetChars) : balancedLengthSplit(projection.text.length, targetChars, maxChars, split);
  invariant(parts.length > 0, 'Aozora document produced no chapters');

  const key = aozoraWorkKey(entry);
  const literature = literatureMetadata(entry, document);
  const cursor = { index: 0 };
  const droppedRuby = [];
  const chapters = parts.map((part, index) => {
    const order = index + 1;
    const { rawText, rubyLocks, dropped } = unmarkChapter(part.text, projection.queue, cursor);
    droppedRuby.push(...dropped);
    invariant(rawText.trim(), 'Aozora chapter cannot be empty');
    const title = chapterTitle(part, order, projection);
    return {
      order,
      title,
      materialTitle: `${entry.title} — ${title}`,
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
    book: { key, title: entry.title, author: entry.author, level: entry.level, total: chapters.length },
    chapters,
    diagnostics: {
      sourceBlockCount: document.blocks.length,
      headingCount: document.blocks.filter((block) => block.type === 'heading').length,
      splitByHeadings: projection.useHeadings,
      rubyCount: projection.queue.length,
      mappedRubyCount,
      droppedRubyCount: droppedRuby.length,
      // 문단 한가운데서 시작하는 장 수 — 한 문단이 장 상한보다 길어 글자 수로 잘린 경우(문장이 찢긴다). 빌드는 0만 통과.
      midParagraphSplitCount: chapters.filter((chapter) => {
        const head = chapter.rawText.split('\n\n')[0];
        return !projection.paragraphs.some((paragraph) => paragraph.startsWith(head));
      }).length,
      headingRubyCount: projection.headingRubyCount,
      annotationRubyCount: projection.annotationRubyCount,
      noteCount: document.notes.length,
      resolvedGaijiCount: document.gaiji.length,
      chapterChars: chapters.map((chapter) => chapter.rawText.length),
    },
  });
}
