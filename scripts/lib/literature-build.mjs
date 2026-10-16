// 정본 문학책 빌드(설계 §3.1) — src/content/literature/aozora/<workKey>/{source.txt, entry.json} → chapters.json.
// 결정적이다: 같은 입력이면 같은 바이트(시각·환경 값 없음). --check는 쓰지 않고 차이만 실패로 낸다(world 자산 --check 선례).
// 제품 모듈은 동적 import한다 — CLI(scripts/build-literature.mjs)는 번들러식 import 훅을 먼저 등록하고, vitest는 그대로 푼다.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LITERATURE_BOUNDARY_FILE, withBoundaryMerges } from './literature-boundaries.mjs';

export const LITERATURE_ROOT = 'src/content/literature/aozora';
export const LITERATURE_FILES = Object.freeze({ source: 'source.txt', entry: 'entry.json', chapters: 'chapters.json', review: 'review.json' });
/**
 * 루트에 같이 만드는 산출물(AOZORA-P0-2) — 작품 폴더 목록에서 결정적으로 나온다. 손으로 고치지 않는다.
 *   index  관리자 게시 API가 정적 import하는 책 목록(장 원문 포함 — 서버 전용)
 *   manifest 뷰어가 쓰는 정본 대조표(장 원문 SHA-256 + 출처 크레딧). 원문은 싣지 않는다.
 */
export const LITERATURE_OUTPUTS = Object.freeze({ index: 'index.generated.js', manifest: 'manifest.generated.json' });

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/**
 * 검수 힌트(review.json, 선택 — AOZORA-P0-4)를 장마다 metadata.literature.reviewHints로 싣는다. 없으면 초안 그대로(키도 없음).
 * 힌트가 원문에 없거나 겹치면 resolveReviewHints가 throw — 그 작품은 빌드 실패.
 */
function withReviewHints(draft, review, resolveReviewHints) {
  if (!review) return draft;
  const resolved = resolveReviewHints(review, draft.chapters.map((chapter) => chapter.rawText));
  return {
    ...draft,
    chapters: draft.chapters.map((chapter, index) => ({
      ...chapter,
      metadata: { ...chapter.metadata, literature: { ...chapter.metadata.literature, reviewHints: resolved[index] } },
    })),
    diagnostics: { ...draft.diagnostics, reviewHintCount: resolved.reduce((sum, hints) => sum + hints.length, 0) },
  };
}

