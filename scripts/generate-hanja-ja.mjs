// 한자→일본식 자형(신자체) 정적 테이블 생성 — 옵트인 '한자 대조' 자형 표시(오너 확정:
// 간체보다 일본식 표기가 익숙하므로 훈음 줄 글자를 일본식 단독으로 교체).
//
// 변환 경로: 간체 → 정체(Unihan kTraditionalVariant, 훈음 생성과 동일 소스) → 신자체
// (OpenCC 구자체→신자체 402쌍). 일본이 정체형을 그대로 쓰는 글자(師 등)는 정체가 곧
// 일본식이고, 일본 비상용 한자는 정체(=한국 정자 계열)로 폴백된다 — 간체보다 친숙.
//
// 소스(오너 지시 외부 소스 재검토로 확정):
// 1. Unihan kTraditionalVariant — 간체→정체. Unicode License.
// 2. OpenCC JPShinjitaiCharactersRev.txt — 구자체→신자체 402쌍(圖→図·讓→譲·廣→広).
//    npm opencc-data@1.4.1 (Apache-2.0, https://github.com/BYVoid/OpenCC 파생 데이터).
// 3. libhangul hanja.txt — 다중 정체 후보의 음 계열 매칭용(훈음 생성과 동일 소스·규칙).
//
// 다중 정체 후보(一簡多繁) 선택 규칙(결정적):
//   ① 신자체 왕복 동형 우선 — 어떤 후보의 신자체가 원 글자와 같으면 동형(台→臺→台).
//   ② 음 계열 매칭 — hanjaKo 음과 같은 두음 계열의 후보(干'간'→幹'간', 乾'건' 배제).
//      훈음 줄에 표시되는 우리 음과 자형이 어긋나지 않게 하는 규칙. 동률이면 신자체
//      매핑이 있는 쪽 → 수록 순.
//   ③ 잔여는 수록 순 첫 후보(코드포인트 순).
//   한계: 단어별 갈림(干杯→乾杯)은 글자 단위 매핑으로 원리상 불가 — 단어 어형은 사전
//   日 줄이 담당한다(역할 분담).
//
// 저장 규칙: 원 글자와 자형이 다를 때만 수록(diff-only) — 파일 소형·표시부는 폴백 그대로.
//
// 재생성: node scripts/generate-hanja-ja.mjs <kTraditionalVariant.txt> <JPShinjitaiCharactersRev.txt> <libhangul-hanja.txt>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDueum } from '../src/lib/hanjaKo.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [ktvPath, revPath, libhangulPath] = process.argv.slice(2);
if (!ktvPath || !revPath || !libhangulPath) {
  console.error('사용법: node scripts/generate-hanja-ja.mjs <kTraditionalVariant.txt> <JPShinjitaiCharactersRev.txt> <libhangul-hanja.txt>');
  process.exit(1);
}

const koTable = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/hanjaKo.json'), 'utf8'));

// 간체 → 정체 후보들(자기 자신 제외, 파일 수록 순 유지)
const toTrad = new Map();
for (const line of fs.readFileSync(ktvPath, 'utf8').split('\n')) {
  const m = line.match(/^U\+[0-9A-F]+\s+(\S+)\tkTraditionalVariant\t(.+)$/);
  if (!m) continue;
  const ch = m[1];
  const targets = [...m[2].matchAll(/U\+([0-9A-F]+)/g)]
    .map((t) => String.fromCodePoint(parseInt(t[1], 16)))
    .filter((t) => t !== ch);
  if (targets.length) toTrad.set(ch, targets);
}

// 구자체 → 신자체 (OpenCC, 탭 구분)
const rev = new Map();
for (const line of fs.readFileSync(revPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [oldForm, newForm] = line.split('\t');
  if (oldForm && newForm && [...oldForm].length === 1) rev.set(oldForm, newForm.trim().split(/\s+/)[0]);
}

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
  let ja;
  if (rev.has(ch)) {
    ja = rev.get(ch); // 본문이 구자체(정체)로 온 경우: 圖→図
  } else {
    const cands = toTrad.get(ch) || [];
    if (!cands.length) continue; // 정체 매핑 없음 = 이미 정체·일본식과 동형 취급
    // ① 어떤 후보의 신자체가 원 글자면 동형(台→臺→台) — 일본도 같은 자형을 쓴다
    if (cands.some((t) => (rev.get(t) || t) === ch)) continue;
    // ② 음 계열 매칭(干'간'→幹) → 동률이면 신자체 매핑 보유 우선 → ③ 수록 순
    const myEum = koTable[ch];
    const matched = cands.filter((t) => [...(eums.get(t) || [])].some((e) => sameFamily(e, myEum)));
    const pool = matched.length ? matched : cands;
    const trad = pool.find((t) => rev.has(t)) || pool[0];
    ja = rev.get(trad) || trad; // 图→圖→図, 师→師(신자체표 미수록 = 정체가 곧 일본식)
  }
  if (ja && ja !== ch) out[ch] = ja;
}

const dest = path.join(root, 'src/lib/data/hanjaJa.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(
  `hanjaJa.json 생성 — ${Object.keys(out).length}자(자형 상이만 수록), ` +
  `${(fs.statSync(dest).size / 1024).toFixed(0)}KB`
);
