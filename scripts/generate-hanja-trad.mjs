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
//   hunUpgrade — 같은 음에서 정체 훈으로 바꿔도 되는 검수 쌍(그 밖은 지금 화면 훈 유지).
//   키는 코드포인트 순 정렬(결정성).
//
// AE-R3 正 줄(VIEWER-V2-ROUNDS-001 §6 — 대만 표준 자형, OpenCC 공식 s2tw.json 구성):
//   tw        — TWVariants.txt 전체(38자, 吃·群·為·著 …). s2t 결과 위에 글자 단위로 건다.
//   twPhrases — TWVariantsPhrases.txt 전체(4행, 喫을 지키는 예외). tw보다 먼저 최장 일치.
//   amb       — 모호 글자: STCharacters 후보가 둘 이상이고 후보들의 대만 꼴이 서로 다른 글자(문자열).
//   ok        — 검증 표제어: 모호 글자를 포함하는데 그 자리가 구절 표 일치로 덮이지 않는 표제어
//               (글자 첫 후보로 맞힌 发展·历史 등). 클라이언트는 표 밖 토큰과 이것을 구별해
//               「모호하면 숨김」을 판정한다(hanjaKo.js zhengSure).
//   표제어 전부에서 런타임 s2tw(toTraditionalTW) = OpenCC 전체 s2tw를 생성 때 검증한다.
//   s2twp(어휘 변환 TWPhrases — 出租车 → 計程車)는 싣지 않는다(글자 꼴만).
//
// 재생성: node scripts/generate-hanja-trad.mjs <STCharacters.txt> <STPhrases.txt> <STPhrases_GeneratedFromRegionalPhrases.txt> <TWVariants.txt> <TWVariantsPhrases.txt>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toTraditional, toTraditionalTW, zhengSure, koLookupForms } from '../src/lib/hanjaKo.js';
import { KR_VARIANTS, KO_WORD_FORMS, HUN_TRAD_UPGRADE } from './hanja-curated.mjs';
import { readZhHeadwords } from './zh-headwords.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [charsPath, phrasesPath, regionalPath, twPath, twPhrasesPath] = process.argv.slice(2);
if (!charsPath || !phrasesPath || !regionalPath || !twPath || !twPhrasesPath) {
  console.error('사용법: node scripts/generate-hanja-trad.mjs <STCharacters.txt> <STPhrases.txt> <STPhrases_GeneratedFromRegionalPhrases.txt> <TWVariants.txt> <TWVariantsPhrases.txt>');
  process.exit(1);
}

/** OpenCC 텍스트 사전 — key → 후보 배열. 같은 키가 다시 나오면 앞 행 우선. */
function readDictAll(file) {
  const m = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [k, v] = line.split('\t');
    if (!k || !v) continue;
    const cands = v.trim().split(' ').filter(Boolean);
    if (cands.length && !m.has(k)) m.set(k, cands);
  }
  return m;
}
/** OpenCC 텍스트 사전 — key → 첫 후보. */
const readDict = (file) => new Map([...readDictAll(file)].map(([k, v]) => [k, v[0]]));

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
const heads = await readZhHeadwords(root);
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

// 5) 같은 음 훈 교체 허용 쌍 — 실제로 s2t가 그 간체를 그 정체로 바꾸는 자리가 있어야 한다
const mapsTo = (simp, trad) => chars[simp] === trad
  || Object.entries(table.phrases).some(([k, v]) => [...k].some((c, i) => c === simp && [...v][i] === trad));
for (const p of HUN_TRAD_UPGRADE) {
  const [simp, trad] = [...p];
  if ([...p].length !== 2 || !mapsTo(simp, trad)) throw new Error(`HUN_TRAD_UPGRADE 쌍이 s2t 변환에 없음: ${p}`);
}

// 6) 正 줄 — 대만 이체(s2tw 둘째 단계)와 「모호하면 숨김」 판정 데이터
const twAll = readDictAll(twPath);
const twPhraseAll = readDictAll(twPhrasesPath);
for (const [k, v] of twAll) if ([...k].length !== 1 || [...v[0]].length !== 1) throw new Error(`TWVariants가 한 글자 대응이 아님: ${k} → ${v[0]}`);
for (const [k, v] of twPhraseAll) if ([...k].length !== [...v[0]].length) throw new Error(`TWVariantsPhrases 길이 불일치: ${k} → ${v[0]}`);
const tw = sortObj([...twAll].map(([k, v]) => [k, v[0]]));
const twPhrases = sortObj([...twPhraseAll].map(([k, v]) => [k, v[0]]));
let twLimit = 0;
for (const k of Object.keys(twPhrases)) twLimit = Math.max(twLimit, [...k].length);
/** OpenCC 전체 s2tw — 전체 s2t 뒤에 [TWVariantsPhrases(최장 일치) → TWVariants]. */
function fullS2tw(text) {
  const cs = [...fullS2t(text)];
  let out = '';
  for (let i = 0; i < cs.length;) {
    let hit = 0;
    for (let len = Math.min(twLimit, cs.length - i); len >= 2 && !hit; len--) {
      const seg = cs.slice(i, i + len).join('');
      if (twPhrases[seg]) { out += twPhrases[seg]; hit = len; }
    }
    if (hit) { i += hit; continue; }
    out += tw[cs[i]] || cs[i];
    i++;
  }
  return out;
}
const twOf = (c) => tw[c] || c;
const ambChars = [...readDictAll(charsPath)]
  .filter(([k, v]) => [...k].length === 1 && v.length > 1 && new Set(v.map(twOf)).size > 1)
  .map(([k]) => k)
  .sort(byCodePoint);
