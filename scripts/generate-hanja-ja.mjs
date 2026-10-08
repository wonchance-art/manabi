// 한자→일본식 자형(신자체) 정적 테이블 생성 — 글자 카드 「日」 칩과 중국어 단어창
// 「일본어 대조」의 일본식 자형(간체보다 일본식 표기가 익숙하다는 오너 확정).
//
// 변환 경로: 간체 → 정체 후보(Unihan kTraditionalVariant, OpenCC STCharacters 빈도 순 정렬) → 신자체
// (OpenCC 구자체→신자체 쌍). 일본이 정체형을 그대로 쓰는 글자(師 등)는 정체가 곧
// 일본식이고, 일본 비상용 한자는 정체(=한국 정자 계열)로 폴백된다 — 간체보다 친숙.
//
// 소스(오프라인 인자 — 네트워크 없는 결정적 생성, 산출물은 커밋):
// 1. Unihan kTraditionalVariant — 간체→정체 후보. Unicode License v3.
//    unicode-org/unicodetools main 브랜치 unicodetools/data/ucd/17.0.0/Unihan/kTraditionalVariant.txt
//    (Unicode 17.0.0 판, 속성별 파일 "XXXX\tU+YYYY ..." — Unihan.zip의 Unihan_Variants.txt
//    "U+XXXX\tkTraditionalVariant\t..." 행도 읽는다). sha256 4eca6285d45070548e6e6c06e4b48c3ca6866d4380e8cb980c512f5d1fc71895.
// 2. OpenCC JPShinjitaiCharactersRev.txt — 구자체→신자체(圖→図·讓→譲·廣→広).
//    npm opencc-data@1.4.1 (Apache-2.0, https://github.com/BYVoid/OpenCC 파생 데이터).
// 3. OpenCC STCharacters.txt — Unihan 후보의 정렬 순서로만 쓴다(빈도 순 — 첫 후보 = OpenCC
//    s2t 기본값). 후보를 더하지는 않는다: STCharacters 후보를 더하면 음 계열 매칭이
//    엉뚱한 옛 글자를 고른다(실측 2026-10-07: 术→朮 · 链→錬 · 闲→閒 · 鳄→鱷 · 吃→喫).
//    같은 npm opencc-data@1.4.1. hanjaTrad·hanjaKo 생성과 같은 채택 원천.
// 4. libhangul hanja.txt — 다중 정체 후보의 음 계열 매칭용(훈음 생성과 동일 소스·규칙).
// 5. Unihan kJoyoKanji · kJinmeiyoKanji — 일본 상용한자표(문화청 「常用漢字表」 2010년
//    내각 고시 제2호, 2,136자)와 인명용 한자(법무성 「戸籍法施行規則」 별표 제2, 2010 개정
//    이후 2015·2017 추가분 포함)를 Unicode가 수록한 속성. 두 목록은 고시·법령이라 일본
//    저작권법 제13조(법령·고시는 권리의 목적이 되지 않음)의 공공 목록이고, 이 파일은 1과 같은 Unicode
//    17.0.0 판(Unicode License v3)이다.
//    sha256 kJoyoKanji 1314ccb68ea733f3fe0a0d5c25f00209071cd2a5d9d9eddc0cbbce4cd1d34548 ·
//    kJinmeiyoKanji df509145fd8b99ffaa7f340524c160d7742e5b96ecd1137d5635545700ea2048.
//
// 일본 표준 한자 보존 규칙(2026-10-07 KST — 다대일 오류 수정):
//   원 글자 자체가 일본 상용한자(kJoyoKanji 전부 — 2010 본표 2,136자와 허용 자체 4자)이거나
//   인명용 한자 본 목록(kJinmeiyoKanji 중 값이 연도뿐인 행 — 「2010:U+XXXX」처럼 상용한자의
//   구자체로 등재된 행은 제외)이면 일본은 그 글자를 그대로 쓴다. 간체와 모양이 같은 일본
//   표준 한자를 다른 글자로 바꾸지 않는다(面→麺 · 了→瞭 · 千→韆 · 同→衕 · 合→閤 같은
//   다대일 오류 — 일본어 자료 글자 카드에서 面을 누르면 「日 麺」이 뜨던 결함).
//   예외: 원 글자가 OpenCC 구자체 목록(2)의 구자체 키이고 인명용(상용 아님)이면 신자체 쌍을
//   유지한다(遙→遥 · 祿→禄 — 같은 글자의 자체 차이이며 다른 글자로 바꾸는 것이 아니다).
//   생성 때 「보존 대상 글자는 표에 없거나 자기 자신(보존 표식)」을 검증한다(어긋나면 실패).
//
// 다중 정체 후보(一簡多繁) 선택 규칙(결정적):
//   후보 = Unihan kTraditionalVariant(수록 순).
//   ① 신자체 왕복 동형 우선 — 어떤 후보의 신자체가 원 글자와 같으면 동형(台→臺→台).
//   ② 음 계열 매칭 — hanjaKo 음과 같은 두음 계열의 후보(干'간'→幹'간', 乾'건' 배제).
//      훈음 줄에 표시되는 우리 음과 자형이 어긋나지 않게 하는 규칙. 동률이면
//      일본 표준 한자에 닿는 후보(众→衆, 眾 아님) → 신자체 매핑 보유 → 표준 한자끼리는
//      OpenCC STCharacters 빈도 순(历→歷→歴, 曆→暦 아님) → 수록 순.
//   ③ 잔여는 같은 순서의 첫 후보.
//   한계: 단어별 갈림(头发→頭髪 · 发展→発展, 以后→以後 · 皇后→皇后)은 글자 단위 매핑으로
//   원리상 불가 — 단어 어형은 사전 표기(AE-R3 日 줄 — 확인된 표기)가 담당한다.
//   계산한 단어 꼴(OpenCC 구절 경유)은 실측상 다른 오류(了解→瞭解 · 布→佈 · 赞→讚)를 낳아 쓰지 않는다.
//
// 저장 규칙: 원 글자와 자형이 다를 때만 수록(diff-only) — 파일 소형·표시부는 폴백 그대로.
// 예외는 보존 표식(아래 — 일본 표준 한자 중 번체 경유 사슬이 다른 글자로 닿는 것만 자기 자신).
//
// 재생성(Node 22 — src/lib/data/README.md):
//   node scripts/generate-hanja-ja.mjs <kTraditionalVariant.txt> <JPShinjitaiCharactersRev.txt> \
//     <libhangul-hanja.txt> <STCharacters.txt> <kJoyoKanji.txt> <kJinmeiyoKanji.txt>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDueum } from '../src/lib/hanjaKo.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [ktvPath, revPath, libhangulPath, stPath, joyoPath, jinmeiyoPath] = process.argv.slice(2);
if (!ktvPath || !revPath || !libhangulPath || !stPath || !joyoPath || !jinmeiyoPath) {
  console.error('사용법: node scripts/generate-hanja-ja.mjs <kTraditionalVariant.txt> <JPShinjitaiCharactersRev.txt> <libhangul-hanja.txt> <STCharacters.txt> <kJoyoKanji.txt> <kJinmeiyoKanji.txt>');
  process.exit(1);
}

