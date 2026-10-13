// HSK 2026 단어 급수 표 생성기 (ZH-LEVEL-2026-001 ① — 오너 결정 2026-10-13 KST: 화면 급수 기준은 HSK 2026).
//
// 원천: 《中文水平考试 HSK 考试大纲》(Syllabus for the Chinese Proficiency Test), 中外语言交流合作中心 发布,
//   2025-11 发布 · 2026-07 实施. 词汇大纲 11,000항목을 뽑은 설계 정본 docs/design/hsk2026/words.json
//   (뽑은 방법·PDF 해시는 docs/design/hsk2026/README.md). 공식 배포처 www.chinesetest.cn.
// 출력: src/lib/data/zhHsk2026Level.json — { 단어: 1~7 } (7 = 7–9 통합 밴드). 화면 급수 표시 전용.
//   분절 방벽은 이 표가 아니라 2021 표(zhHskLevel.json — scripts/build-zh-hsk.mjs)를 계속 쓴다.
// 규칙:
//   - 동형어 번호를 뗀다(本1·本2 → 本): words.json의 `headword`가 있으면 그것, 없으면 `word`.
//   - 괄호 급수(1（4）)는 앞 급수 — words.json의 `level`(괄호 급수는 `extra_levels`, 여기서는 쓰지 않는다).
//   - 같은 표기가 여럿이면 가장 낮은 급수(还 hái/huán · 得 ×3 · 동형어 번호).
//   - 키 정렬은 코드포인트 순 — localeCompare('zh')는 ICU 판에 따라 달라질 수 있어 결정성을 위해 쓰지 않는다.
// 실행: node scripts/build-zh-hsk2026.mjs          — 표를 다시 쓴다
//       node scripts/build-zh-hsk2026.mjs --check  — 쓰지 않고 원천과 같은지만 본다(다르면 종료 코드 1)
// 같은 검사를 zhHsk2026Level.test.js가 CI에서 한다(신선도 계약).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HSK2026_SOURCE = path.join(ROOT, 'docs/design/hsk2026/words.json');
export const HSK2026_OUTPUT = path.join(ROOT, 'src/lib/data/zhHsk2026Level.json');

const HANZI_ONLY = /^[一-鿿]+$/;

/** words.json 항목 배열 → { 단어: 1~7 } (코드포인트 정렬). 형식이 어긋난 항목은 던진다(조용히 빠뜨리지 않는다). */
export function buildZhHsk2026Levels(words) {
  const levels = new Map();
  for (const e of words) {
    const word = e.headword ?? e.word;
    const level = e.level === '7-9' ? 7 : Number(e.level);
    if (!HANZI_ONLY.test(word) || !Number.isInteger(level) || level < 1 || level > 7) {
      throw new Error(`형식 밖 항목 seq=${e.seq}: ${JSON.stringify(e)}`);
    }
    if (!levels.has(word) || levels.get(word) > level) levels.set(word, level);
  }
  const keys = [...levels.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(keys.map((k) => [k, levels.get(k)]));
}

/** 출력 파일의 바이트 그대로 — 한 줄 JSON + 줄바꿈(zhHskLevel.json과 같은 꼴). */
export function serializeZhHsk2026Levels(levels) {
  return JSON.stringify(levels) + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const words = JSON.parse(fs.readFileSync(HSK2026_SOURCE, 'utf8'));
  const levels = buildZhHsk2026Levels(words);
  const text = serializeZhHsk2026Levels(levels);
  const counts = {};
  for (const l of Object.values(levels)) counts[l] = (counts[l] || 0) + 1;
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(HSK2026_OUTPUT) ? fs.readFileSync(HSK2026_OUTPUT, 'utf8') : '';
    if (current !== text) {
      console.error(`✗ ${path.relative(ROOT, HSK2026_OUTPUT)}가 원천과 다르다 — node scripts/build-zh-hsk2026.mjs로 다시 만든다`);
      process.exit(1);
    }
    console.log(`✓ HSK 2026 급수 표 검사 통과 — ${Object.keys(levels).length}단어`, JSON.stringify(counts));
  } else {
    fs.writeFileSync(HSK2026_OUTPUT, text);
    console.log(`HSK 2026 급수 표: 원천 ${words.length}항목 → ${Object.keys(levels).length}단어 → ${path.relative(ROOT, HSK2026_OUTPUT)}`, JSON.stringify(counts));
  }
}
