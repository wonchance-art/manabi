// Standard Ebooks 정본 책 빌드(LIT-SRC-EN-1) — src/content/literature/standardebooks/<key>/{entry.json, source/*.xhtml} → chapters.json.
// 아오조라 빌드(literature-build.mjs)와 같은 원칙: 결정적(같은 입력 → 같은 바이트), --check는 쓰지 않고 차이만 실패로 낸다,
// 한 편이라도 실패하면 목록·대조표를 다시 쓰지 않는다. 원문 파일 해시가 entry.files와 다르면 그 작품은 실패(원문이 바뀌었다).
// 루트 산출물: index.generated.js(관리자 게시 API — 장 원문 포함, 서버 전용) · manifest.generated.json(뷰어 대조 — 원문 없음).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const STANDARD_EBOOKS_ROOT = 'src/content/literature/standardebooks';
export const STANDARD_EBOOKS_FILES = Object.freeze({ entry: 'entry.json', source: 'source', chapters: 'chapters.json' });
export const STANDARD_EBOOKS_OUTPUTS = Object.freeze({ index: 'index.generated.js', manifest: 'manifest.generated.json' });

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function serializeStandardEbooksIndex(keys) {
  const lines = [
    '// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).',
    '// Standard Ebooks 정본 책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.',
    ...keys.map((key, index) => `import book${index} from './${key}/${STANDARD_EBOOKS_FILES.chapters}';`),
    '',
    `export const STANDARD_EBOOKS_BOOKS = Object.freeze([${keys.map((_, index) => `book${index}`).join(', ')}]);`,
  ];
  return `${lines.join('\n')}\n`;
}

/** 뷰어 대조표 — 작품 key → 크레딧(책 단위 literature) + 표기(display — 표지·한국어 제목) + 단어 수 + 장마다 제목·원문 SHA-256. */
export function createStandardEbooksManifest(entries) {
  const works = {};
  for (const { draft, display, words } of entries) {
    const { sourceFile: _file, ...literature } = draft.chapters[0].metadata.literature;
    works[draft.book.key] = {
      title: draft.book.title,
      author: draft.book.author,
      level: draft.book.level,
      total: draft.book.total,
      words,
      display,
      literature,
      chapters: draft.chapters.map((chapter) => ({ order: chapter.order, title: chapter.title, sha256: sha256(chapter.rawText) })),
    };
  }
  return { schemaVersion: 1, works };
}

/**
 * @param {{root?: string, check?: boolean}} options
 * @returns {Promise<{works: Array<{key, chapters, status}>, errors: string[]}>}
 */
export async function buildStandardEbooks({ root = STANDARD_EBOOKS_ROOT, check = false } = {}) {
  const { createStandardEbooksDraft, standardEbooksBookKey, wordCount } = await import('../../src/lib/standardEbooks.js');
  const { validateVictorianDisplay } = await import('../../src/lib/victorianCover.js');
  const works = [];
  const errors = [];
  if (!existsSync(root)) return { works, errors };
  const dirs = readdirSync(root).filter((name) => statSync(path.join(root, name)).isDirectory()).sort();
  const built = [];
  for (const dir of dirs) {
    const base = path.join(root, dir);
    try {
      const entry = JSON.parse(readFileSync(path.join(base, STANDARD_EBOOKS_FILES.entry), 'utf8'));
      const key = standardEbooksBookKey(entry.repo);
      if (dir !== key) throw new Error(`폴더 이름은 작품 키 ${key}여야 한다`);
      const files = (entry.files || []).map((file) => {
        const bytes = readFileSync(path.join(base, STANDARD_EBOOKS_FILES.source, file.path));
        if (sha256(bytes) !== file.sha256) throw new Error(`${file.path}의 SHA-256이 entry.files와 다르다(원문이 바뀌었다)`);
        return { path: file.path, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
      });
      const extra = readdirSync(path.join(base, STANDARD_EBOOKS_FILES.source)).filter((name) => !files.some((file) => file.path === name));
      if (extra.length) throw new Error(`source/에 entry.files에 없는 파일이 있다: ${extra.join(', ')}`);
      if (entry.rights?.status !== 'approved') throw new Error('권리 기록이 approved가 아니다(not publishable)');
      const draft = createStandardEbooksDraft(entry, files);
      const display = validateVictorianDisplay(entry.display); // 표지 표기(빅토리아 천 장정 — 없거나 틀리면 그 작품은 쓰지 않는다)
      const output = serialize(draft);
      const target = path.join(base, STANDARD_EBOOKS_FILES.chapters);
      const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
      if (check) {
        if (current !== output) throw new Error(`${STANDARD_EBOOKS_FILES.chapters}가 원문과 다르다 — node scripts/build-literature.mjs로 다시 만든다`);
        works.push({ key, chapters: draft.chapters.length, status: 'checked' });
      } else if (current === output) {
        works.push({ key, chapters: draft.chapters.length, status: 'unchanged' });
      } else {
        writeFileSync(target, output);
        works.push({ key, chapters: draft.chapters.length, status: 'written' });
      }
      built.push({ draft, display, words: draft.chapters.reduce((sum, chapter) => sum + wordCount(chapter.rawText), 0) });
    } catch (error) {
      errors.push(`${dir}: ${error.message}`);
    }
  }
  if (errors.length) return { works, errors };
  const outputs = [
    [STANDARD_EBOOKS_OUTPUTS.index, serializeStandardEbooksIndex(built.map(({ draft }) => draft.book.key))],
    [STANDARD_EBOOKS_OUTPUTS.manifest, serialize(createStandardEbooksManifest(built))],
  ];
  for (const [file, output] of outputs) {
    const target = path.join(root, file);
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (current === output) continue;
    if (check) errors.push(`${file}가 작품 폴더와 다르다 — node scripts/build-literature.mjs로 다시 만든다`);
    else writeFileSync(target, output);
  }
  return { works, errors };
}
