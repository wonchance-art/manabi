// 간체→정체(OpenCC s2t) 조회 표 생성 — R0+ '훈음·한자음을 正 꼴로 찾기'(VIEWER-V2-ROUNDS-001 §1).
//
// 왜: 간체 글자 그대로 훈음을 찾으면 간체와 모양이 같은 옛 글자의 훈음이 나온다(技术 →
// '삽주뿌리 출', 价格 → '착할 개', 广场 → '바윗집 엄'). 단어를 s2t로 바꾼 정체 꼴의
// 글자로 찾으면 바로잡히고, 단어 단위 변환이 다음자도 푼다(干净 → 乾淨, 干部 → 幹部).
//
// 소스(오프라인 인자 — 네트워크 없는 결정적 생성, 산출물은 커밋):
//   npm opencc-data@1.4.1 (Apache-2.0, https://github.com/BYVoid/OpenCC 사전 데이터 —
//   hanjaKo·hanjaHun·hanjaJa 생성과 같은 채택 원천). OpenCC 공식 s2t.json 구성 그대로:
//     구절 = STPhrases.txt ∪ STPhrases_GeneratedFromRegionalPhrases.txt (최장 일치)
//     글자 = STCharacters.txt (첫 후보)
//   표제어(구절 표 범위): src/lib/data/zhHskLevel.json(HSK 3.0) + src/content/chinese/vocab
//   (우리 사전 zh) + 수량 구절(수사·지시사로 시작하는 3자 이하 OpenCC 구절 — 아래 2단계).
//   scripts/hanja-curated.mjs의 KR_VARIANTS·KO_WORD_FORMS도 함께 싣는다.
//
// 산출물 src/lib/data/hanjaTrad.json — 클라이언트는 구절 사전 전체(약 4.9만 행)를 싣지 않는다:
//   chars   — 글자 첫 후보가 원 글자와 다른 것만(diff-only).
//   phrases — 표제어 중 런타임 변환(toTraditional: 표 안 구절 최장 일치 → 글자 첫 후보)이
//             OpenCC 전체 사전 결과와 다른 단어만. 고정점까지 반복해 표제어 전부가
//             전체 사전 결과와 같아지는 것을 생성 때 검증한다(어긋나면 실패).
//   koForms — 한국 다음자 예외(조회 꼴 겹침). krVariants — 한국 정자 이체.
//   키는 코드포인트 순 정렬(결정성).
//
// 재생성: node scripts/generate-hanja-trad.mjs <STCharacters.txt> <STPhrases.txt> <STPhrases_GeneratedFromRegionalPhrases.txt>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toTraditional, koLookupForms } from '../src/lib/hanjaKo.js';
import { KR_VARIANTS, KO_WORD_FORMS } from './hanja-curated.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [charsPath, phrasesPath, regionalPath] = process.argv.slice(2);
if (!charsPath || !phrasesPath || !regionalPath) {
  console.error('사용법: node scripts/generate-hanja-trad.mjs <STCharacters.txt> <STPhrases.txt> <STPhrases_GeneratedFromRegionalPhrases.txt>');
  process.exit(1);
}

/** OpenCC 텍스트 사전 — key → 첫 후보. 같은 키가 다시 나오면 앞 행 우선. */
function readDict(file) {
  const m = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [k, v] = line.split('\t');
    if (!k || !v) continue;
    const first = v.trim().split(' ')[0];
    if (first && !m.has(k)) m.set(k, first);
  }
  return m;
}

const charDict = readDict(charsPath);
const phraseDict = readDict(phrasesPath);
for (const [k, v] of readDict(regionalPath)) if (!phraseDict.has(k)) phraseDict.set(k, v); // union
let maxLen = 0;
for (const k of phraseDict.keys()) maxLen = Math.max(maxLen, [...k].length);

/** OpenCC s2t(전체 사전) — 구절 최장 일치 → 글자 첫 후보. */
function fullS2t(text) {
  const cs = [...text];
  let out = '';
  for (let i = 0; i < cs.length;) {
    let hit = 0;
    for (let len = Math.min(maxLen, cs.length - i); len >= 2 && !hit; len--) {
      const seg = cs.slice(i, i + len).join('');
      if (phraseDict.has(seg)) { out += phraseDict.get(seg); hit = len; }
    }
    if (hit) { i += hit; continue; }
    out += charDict.get(cs[i]) || cs[i];
    i++;
  }
  return out;
}

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortObj = (entries) => Object.fromEntries([...entries].sort(([a], [b]) => byCodePoint(a, b)));

// 1) 글자 표 — 단일 글자 키, 첫 후보가 자기와 다를 때만
const chars = sortObj([...charDict].filter(([k, v]) => [...k].length === 1 && [...v].length === 1 && k !== v));

