import { aozoraCatalogEntryPublishable, aozoraWorkKey, validateAozoraCatalogEntry } from './aozoraCatalog.js';
import { validateAozoraDocument } from './aozoraParser.js';
import { splitTextIntoChapters } from './bookSplit.js';

export const AOZORA_MATERIAL_VERSION = 1;

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function inlineText(children) {
  return children.map((child) => {
    if (child.type === 'text') return child.value;
    if (child.type === 'ruby') return child.base;
    if (child.type === 'gaiji') return `〓［${child.description}］`;
    return '';
  }).join('');
}

/** 구조화 원문을 기존 bookSplit 입력과 전역 루비 범위로 투영한다. */
function projectDocument(document) {
  const lines = [];
  const rubyLocks = [];
  let offset = 0;

  for (const block of document.blocks) {
    const blockText = inlineText(block.children);
    for (const child of block.children) {
      if (child.type === 'ruby') {
        const localOffset = inlineText(block.children.slice(0, block.children.indexOf(child))).length;
        rubyLocks.push({
          start: offset + localOffset,
          end: offset + localOffset + child.base.length,
          base: child.base,
          reading: child.reading,
          source: 'aozora',
          locked: true,
        });
      }
    }
    lines.push(blockText);
    offset += blockText.length + 2;
  }

  return { text: lines.join('\n\n'), rubyLocks };
}

function chapterRubyLocks(chapterText, chapterStart, globalLocks) {
  const chapterEnd = chapterStart + chapterText.length;
  return globalLocks
    .filter((lock) => lock.start >= chapterStart && lock.end <= chapterEnd)
    .map((lock) => ({ ...lock, start: lock.start - chapterStart, end: lock.end - chapterStart }));
}

/**
 * 승인된 카탈로그 항목 + 파싱 문서를 기존 reading_materials 반입 직전의 책 초안으로 만든다.
 * 저장·분석·네트워크 호출은 하지 않는다.
 */
export function createAozoraMaterialDraft(entry, document, options = {}) {
  validateAozoraCatalogEntry(entry);
  validateAozoraDocument(document);
  invariant(aozoraCatalogEntryPublishable(entry), 'Aozora entry is not publishable');
  invariant(options && typeof options === 'object' && !Array.isArray(options), 'options must be an object');
  invariant(document.blocks.length > 0, 'Aozora document has no readable blocks');
  if (document.title != null) invariant(document.title === entry.title, 'Document title does not match catalog entry');
  if (document.author != null) invariant(document.author === entry.author, 'Document author does not match catalog entry');

  const projection = projectDocument(document);
  const splitOptions = options.split ?? {};
  const parts = splitTextIntoChapters(projection.text, splitOptions);
  invariant(parts.length > 0, 'Aozora document produced no chapters');

  const key = aozoraWorkKey(entry);
  let searchFrom = 0;
  const chapters = parts.map((part, index) => {
    const start = projection.text.indexOf(part.text, searchFrom);
    invariant(start >= 0, 'Chapter text cannot be mapped back to the Aozora source');
    searchFrom = start + part.text.length;
    return {
      order: index + 1,
      title: part.title,
      rawText: part.text,
      rubyLocks: chapterRubyLocks(part.text, start, projection.rubyLocks),
      metadata: {
        book: { key, title: entry.title, author: entry.author, order: index + 1, total: parts.length },
        literature: {
          schemaVersion: AOZORA_MATERIAL_VERSION,
          provider: 'aozora',
          providerPersonId: entry.personId,
          providerWorkId: entry.workId,
          cardUrl: entry.cardUrl,
          sourceFileUrl: entry.sourceFileUrl,
          sourceFormat: entry.sourceFormat,
          attribution: { ...entry.attribution },
          rights: { ...entry.rights },
        },
      },
    };
  });

  const included = chapters.reduce((sum, chapter) => sum + chapter.rawText.length, 0);
  invariant(included > 0, 'Aozora draft cannot be empty');
  return freezeDeep({
    schemaVersion: AOZORA_MATERIAL_VERSION,
    book: { key, title: entry.title, author: entry.author, total: chapters.length },
    chapters,
    diagnostics: {
      sourceBlockCount: document.blocks.length,
      rubyCount: projection.rubyLocks.length,
      mappedRubyCount: chapters.reduce((sum, chapter) => sum + chapter.rubyLocks.length, 0),
      unresolvedGaijiCount: document.gaiji.filter((item) => item.status === 'unresolved').length,
      warnings: document.warnings.map((warning) => ({ ...warning })),
    },
  });
}