const twTable = { chars: table.chars, phrases: table.phrases, tw, twPhrases, amb: ambChars.join(''), ok: [] };
const twMismatch = words.filter((w) => toTraditionalTW(w, twTable) !== fullS2tw(w));
if (twMismatch.length) throw new Error(`표제어 s2tw 불일치 ${twMismatch.length}: ${twMismatch.slice(0, 10).join(' ')}`);
// ok — 모호 글자를 담았지만 구절 표 일치로 덮이지 않는 표제어(2자 이상). 위 검증으로 이들의 런타임
// s2tw는 OpenCC 전체 s2tw와 같다(1자 표제어는 문맥이 없어 싣지 않는다 — 항상 숨김).
const ambSet = new Set(ambChars);
const okWords = words.filter((w) => [...w].some((c) => ambSet.has(c)) && !zhengSure(w, twTable));
const twFinal = { ...twTable, ok: okWords }; // 새 객체 — hanjaKo.js가 표 객체별로 amb·ok 집합을 캐시한다
if (words.some((w) => !zhengSure(w, twFinal))) throw new Error('ok 목록을 더해도 확신하지 못하는 표제어가 남음');
const twChanged = words.filter((w) => toTraditional(w, twTable) !== toTraditionalTW(w, twTable));

const out = {
  _source: 'OpenCC (https://github.com/BYVoid/OpenCC) via npm opencc-data@1.4.1 — STCharacters.txt · STPhrases.txt · '
    + 'STPhrases_GeneratedFromRegionalPhrases.txt · TWVariants.txt · TWVariantsPhrases.txt, Apache License 2.0. Derived subset generated by scripts/generate-hanja-trad.mjs '
    + '(chars: first candidate diff-only; phrases: HSK·우리 사전 표제어·수량 구절 중 글자 변환과 다른 단어; tw·twPhrases: s2tw 대만 이체 단계 전체; '
    + 'amb: 대만 꼴이 갈리는 모호 글자; ok: 모호 글자를 담은 표제어 중 구절 표 밖에서 검증된 단어). koForms·krVariants·hunUpgrade: scripts/hanja-curated.mjs.',
  chars: table.chars,
  phrases: table.phrases,
  koForms: sortObj(Object.entries(KO_WORD_FORMS)),
  krVariants: sortObj(Object.entries(KR_VARIANTS)),
  hunUpgrade: [...HUN_TRAD_UPGRADE].sort(byCodePoint),
  tw,
  twPhrases,
  amb: twTable.amb,
  ok: okWords,
};
const dest = path.join(root, 'src/lib/data/hanjaTrad.json');
fs.writeFileSync(dest, JSON.stringify(out));
const check = { ...out };
console.log(
  `hanjaTrad.json 생성 — 글자 ${Object.keys(out.chars).length} · 구절 ${Object.keys(out.phrases).length}`
  + ` (대상 ${words.length} — 수량 구절 ${quant} 포함, 길이 변환 제외 ${lengthSkipped}) · 예외 ${Object.keys(out.koForms).length}`
  + ` · ${(fs.statSync(dest).size / 1024).toFixed(1)}KB`
);
console.log(`  正(s2tw) — 대만 이체 ${Object.keys(tw).length}자 · 이체 구절 ${Object.keys(twPhrases).length} · 모호 글자 ${ambChars.length}`
  + ` · 검증 표제어 ${okWords.length} · 대만 이체로 결과가 바뀐 표제어 ${twChanged.length} · s2tw ≠ 간체 ${words.filter((w) => toTraditionalTW(w, twTable) !== w).length}/${words.length}`);
// 예외 동작 표본 — 생성 로그로 감수
for (const k of Object.keys(out.koForms)) console.log(`  예외 ${k}: s2t ${toTraditional(k, check)} → 조회 ${koLookupForms(k, check).join('')}`);