// 2) 표제어 수집 — HSK + 우리 사전(zh), 한자 포함 2자 이상
const HAN = /\p{Script=Han}/u;
const heads = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/zhHskLevel.json'), 'utf8'))));
const vocabDir = path.join(root, 'src/content/chinese/vocab');
for (const f of fs.readdirSync(vocabDir).filter((x) => x.endsWith('.js')).sort()) {
  const mod = await import(pathToFileURL(path.join(vocabDir, f)).href);
  for (const theme of mod.default?.themes || []) for (const w of theme.words || []) if (w?.zh) heads.add(w.zh);
}
for (const k of Object.keys(KO_WORD_FORMS)) heads.add(k);
// 수량 구절 — 분석기(jieba)는 수사·지시사 + 양사를 한 토큰으로 낸다(一只·几只·两只手 실측).
// 표제어가 아니어도 토큰으로 자주 나오므로, 그런 꼴(3자 이하, 수사·지시사로 시작)의 구절
// 중 글자 변환과 결과가 다른 것만 더한다(一只 → 一隻: 只 첫 후보는 只).
const QUANT_HEAD = new Set([...'一二两三四五六七八九十百千万几每这那哪半整']);
const charFirst = (s) => [...s].map((c) => charDict.get(c) || c).join('');
let quant = 0;
for (const [k, v] of phraseDict) {
  const cs = [...k];
  if (cs.length <= 3 && QUANT_HEAD.has(cs[0]) && charFirst(k) !== v && !heads.has(k)) { heads.add(k); quant++; }
}
const words = [...heads].filter((w) => [...w].length >= 2 && HAN.test(w)).sort(byCodePoint);

// 3) 구절 표 — 런타임 변환이 전체 사전과 어긋나는 표제어만, 고정점까지
const phrases = {};
let lengthSkipped = 0;
for (let pass = 1; ; pass++) {
  const table = { chars, phrases };
  let added = 0;
  for (const w of words) {
    const want = fullS2t(w);
    if ([...want].length !== [...w].length) { if (pass === 1) lengthSkipped++; continue; }
    if (toTraditional(w, table) !== want) { phrases[w] = want; added++; }
  }
  if (!added) break;
  if (pass > 10) throw new Error('구절 표가 고정점에 이르지 않음');
}
const table = { chars, phrases: sortObj(Object.entries(phrases)) };
const mismatch = words.filter((w) => {
  const want = fullS2t(w);
  return [...want].length === [...w].length && toTraditional(w, table) !== want;
});
if (mismatch.length) throw new Error(`표제어 변환 불일치 ${mismatch.length}: ${mismatch.slice(0, 10).join(' ')}`);

// 4) 한국 다음자 예외 검증 — 키와 값의 글자 수가 같아야 겹칠 수 있다
for (const [k, v] of Object.entries(KO_WORD_FORMS)) {
  if ([...k].length !== [...v].length) throw new Error(`KO_WORD_FORMS 길이 불일치: ${k} → ${v}`);
}

const out = {
  _source: 'OpenCC (https://github.com/BYVoid/OpenCC) via npm opencc-data@1.4.1 — STCharacters.txt · STPhrases.txt · '
    + 'STPhrases_GeneratedFromRegionalPhrases.txt, Apache License 2.0. Derived subset generated by scripts/generate-hanja-trad.mjs '
    + '(chars: first candidate diff-only; phrases: HSK·우리 사전 표제어·수량 구절 중 글자 변환과 다른 단어). koForms·krVariants: scripts/hanja-curated.mjs.',
  chars: table.chars,
  phrases: table.phrases,
  koForms: sortObj(Object.entries(KO_WORD_FORMS)),
  krVariants: sortObj(Object.entries(KR_VARIANTS)),
};
const dest = path.join(root, 'src/lib/data/hanjaTrad.json');
fs.writeFileSync(dest, JSON.stringify(out));
const check = { ...out };
console.log(
  `hanjaTrad.json 생성 — 글자 ${Object.keys(out.chars).length} · 구절 ${Object.keys(out.phrases).length}`
  + ` (대상 ${words.length} — 수량 구절 ${quant} 포함, 길이 변환 제외 ${lengthSkipped}) · 예외 ${Object.keys(out.koForms).length}`
  + ` · ${(fs.statSync(dest).size / 1024).toFixed(1)}KB`
);
// 예외 동작 표본 — 생성 로그로 감수
for (const k of Object.keys(out.koForms)) console.log(`  예외 ${k}: s2t ${toTraditional(k, check)} → 조회 ${koLookupForms(k, check).join('')}`);
