// HSK 3.0 어휘표 → 급수·품사 데이터 생성기 (분석 개선 R3 — 오너 승인 2026-08-29).
//
// 원천: ivankra/hsk30 (MIT — 공식 HSK 3.0 목록 11,092단어 정리본, hsk30.csv).
//   실행: node scripts/build-zh-hsk.mjs --hsk <hsk30.csv 경로>
//   출력(둘 다 정렬 고정 — 결정성):
//   ① src/lib/data/zhHskLevel.json — { 단어: 급수 } (1~6, 7 = 7-9 통합밴드).
//      파이프 변형(爸爸|爸)은 각각 등재, 중복은 낮은 급수 우선. 한자 표제어만.
//   ② src/lib/server/data/zhPosFixHsk.json — { 단어: { tag, posAll? } }.
//      jieba가 단독 토큰으로 내는 단어 중, jieba 품사 계열과 HSK 품사 집합이
//      **서로소**인 충돌만 수확(自觉/d vs V·Adj류) — R1 POS_FIX의 자동 시드.
//      후보가 여럿이면 posAll('·' 연결)로 문맥 판별기(disambiguateZhPos)가 짚는다.
//
// 수확 보수 원칙(오탐 방지):
// - 내용어 계열(명·동·형·부)만 비교 — 양사·전치사류 혼합 기능어는 건드리지 않는다
//   (판별기 MARKABLE_POS와 같은 철학).
// - jieba 겸류(vn 등)는 계열 집합으로 비교 — 교집합이 있으면 충돌 아님.
// - jieba 고유명사류(nr·ns·nt·nz) 표제어는 제외(인명·지명 판정은 존중).
// - 수제 ZH_POS_FIX 등재어는 제외(수제가 정본).

import fs from 'node:fs';
import path from 'node:path';
import { tag as jiebaTag } from 'jieba-wasm';

// 수제 ZH_POS_FIX 키(zhTokenFix.js와 동기) — 모듈 import는 JSON import 체인 때문에
// raw node에서 못 쓴다(vitest·Next 전용). 겹쳐도 런타임 조회는 수제 우선이라 무해하고,
// 겹침 자체는 계약 테스트(수제와 비겹침)가 재생성 신호를 준다.
const HAND_POS_FIX_KEYS = new Set(['自觉', '没', '很', '谢谢', '安静']);
// ※ 谢谢·安静은 jieba 고립 태그가 nr(고유명사류)라 어차피 수확 제외 — 여기 등재는 동기
//   계약용이고 재생성 산출물은 불변이다.

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const hskPath = arg('hsk');
if (!hskPath) {
  console.error('사용법: node scripts/build-zh-hsk.mjs --hsk <hsk30.csv>');
  process.exit(1);
}

const HANZI_ONLY = /^[一-鿿]+$/;

// HSK POS 코드 → 우리 한국어 라벨(POS_KO와 동일 어휘). Phonetic·빈 값은 품사 수확 제외.
const HSK_POS_KO = {
  N: '명사', V: '동사', Adj: '형용사', Adv: '부사', Pron: '대명사', Num: '수사',
  M: '양사', Prep: '전치사', Conj: '접속사', Aux: '조사', Intj: '감탄사',
  Suffix: '접미', Prefix: '접두',
};
const CONTENT = new Set(['명사', '동사', '형용사', '부사']);
const KO_TO_TAG = { 명사: 'n', 동사: 'v', 형용사: 'a', 부사: 'd' };
// jieba 태그 → 내용어 계열 집합(겸류는 둘 다). 그 외 태그는 null(비교 불가 → 미상 취급).
const JIEBA_FAMILY = {
  n: ['명사'], v: ['동사'], a: ['형용사'], d: ['부사'],
  vn: ['동사', '명사'], vd: ['동사', '부사'], an: ['형용사', '명사'], ad: ['형용사', '부사'],
  t: ['명사'], s: ['명사'], f: ['명사'], // 시간사·처소사·방위사는 명사 계열로 취급
};
const PROPER_TAGS = new Set(['nr', 'ns', 'nt', 'nz']);
// family-미상 중 수확해도 되는 태그 — 어소·미지(jieba가 정체를 모르는 것들, 癌/ng류).
// 기능어 태그(ug 등 u*·전치사·접속사류)는 jieba의 판정이 문맥 정답인 경우가 많아
// 존중한다 — 실측: 过는 HSK V지만 문장 속 단독 过는 대개 상조사(ug)라 뒤집으면 오태그.
const LEXICAL_UNKNOWN_TAGS = new Set(['x', 'ng', 'g', 'zg']);