const koTable = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/hanjaKo.json'), 'utf8'));
const fromHex = (h) => String.fromCodePoint(parseInt(h.replace(/^U\+/, ''), 16));

/**
 * Unihan 속성 행 → Map(글자 → 값). 속성별 파일("4E00..4E01\t2010")과
 * Unihan.zip 형식("U+4E00\tkJoyoKanji\t2010")을 모두 읽는다.
 */
function readUnihan(file, field) {
  const map = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    if (cols.length === 3 && cols[1] !== field) continue;
    const [range, value] = cols.length === 3 ? [cols[0], cols[2]] : cols;
    if (!range || !value) continue;
    const [a, b] = range.split('..').map((h) => parseInt(h.replace(/^U\+/, ''), 16));
    for (let c = a; c <= (b ?? a); c++) map.set(String.fromCodePoint(c), value.trim());
  }
  return map;
}

// 간체 → 정체 후보들(Unihan, 자기 자신 제외, 파일 수록 순 유지)
const unihanTrad = new Map();
for (const [ch, value] of readUnihan(ktvPath, 'kTraditionalVariant')) {
  const targets = value.split(/\s+/).map(fromHex).filter((t) => t !== ch);
  if (targets.length) unihanTrad.set(ch, targets);
}

// 간체 → 정체 후보들(OpenCC STCharacters — 빈도 순, 같은 키는 앞 행 우선)
const stTrad = new Map();
for (const line of fs.readFileSync(stPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [k, v] = line.split('\t');
  if (!k || !v || [...k].length !== 1 || stTrad.has(k)) continue;
  stTrad.set(k, v.trim().split(/\s+/).filter((t) => t && t !== k));
}

// 구자체 → 신자체 (OpenCC, 탭 구분)
const rev = new Map();
for (const line of fs.readFileSync(revPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [oldForm, newForm] = line.split('\t');
  if (oldForm && newForm && [...oldForm].length === 1) rev.set(oldForm, newForm.trim().split(/\s+/)[0]);
}

// 일본 표준 한자 — 상용(전부)과 인명용 본 목록(상용 구자체로 등재된 「연도:U+」 행 제외)
const joyo = new Set(readUnihan(joyoPath, 'kJoyoKanji').keys());
const jinmeiyo = new Set(
  [...readUnihan(jinmeiyoPath, 'kJinmeiyoKanji')].filter(([, v]) => /^\d{4}$/.test(v)).map(([k]) => k),
);
if (joyo.size !== 2140) throw new Error(`kJoyoKanji 행 수가 다르다: ${joyo.size} (기대 2,136 + 허용 자체 4)`);
const isStandard = (ch) => joyo.has(ch) || jinmeiyo.has(ch);
// 구자체 키 = OpenCC 쌍에서 다른 신자체로 가는 글자(庄\t庄 같은 자기 행은 구자체가 아니다)
const isOldForm = (ch) => rev.has(ch) && rev.get(ch) !== ch;
const keepsOwnForm = (ch) => joyo.has(ch) || (jinmeiyo.has(ch) && !isOldForm(ch));

// 글자 → 음들(libhangul) — 다중 정체 후보의 음 계열 매칭용
const eums = new Map();
for (const line of fs.readFileSync(libhangulPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [eum, ch] = line.split(':');
  if (!eum || !ch || [...ch].length !== 1) continue;
  if (!eums.has(ch)) eums.set(ch, new Set());
  eums.get(ch).add(eum);
}

const sameFamily = (a, b) => a === b || applyDueum(a) === applyDueum(b);

const out = {};
for (const ch of Object.keys(koTable)) {
  if (keepsOwnForm(ch)) continue; // 일본 표준 한자는 그 글자 그대로(面·了·同·合)
  let ja;
  if (rev.has(ch)) {
    ja = rev.get(ch); // 본문이 구자체(정체)로 온 경우: 圖→図
  } else {
    const cands = unihanTrad.get(ch) || [];
    if (!cands.length) continue; // 정체 매핑 없음 = 이미 정체·일본식과 동형 취급
    // ① 어떤 후보의 신자체가 원 글자면 동형(台→臺→台) — 일본도 같은 자형을 쓴다
    if (cands.some((t) => (rev.get(t) || t) === ch)) continue;
    // ② 음 계열 매칭(干'간'→幹) → 동률이면 일본 표준 한자에 닿는 후보 → 신자체 매핑 보유
    //    → (표준 한자끼리는) OpenCC 빈도 순 → ③ Unihan 수록 순
    const myEum = koTable[ch];
    const matched = cands.filter((t) => [...(eums.get(t) || [])].some((e) => sameFamily(e, myEum)));
    const freq = stTrad.get(ch) || [];
    const rank = (t) => (freq.includes(t) ? freq.indexOf(t) : freq.length);
    const std = (t) => (isStandard(rev.get(t) || t) ? 1 : 0);
    const pool = (matched.length ? matched : cands).map((t, i) => [t, i]).sort((x, y) =>
      std(y[0]) - std(x[0]) ||
      (rev.has(y[0]) ? 1 : 0) - (rev.has(x[0]) ? 1 : 0) ||
      (std(x[0]) ? rank(x[0]) - rank(y[0]) : 0) ||
      x[1] - y[1]).map(([t]) => t);
    const trad = pool[0];
    ja = rev.get(trad) || trad; // 图→圖→図, 师→師(신자체표 미수록 = 정체가 곧 일본식)
  }
  if (ja && ja !== ch) out[ch] = ja;
}

// 보존 표식: 보존 대상 글자 중 번체 후보가 다른 일본 자형을 가진 글자(面 → 麵 → 麺)는
// 자기 자신으로 적는다(面:'面'). 글자 카드의 번체 경유 사슬(charEtym.jaOfTrad)이 이 표식을
// 보고 멈춘다 — 표식이 없으면 面 카드에 「日 麺」이 사슬로 다시 뜬다.
const table = {};
for (const ch of Object.keys(koTable)) {
  if (out[ch]) table[ch] = out[ch];
  else if (keepsOwnForm(ch) && (unihanTrad.get(ch) || []).some((t) => out[t] && out[t] !== ch)) table[ch] = ch;
}
const marks = Object.entries(table).filter(([k, v]) => k === v).length;
// 생성 검증(규칙이 나중에 바뀌어도): 보존 대상 글자는 표에 없거나 자기 자신이어야 한다.
const kept = Object.entries(table).filter(([k, v]) => keepsOwnForm(k) && v !== k).map(([k, v]) => `${k}→${v}`);
if (kept.length) throw new Error(`일본 표준 한자가 다른 글자로 바뀌었다: ${kept.join(' ')}`);

const dest = path.join(root, 'src/lib/data/hanjaJa.json');
fs.writeFileSync(dest, JSON.stringify(table));
console.log(
  `hanjaJa.json 생성 — 자형 상이 ${Object.keys(out).length}자 + 보존 표식 ${marks}자, ` +
  `${(fs.statSync(dest).size / 1024).toFixed(0)}KB`
);