/** 책 목록 모듈 — 작품 폴더의 chapters.json을 정적 import한다(Next·vitest 둘 다 JSON import를 푼다). */
export function serializeIndex(keys) {
  const lines = [
    '// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).',
    '// 정본 문학책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.',
    ...keys.map((key, index) => `import book${index} from './${key}/${LITERATURE_FILES.chapters}';`),
    '',
    `export const LITERATURE_BOOKS = Object.freeze([${keys.map((_, index) => `book${index}`).join(', ')}]);`,
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * 뷰어 정본 대조표 — 작품 키 → 크레딧(rubyLocks 제외) + 표지 표기(display·division) + 장마다 이름·첫 문장·원문 SHA-256.
 * 뷰어는 자료 metadata가 아니라 **이 표**로 출처 줄을 그리고, 자료 raw_text의 해시가 표와 같을 때만 그린다
 * (자료 소유자가 metadata.literature를 꾸며 넣어도 가짜 크레딧이 보이지 않는다).
 */
export function createManifest(drafts) {
  const works = {};
  for (const draft of drafts) {
    const { rubyLocks: _locks, reviewHints: _hints, ...literature } = draft.chapters[0].metadata.literature;
    works[draft.book.key] = {
      title: draft.book.title,
      author: draft.book.author,
      level: draft.book.level,
      total: draft.book.total,
      division: draft.book.division,
      chars: draft.chapters.reduce((sum, chapter) => sum + chapter.rawText.length, 0), // 분량(카드 메타 — 책 고를 때 먼저 보는 정보)
      display: draft.display, // 표지·한국어 제목(entry.json display — literatureDisplay)
      literature,
      chapters: draft.chapters.map((chapter, index) => ({ order: chapter.order, title: chapter.title, incipit: draft.incipits[index],
        sha256: sha256(Buffer.from(chapter.rawText, 'utf8')) })),
    };
  }
  return { schemaVersion: 1, works };
}

/** chapters.json 직렬화 정본 — 2칸 들여쓰기 + 끝 개행. */
export function serializeChapters(draft) {
  return `${JSON.stringify(draft, null, 2)}\n`;
}

/**
 * @param {{root?: string, check?: boolean}} options root는 작품 폴더들의 부모(기본 리포의 LITERATURE_ROOT).
 * @returns {Promise<{works: Array<{key, chapters, status: 'written'|'unchanged'|'checked'}>, errors: string[]}>}
 */
export async function buildLiterature({ root = LITERATURE_ROOT, check = false } = {}) {
  const [{ createAozoraCatalog, aozoraWorkKey }, { parseAozoraText }, { createAozoraMaterialDraft }, { resolveReviewHints }, { validateLiteratureDisplay, literatureIncipit }] = await Promise.all([
    import('../../src/lib/aozoraCatalog.js'),
    import('../../src/lib/aozoraParser.js'),
    import('../../src/lib/aozoraMaterial.js'),
    import('../../src/lib/literatureReviewHints.js'),
    import('../../src/lib/literatureDisplay.js'),
  ]);
  const errors = [];
  const works = [];
  if (!existsSync(root)) return { works, errors: [`${root}: 폴더가 없다`] };

  const dirs = readdirSync(root).filter((name) => statSync(path.join(root, name)).isDirectory()).sort();
  const loaded = [];
  for (const dir of dirs) {
    const base = path.join(root, dir);
    const has = (file) => existsSync(path.join(base, file));
    if (!has(LITERATURE_FILES.source) || !has(LITERATURE_FILES.entry)) {
      errors.push(`${dir}: ${LITERATURE_FILES.source}와 ${LITERATURE_FILES.entry}가 모두 있어야 한다`);
      continue;
    }
    try {
      const entry = JSON.parse(readFileSync(path.join(base, LITERATURE_FILES.entry), 'utf8'));
      const sourceBytes = readFileSync(path.join(base, LITERATURE_FILES.source));
      const key = aozoraWorkKey(entry);
      if (dir !== key) throw new Error(`폴더 이름은 작품 키 ${key}여야 한다`);
      if (sha256(sourceBytes) !== entry.textSha256) throw new Error(`${LITERATURE_FILES.source}의 SHA-256이 entry.textSha256과 다르다(원문이 바뀌었다)`);
      const review = has(LITERATURE_FILES.review) ? JSON.parse(readFileSync(path.join(base, LITERATURE_FILES.review), 'utf8')) : null;
      // 단어 경계 미리 묶기(AOZORA-P1-10, 선택) — scripts/literature/boundaries.mjs가 분석기 토크나이저로 만든 「한 단어로 묶기」 기록
      const boundaries = has(LITERATURE_BOUNDARY_FILE) ? JSON.parse(readFileSync(path.join(base, LITERATURE_BOUNDARY_FILE), 'utf8')) : null;
      const display = validateLiteratureDisplay(entry.display, entry.title); // 표지 표기(AOZORA-P0-5) — 없으면 그 작품은 쓰지 않는다
      loaded.push({ dir, base, entry, review, boundaries, display, source: new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes) });
    } catch (error) {
      errors.push(`${dir}: ${error.message}`);
    }
  }
  try {
    createAozoraCatalog(loaded.map((work) => work.entry)); // 형식·중복(키·카드·원 zip) 검사
  } catch (error) {
    errors.push(`catalog: ${error.message}`);
    return { works, errors }; // 카탈로그가 깨졌으면 어느 작품도 쓰지 않는다
  }

  const drafts = [];
  for (const work of loaded) {
    try {
      const draft = withBoundaryMerges(withReviewHints(createAozoraMaterialDraft(work.entry, parseAozoraText(work.source)), work.review, resolveReviewHints), work.boundaries);
      // 한 문단이 장 상한보다 길면 글자 수로 잘려 문장(때로 루비 기준)이 두 장으로 찢긴다 — 공개하지 않는다.
      const { midParagraphSplitCount, droppedRubyCount } = draft.diagnostics;
      if (midParagraphSplitCount > 0 || droppedRubyCount > 0) {
        throw new Error(`장 경계가 문단 ${midParagraphSplitCount}곳·루비 ${droppedRubyCount}개를 갈랐다 — 見出し·분량을 확인한다`);
      }
      const output = serializeChapters(draft);
      const target = path.join(work.base, LITERATURE_FILES.chapters);
      const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
      if (check) {
        if (current !== output) throw new Error(`${LITERATURE_FILES.chapters}가 원문과 다르다 — node scripts/build-literature.mjs로 다시 만든다`);
        works.push({ key: work.dir, chapters: draft.chapters.length, status: 'checked' });
      } else {
        if (current !== output) writeFileSync(target, output);
        works.push({ key: work.dir, chapters: draft.chapters.length, status: current === output ? 'unchanged' : 'written' });
      }
      drafts.push({ ...draft, display: work.display, incipits: draft.chapters.map((chapter) => literatureIncipit(chapter.rawText)) });
    } catch (error) {
      errors.push(`${work.dir}: ${error.message}`);
    }
  }
  // 한 편이라도 실패하면 목록을 바꾸지 않는다 — 깨진 작품이 빠진 채 게시 목록이 줄어드는 일을 막는다.
  if (errors.length) return { works, errors };
  const outputs = [
    [LITERATURE_OUTPUTS.index, serializeIndex(drafts.map((draft) => draft.book.key))],
    [LITERATURE_OUTPUTS.manifest, serializeChapters(createManifest(drafts))],
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