// CSV 파싱 — 따옴표 필드(Variants의 JSON) 대응 최소 구현.
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const rows = fs.readFileSync(hskPath, 'utf8').split('\n').filter(Boolean);
const header = parseCsvLine(rows[0]);
const col = (name) => header.indexOf(name);
const [iSimp, iPos, iLevel] = [col('Simplified'), col('POS'), col('Level')];

const levels = new Map();   // 단어 → 급수(낮은 급수 우선)
const posSets = new Map();  // 단어 → HSK 품사 라벨 Set
for (const row of rows.slice(1)) {
  const f = parseCsvLine(row);
  const level = f[iLevel] === '7-9' ? 7 : Number(f[iLevel]);
  if (!Number.isInteger(level) || level < 1 || level > 7) continue;
  const posLabels = (f[iPos] || '').split('/').map((p) => HSK_POS_KO[p.trim()]).filter(Boolean);
  for (const w of (f[iSimp] || '').split('|')) {
    const word = w.trim();
    if (!HANZI_ONLY.test(word)) continue;
    if (!levels.has(word) || levels.get(word) > level) levels.set(word, level);
    if (posLabels.length > 0 && !posSets.has(word)) posSets.set(word, new Set(posLabels));
  }
}

// ① 급수 데이터
const levelSorted = Object.fromEntries([...levels.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh')));
const levelPath = path.join(process.cwd(), 'src/lib/data/zhHskLevel.json');
fs.writeFileSync(levelPath, JSON.stringify(levelSorted) + '\n');

// ② 품사 충돌 수확
const stats = { checked: 0, multiToken: 0, proper: 0, agree: 0, unknownTag: 0, harvested: 0 };
const posFix = {};
for (const [word, hskSet] of posSets) {
  if (HAND_POS_FIX_KEYS.has(word)) continue;            // 수제 정본 우선
  if (![...hskSet].every((p) => CONTENT.has(p))) continue; // 내용어 계열만
  stats.checked++;
  const tagged = jiebaTag(word, true);
  if (tagged.length !== 1 || tagged[0].word !== word) { stats.multiToken++; continue; }
  const jTag = tagged[0].tag;
  if (PROPER_TAGS.has(jTag)) { stats.proper++; continue; }
  const family = JIEBA_FAMILY[jTag] || null;
  if (family && family.some((l) => hskSet.has(l))) { stats.agree++; continue; }
  if (!family) {
    // family-미상: 어소·미지 태그만 보강 수확, 기능어 태그(ug·p·c류)는 jieba 존중
    if (!LEXICAL_UNKNOWN_TAGS.has(jTag)) { stats.functionTag = (stats.functionTag || 0) + 1; continue; }
    stats.unknownTag++;
  }
  const labels = [...hskSet];
  posFix[word] = {
    tag: KO_TO_TAG[labels[0]],
    ...(labels.length > 1 ? { posAll: labels.join('·') } : {}),
  };
  stats.harvested++;
}
const posSorted = Object.fromEntries(Object.entries(posFix).sort(([a], [b]) => a.localeCompare(b, 'zh')));
const posPath = path.join(process.cwd(), 'src/lib/server/data/zhPosFixHsk.json');
fs.writeFileSync(posPath, JSON.stringify(posSorted, null, 1) + '\n');

console.log('급수 등재:', Object.keys(levelSorted).length, '→', levelPath);
console.log('품사 대조:', stats.checked, '/ 다중토큰 제외:', stats.multiToken,
  '/ 고유명사 제외:', stats.proper, '/ 일치:', stats.agree, '/ jieba 미상 태그:', stats.unknownTag);
console.log('품사 충돌 수확:', stats.harvested, '→', posPath);
for (const w of ['自觉', '计划', '希望', '工作']) {
  console.log(' 스팟', w, 'HSK', levels.get(w) ?? '-', JSON.stringify(posSorted[w] ?? '(수확 없음)'));
}
