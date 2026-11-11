// 중국어 병음 검증표 생성기 (ZH-PINYIN-CHECK — 오너 지시 2026-11-11 「중국어 분석 후 병음 맞는지 다시 확인하는 절차」).
//
// 원천: CC-CEDICT (© MDBG, https://www.mdbg.net/chinese/dictionary?page=cc-cedict) — CC BY-SA 4.0.
//   cedict-json@1.3.20251213 (2025-12-13 스냅샷, JSON 변환본)의 cedict.json — zhNeutralToneCedict.json과 같은 스냅샷.
//   실행: node scripts/build-zh-pinyin-check.mjs --cedict <cedict.json 경로>
//   출력: src/lib/server/data/zhPinyinCheck.json — { _meta, words: { 낱말: [독음, …] } } (정렬 고정 — 결정성).
//         src/lib/server/data/zhErhua.json — { _meta, words: [낱말, …] } (얼화 낱말 목록 — 아래 「얼화」, 정렬 고정).
//
// 무엇을 싣나: HSK 3.0 어휘(src/lib/data/zhHskLevel.json) 중 한자 2자 이상 낱말의 CC-CEDICT 독음(성조 기호 · 소문자 · 음절 공백).
//   고유명사 독음(대문자로 시작)과 기호로 못 옮기는 음절(로마자)은 뺀다. 얼화 r5는 「r」 한 음절로 싣는다(哪儿 「nǎ r」). HSK로 한정한 까닭: 정답 병음 대조
//   (교재 24,860문장)에서 HSK 한정이 「고침 19 · 깨짐 0」, CEDICT 전체가 「고침 19 · 깨짐 1」(画卷 — 분절 오류 낱말)이었다.
// 어디에 쓰나: 서버 토크나이저의 검증 패스(src/lib/server/zhPinyinVerify.js) 전용 — 클라이언트 번들에 들어가지 않는다(계약).
//
// 얼화(ZH-ERHUA 안 A — 오너 「권장대로. ㄱㄱ」 2026-11-11 KST): CC-CEDICT 전체에서 儿로 끝나는 한자 2자 이상 낱말 중
//   **儿 자리를 r5로만** 적는 낱말(소문자 독음 · 음절 수 = 글자 수). 같은 낱말에 er2 독음이 하나라도 있으면 뺀다 —
//   실음절 ér(女儿 · 婴儿 · 孤儿)과 두 독음이 다 있는 낱말(花儿 · 小儿 · 托儿 · 干儿 · 猴儿)은 지금 병음 그대로 둔다.
//   HSK로 한정하지 않는다 — 운영 대상 有点儿 · 早点儿이 HSK 밖이고, r5 단독 낱말은 독음이 하나라 오탐 위험이 없다.
//   쓰는 곳: src/lib/server/zhErhua.js(토크나이저가 儿 자리 음절을 r로).

import fs from 'node:fs';
import path from 'node:path';

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const cedictPath = arg('cedict');
if (!cedictPath) {
  console.error('사용법: node scripts/build-zh-pinyin-check.mjs --cedict <cedict.json>');
  process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(root, 'src/lib/server/data/zhPinyinCheck.json');

const TONE_MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
/** 성조 숫자 음절 → 기호(build-zh-neutral-tone.mjs와 같은 규칙). 못 옮기면 null. */
export function syllableToSymbol(syl) {
  const m = syl.match(/^([a-zü:]+)([0-5])$/);
  if (!m) return null;
  const body = m[1].replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const tone = Number(m[2]);
  if (tone === 5 || tone === 0) return body;
  const pick = body.includes('a') ? 'a' : body.includes('e') ? 'e' : body.includes('ou') ? 'o' : [...body].reverse().find((c) => 'aeiouü'.includes(c));
  if (!pick) return null;
  const idx = body.lastIndexOf(pick);
  return body.slice(0, idx) + TONE_MARKS[pick][tone - 1] + body.slice(idx + 1);
}

const HAN = /^[一-鿿]+$/;
const hsk = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/zhHskLevel.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(cedictPath, 'utf8'));
const words = new Map();
for (const e of raw) {
  const w = e.simplified;
  if (!hsk[w] || !HAN.test(w) || [...w].length < 2) continue;
  const syls = String(e.pinyin).trim().split(/\s+/);
  if (syls.length !== [...w].length || /^[A-Z]/.test(syls[0])) continue; // 음절 수 ≠ 글자 수 · 고유명사 독음
  const sym = syls.map(syllableToSymbol);
  if (sym.some((s) => !s)) continue;
  if (!words.has(w)) words.set(w, new Set());
  words.get(w).add(sym.join(' '));
}
const out = {
  _meta: {
    source: 'CC-CEDICT © MDBG (cedict-json@1.3.20251213)',
    license: 'CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ · 이 파일만',
    changes: 'HSK 3.0 어휘 중 한자 2자 이상 낱말의 독음만 남기고 성조 숫자를 기호로 바꿨다(고유명사 독음 제외 · 얼화 r5는 r)',
    generator: 'scripts/build-zh-pinyin-check.mjs',
  },
  words: Object.fromEntries([...words].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([w, s]) => [w, [...s].sort()])),
};
fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
console.log(`zhPinyinCheck.json: ${words.size} words`);

const ERHUA_OUT = path.join(root, 'src/lib/server/data/zhErhua.json');
const erLast = new Map(); // 낱말 → 儿 자리 음절 집합(소문자 독음만)
for (const e of raw) {
  const w = e.simplified;
  if (!/^[一-鿿]+儿$/.test(w) || [...w].length < 2) continue;
  const syls = String(e.pinyin).trim().split(/\s+/);
  if (syls.length !== [...w].length || /^[A-Z]/.test(syls[0])) continue;
  if (!erLast.has(w)) erLast.set(w, new Set());
  erLast.get(w).add(syls.at(-1).toLowerCase());
}
const erhua = [...erLast].filter(([, s]) => [...s].every((y) => y === 'r5')).map(([w]) => w).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
fs.writeFileSync(ERHUA_OUT, `${JSON.stringify({
  _meta: {
    source: 'CC-CEDICT © MDBG (cedict-json@1.3.20251213)',
    license: 'CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ · 이 파일만',
    changes: '儿로 끝나는 한자 2자 이상 낱말 중 儿 자리를 r5로만 적는 낱말의 목록(독음은 싣지 않는다 · er2 독음이 있는 낱말 제외)',
    generator: 'scripts/build-zh-pinyin-check.mjs',
  },
  words: erhua,
})}\n`);
console.log(`zhErhua.json: ${erhua.length} words`);
