// Wikisource 정본 책 빌드(LIT-SRC-WS-1) — src/content/literature/wikisource/<key>/{entry.json, source/*.html} → chapters.json.
// Standard Ebooks 빌드와 같은 원칙: 결정적(같은 입력 → 같은 바이트), --check는 쓰지 않고 차이만 실패로 낸다, 한 편이라도 실패하면
// 목록·대조표를 다시 쓰지 않는다. 쪽 조각 해시가 entry.files와 다르면 그 작품은 실패(원문이 바뀌었다).
// 루트 산출물: index.generated.js(관리자 게시 API — 장 원문 포함, 서버 전용) · manifest.generated.json(뷰어 대조 — 원문 없음).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LITERATURE_BOUNDARY_FILE, withBoundaryMerges } from './literature-boundaries.mjs';

export const WIKISOURCE_ROOT = 'src/content/literature/wikisource';
export const WIKISOURCE_FILES = Object.freeze({ entry: 'entry.json', source: 'source', chapters: 'chapters.json' });
export const WIKISOURCE_OUTPUTS = Object.freeze({ index: 'index.generated.js', manifest: 'manifest.generated.json' });

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function serializeWikisourceIndex(keys) {
  const lines = [
    '// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).',
    '// Wikisource 정본 책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.',
    ...keys.map((key, index) => `import book${index} from './${key}/${WIKISOURCE_FILES.chapters}';`),
    '',
    `export const WIKISOURCE_BOOKS = Object.freeze([${keys.map((_, index) => `book${index}`).join(', ')}]);`,
  ];
  return `${lines.join('\n')}\n`;
}


/** 뷰어 대조표 — 작품 key → 크레딧(책 단위 literature) + 표기 + 분량 + 장마다 제목·원문 SHA-256(중국어는 번체 SHA-256도). */
export function createWikisourceManifest(entries) {
  const works = {};
  for (const { draft, display } of entries) {
    const { sourcePage: _page, revid: _revid, nameMarks: _names, ...literature } = draft.chapters[0].metadata.literature;
    works[draft.book.key] = {
      title: draft.book.title,
      author: draft.book.author,
      level: draft.book.level,
      total: draft.book.total,
      language: draft.chapters[0].metadata.language,
      size: draft.diagnostics.size,
      unit: draft.diagnostics.unit,
      display,
      literature,
      chapters: draft.chapters.map((chapter) => ({
        order: chapter.order,
        title: chapter.title,
        sha256: sha256(chapter.rawText),
        ...(chapter.metadata.scriptVariants ? { variants: Object.fromEntries(Object.entries(chapter.metadata.scriptVariants).map(([variant, text]) => [variant, sha256(text)])) } : {}),
      })),
    };
  }
  return { schemaVersion: 1, works };
}

/**
 * @param {{root?: string, check?: boolean, validateCover?: (display) => object}} options — validateCover 기본은 초판 장정 표기 검사(wikisourceCover)
 * @returns {Promise<{works: Array<{key, chapters, status}>, errors: string[]}>}
 */
export async function buildWikisource({ root = WIKISOURCE_ROOT, check = false, validateCover = null } = {}) {
  const { createWikisourceDraft } = await import('../../src/lib/wikisource.js');
  const validate = validateCover ?? (await import('../../src/lib/wikisourceCover.js')).validateWikisourceDisplay;
  const works = [];
  const errors = [];
  if (!existsSync(root)) return { works, errors };
  const dirs = readdirSync(root).filter((name) => statSync(path.join(root, name)).isDirectory()).sort();
  const built = [];
  for (const dir of dirs) {
    const base = path.join(root, dir);
    try {
      const entry = JSON.parse(readFileSync(path.join(base, WIKISOURCE_FILES.entry), 'utf8'));
      if (dir !== entry.key) throw new Error(`폴더 이름은 작품 키 ${entry.key}여야 한다`);
      const listed = (entry.files || []).flatMap((file) => file.variants || []);
      const files = listed.map((item) => {
        const bytes = readFileSync(path.join(base, WIKISOURCE_FILES.source, item.path));
        if (sha256(bytes) !== item.sha256) throw new Error(`${item.path}의 SHA-256이 entry.files와 다르다(원문이 바뀌었다)`);
        return { path: item.path, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
      });
      const extra = readdirSync(path.join(base, WIKISOURCE_FILES.source)).filter((name) => !listed.some((item) => item.path === name));
      if (extra.length) throw new Error(`source/에 entry.files에 없는 파일이 있다: ${extra.join(', ')}`);
      if (entry.rights?.status !== 'approved') throw new Error('권리 기록이 approved가 아니다(not publishable)');
      // 고유명사 밑줄 → 「한 단어로 묶기」 기록(boundaries.json — scripts/literature/boundaries.mjs가 분석기와 같은 토크나이저로 만든다)
      const boundaryPath = path.join(base, LITERATURE_BOUNDARY_FILE);
      const draft = withBoundaryMerges(createWikisourceDraft(entry, files), existsSync(boundaryPath) ? JSON.parse(readFileSync(boundaryPath, 'utf8')) : null, 'wikisource');
      // 표지 대기 — 원문·권리는 검사를 마쳤지만 표지 시안을 오너가 아직 고르지 않은 작품(UI 목업 우선). 목록·대조표에 싣지 않는다.
      if (entry.display && typeof entry.display === 'object' && entry.display.binding === undefined) {
        if (existsSync(path.join(base, WIKISOURCE_FILES.chapters))) throw new Error(`표지 대기 작품에 ${WIKISOURCE_FILES.chapters}가 있다 — 지운다`);
        works.push({ key: entry.key, chapters: draft.chapters.length, status: 'cover-pending' });
        continue;
      }
      const display = validate(entry.display); // 표지 표기(초판 장정 — 없거나 틀리면 그 작품은 쓰지 않는다)
      const output = serialize(draft);
      const target = path.join(base, WIKISOURCE_FILES.chapters);
      const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
      if (check) {
        if (current !== output) throw new Error(`${WIKISOURCE_FILES.chapters}가 원문과 다르다 — node scripts/build-literature.mjs로 다시 만든다`);
        works.push({ key: entry.key, chapters: draft.chapters.length, status: 'checked' });
      } else if (current === output) {
        works.push({ key: entry.key, chapters: draft.chapters.length, status: 'unchanged' });
      } else {
        writeFileSync(target, output);
        works.push({ key: entry.key, chapters: draft.chapters.length, status: 'written' });
      }
      built.push({ draft, display });
    } catch (error) {
      errors.push(`${dir}: ${error.message}`);
    }
  }
  if (errors.length) return { works, errors };
  const outputs = [
    [WIKISOURCE_OUTPUTS.index, serializeWikisourceIndex(built.map(({ draft }) => draft.book.key))],
    [WIKISOURCE_OUTPUTS.manifest, serialize(createWikisourceManifest(built))],
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
