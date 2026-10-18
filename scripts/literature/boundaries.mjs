#!/usr/bin/env node
/**
 * 정본 문학책 단어 경계 미리 묶기(AOZORA-P1-10) — 분석기와 같은 토크나이저로 장마다 「한 단어로 묶기」 기록을 만든다.
 *
 *   node scripts/literature/boundaries.mjs              모든 작품 — boundaries.json을 쓰고, 이어서 build-literature로 chapters.json에 싣는다
 *   node scripts/literature/boundaries.mjs <작품 키>…   그 작품만(빌드는 전체 — 다른 작품은 unchanged)
 *
 * 무엇을 묶나: scripts/lib/literature-boundaries.mjs 머리말. 토크나이저(kuromoji 사전 적재 수 초)를 배포 prebuild의
 * `build-literature --check`마다 돌리지 않으려고 결과를 boundaries.json으로 남기고, 빌드는 장 원문 해시만 대조한다.
 * 장은 chapters.json이 아니라 source.txt·entry.json에서 빌드와 같은 함수로 다시 만든다 — 장 나눔이 바뀌어 낡은
 * boundaries.json 때문에 빌드가 막혀도 이 스크립트로 바로 다시 만들 수 있게.
 * 작품을 추가하거나 장 나눔·분석기 경계 규칙(jaReadingFix·jaKanaSegment·jaCompoundMerge)이 바뀌면 다시 돌린다.
 */
import '../eval/productImportHooks.mjs';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildLiterature, LITERATURE_FILES, LITERATURE_ROOT } from '../lib/literature-build.mjs';
import { LITERATURE_BOUNDARY_FILE, literatureBoundaryMerges, serializeBoundaries } from '../lib/literature-boundaries.mjs';

const { tokenizeJaLine } = await import('../../src/lib/server/tokenizeJa.js');
const { BOUNDARY_LIMITS } = await import('../../src/lib/boundaryEdits.js');
const { parseAozoraText } = await import('../../src/lib/aozoraParser.js');
const { createAozoraMaterialDraft } = await import('../../src/lib/aozoraMaterial.js');
const TOKENIZER = 'kuromoji + jaReadingFix · jaKanaSegment · jaCompoundMerge (src/lib/server/tokenizeJa.js)';
const LIMITS = { maxTokens: BOUNDARY_LIMITS.maxTokens, maxChars: BOUNDARY_LIMITS.maxChars.Japanese, maxEdits: BOUNDARY_LIMITS.maxEdits };

const wanted = process.argv.slice(2).filter((arg) => arg.startsWith('aozora-'));
const wantedWs = process.argv.slice(2).filter((arg) => arg.startsWith('ws-zh-'));
const dirs = wantedWs.length && !wanted.length ? [] : readdirSync(LITERATURE_ROOT).filter((dir) => dir.startsWith('aozora-') && (!wanted.length || wanted.includes(dir))).sort();
let total = 0;
for (const dir of dirs) {
  const base = path.join(LITERATURE_ROOT, dir);
  const entry = JSON.parse(readFileSync(path.join(base, LITERATURE_FILES.entry), 'utf8'));
  const { chapters } = createAozoraMaterialDraft(entry, parseAozoraText(readFileSync(path.join(base, LITERATURE_FILES.source), 'utf8')));
  const merges = await literatureBoundaryMerges(chapters, tokenizeJaLine, LIMITS);
  writeFileSync(path.join(base, LITERATURE_BOUNDARY_FILE), serializeBoundaries(merges, TOKENIZER));
  const by = (reason) => merges.reduce((sum, chapter) => sum + chapter.edits.filter((edit) => edit.reason === reason).length, 0);
  const count = by('ruby') + by('ruby-repeat') + by('katakana');
  total += count;
  console.log(`${entry.title}\t묶기 ${count}(루비 ${by('ruby')} · 같은 낱말 ${by('ruby-repeat')} · 카타카나 ${by('katakana')})`);
}
// 위키문헌 중국어(LIT-SRC-WS-1) — 교정본의 고유명사 밑줄(nameMarks)이 jieba(분석기와 같은 tokenizeZhLine)로 쪼개지는 자리.
{
  const { tokenizeZhLine } = await import('../../src/lib/server/tokenizeZh.js');
  const { createWikisourceDraft } = await import('../../src/lib/wikisource.js');
  const { WIKISOURCE_ROOT, WIKISOURCE_FILES } = await import('../lib/wikisource-build.mjs');
  const ZH_TOKENIZER = 'jieba-wasm + fixZhTagged (src/lib/server/tokenizeZh.js)';
  const ZH_LIMITS = { maxTokens: BOUNDARY_LIMITS.maxTokens, maxChars: BOUNDARY_LIMITS.maxChars.Chinese, maxEdits: BOUNDARY_LIMITS.maxEdits };
  const zhDirs = readdirSync(WIKISOURCE_ROOT).filter((dir) => dir.startsWith('ws-zh-') && (!wantedWs.length || wantedWs.includes(dir))).sort();
  for (const dir of (wanted.length && !wantedWs.length) ? [] : zhDirs) {
    const base = path.join(WIKISOURCE_ROOT, dir);
    const entry = JSON.parse(readFileSync(path.join(base, WIKISOURCE_FILES.entry), 'utf8'));
    const files = entry.files.flatMap((file) => file.variants.map((item) => ({ path: item.path, text: readFileSync(path.join(base, WIKISOURCE_FILES.source, item.path), 'utf8') })));
    const { chapters } = createWikisourceDraft(entry, files);
    const merges = await literatureBoundaryMerges(chapters, async (line) => tokenizeZhLine(line), ZH_LIMITS);
    writeFileSync(path.join(base, LITERATURE_BOUNDARY_FILE), serializeBoundaries(merges, ZH_TOKENIZER));
    const by = (reason) => merges.reduce((sum, chapter) => sum + chapter.edits.filter((edit) => edit.reason === reason).length, 0);
    total += by('name') + by('name-repeat');
    console.log(`${entry.title}\t묶기 ${by('name') + by('name-repeat')}(밑줄 ${by('name')} · 같은 낱말 ${by('name-repeat')})`);
  }
}
console.log(`합계 ${total}곳`);
const { works, errors } = await buildLiterature();
for (const error of errors) console.error(`✗ ${error}`);
if (errors.length) process.exitCode = 1;
else console.log(`✓ chapters.json ${works.filter((work) => work.status === 'written').length}편 갱신 · ${works.length}편 통과`);
