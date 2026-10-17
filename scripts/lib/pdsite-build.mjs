// 퍼블릭 도메인 전자책 사이트 정본 책 빌드(LIT-SRC-PD-1) — src/content/literature/pdsite/<key>/{entry.json, source/<파일>} → chapters.json.
// 위키문헌 빌드와 같은 원칙: 결정적, --check는 쓰지 않고 차이만 실패, 한 편이라도 실패하면 목록·대조표를 다시 쓰지 않는다.
// 사이트 HTML 해시가 entry.file과 다르면 그 작품은 실패. 표지 표기가 아직 없으면(binding 없음) 「표지 대기」 — 목록·대조표에 싣지 않는다.
import { createDisplayManifest } from './literature-display-build.mjs';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const PDSITE_ROOT = 'src/content/literature/pdsite';
export const PDSITE_FILES = Object.freeze({ entry: 'entry.json', source: 'source', chapters: 'chapters.json' });
export const PDSITE_OUTPUTS = Object.freeze({ index: 'index.generated.js', manifest: 'manifest.generated.json', display: 'manifest.display.generated.json' });

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function serializePdSiteIndex(keys) {
  const lines = [
    '// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).',
    '// 퍼블릭 도메인 전자책 사이트 정본 책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.',
    ...keys.map((key, index) => `import book${index} from './${key}/${PDSITE_FILES.chapters}';`),
    '',
    `export const PDSITE_BOOKS = Object.freeze([${keys.map((_, index) => `book${index}`).join(', ')}]);`,
  ];
  return `${lines.join('\n')}\n`;
}

/** 뷰어 대조표 — 작품 key → 크레딧(책 단위 literature) + 표기 + 분량 + 장마다 제목·원문 SHA-256. */
export function createPdSiteManifest(entries) {
  const works = {};
  for (const { draft, display } of entries) {
    works[draft.book.key] = {
      title: draft.book.title,
      author: draft.book.author,
      level: draft.book.level,
      total: draft.book.total,
      language: draft.chapters[0].metadata.language,
      size: draft.diagnostics.size,
      unit: draft.diagnostics.unit,
      display,
      literature: draft.chapters[0].metadata.literature,
      chapters: draft.chapters.map((chapter) => ({ order: chapter.order, title: chapter.title, sha256: sha256(chapter.rawText) })),
    };
  }
  return { schemaVersion: 1, works };
}

/**
 * @param {{root?: string, check?: boolean}} options
 * @returns {Promise<{works: Array<{key, chapters, status}>, errors: string[]}>}
 */
export async function buildPdSite({ root = PDSITE_ROOT, check = false } = {}) {
  const { createPdSiteDraft } = await import('../../src/lib/pdSite.js');
  const { validateFirstEditionDisplay } = await import('../../src/lib/firstEditionCover.js');
  const works = [];
  const errors = [];
  if (!existsSync(root)) return { works, errors };
  const dirs = readdirSync(root).filter((name) => statSync(path.join(root, name)).isDirectory()).sort();
  const built = [];
  for (const dir of dirs) {
    const base = path.join(root, dir);
    try {
      const entry = JSON.parse(readFileSync(path.join(base, PDSITE_FILES.entry), 'utf8'));
      if (dir !== entry.key) throw new Error(`폴더 이름은 작품 키 ${entry.key}여야 한다`);
      const bytes = readFileSync(path.join(base, PDSITE_FILES.source, entry.file?.path ?? ''));
      if (sha256(bytes) !== entry.file.sha256) throw new Error(`${entry.file.path}의 SHA-256이 entry.file과 다르다(원문이 바뀌었다)`);
      const extra = readdirSync(path.join(base, PDSITE_FILES.source)).filter((name) => name !== entry.file.path);
      if (extra.length) throw new Error(`source/에 entry.file 밖의 파일이 있다: ${extra.join(', ')}`);
      if (entry.rights?.status !== 'approved') throw new Error('권리 기록이 approved가 아니다(not publishable)');
      const draft = createPdSiteDraft(entry, new TextDecoder(entry.file.encoding, { fatal: true }).decode(bytes));
      if (entry.display && typeof entry.display === 'object' && entry.display.binding === undefined) {
        if (existsSync(path.join(base, PDSITE_FILES.chapters))) throw new Error(`표지 대기 작품에 ${PDSITE_FILES.chapters}가 있다 — 지운다`);
        works.push({ key: entry.key, chapters: draft.chapters.length, status: 'cover-pending' });
        continue;
      }
      const display = validateFirstEditionDisplay(entry.display); // 표지 표기(초판 장정 — 없거나 틀리면 그 작품은 쓰지 않는다)
      const output = serialize(draft);
      const target = path.join(base, PDSITE_FILES.chapters);
      const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
      if (check) {
        if (current !== output) throw new Error(`${PDSITE_FILES.chapters}가 원문과 다르다 — node scripts/build-literature.mjs로 다시 만든다`);
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
    [PDSITE_OUTPUTS.index, serializePdSiteIndex(built.map(({ draft }) => draft.book.key))],
    [PDSITE_OUTPUTS.manifest, serialize(createPdSiteManifest(built))],
    [PDSITE_OUTPUTS.display, serialize(createDisplayManifest(createPdSiteManifest(built)))], // 서재 카드 표지 · 제목용(LIT-DISPLAY-001 — 해시 · 크레딧 없음)
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
