// 정본 문학책 빌드(설계 §3.1) — src/content/literature/aozora/<workKey>/{source.txt, entry.json} → chapters.json.
// 결정적이다: 같은 입력이면 같은 바이트(시각·환경 값 없음). --check는 쓰지 않고 차이만 실패로 낸다(world 자산 --check 선례).
// 제품 모듈은 동적 import한다 — CLI(scripts/build-literature.mjs)는 번들러식 import 훅을 먼저 등록하고, vitest는 그대로 푼다.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const LITERATURE_ROOT = 'src/content/literature/aozora';
export const LITERATURE_FILES = Object.freeze({ source: 'source.txt', entry: 'entry.json', chapters: 'chapters.json' });

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** chapters.json 직렬화 정본 — 2칸 들여쓰기 + 끝 개행. */
export function serializeChapters(draft) {
  return `${JSON.stringify(draft, null, 2)}\n`;
}

/**
 * @param {{root?: string, check?: boolean}} options root는 작품 폴더들의 부모(기본 리포의 LITERATURE_ROOT).
 * @returns {Promise<{works: Array<{key, chapters, status: 'written'|'unchanged'|'checked'}>, errors: string[]}>}
 */
export async function buildLiterature({ root = LITERATURE_ROOT, check = false } = {}) {
  const [{ createAozoraCatalog, aozoraWorkKey }, { parseAozoraText }, { createAozoraMaterialDraft }] = await Promise.all([
    import('../../src/lib/aozoraCatalog.js'),
    import('../../src/lib/aozoraParser.js'),
    import('../../src/lib/aozoraMaterial.js'),
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
      loaded.push({ dir, base, entry, source: new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes) });
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

  for (const work of loaded) {
    try {
      const draft = createAozoraMaterialDraft(work.entry, parseAozoraText(work.source));
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
    } catch (error) {
      errors.push(`${work.dir}: ${error.message}`);
    }
  }
  return { works, errors };
}
