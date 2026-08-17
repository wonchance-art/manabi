// 한자→한국식 훈(뜻) 정적 테이블 생성 — 옵트인 '한자 대조' 훈음 병기(오너 승인 ①) 데이터.
// 기존 hanjaKo.json(자→음, npm hanja)은 그대로 두고 훈만 오버레이한다(회귀 0 설계).
//
// 소스(외부 소스 재검토로 확정 — Gemini 생성안 대체):
// 1. libhangul hanja.txt — 한국어 IME 생태계 표준 사전. 단일 글자 행(음:字:훈음 주석)
//    ~7,757자에 훈음("늙을 노, 늙은이 노")이 실려 있다. 간체 행(师 등)은 음만 있고
//    훈 주석이 비어 있으므로 2로 메운다.
//    https://raw.githubusercontent.com/libhangul/libhangul/master/data/hanja/hanja.txt
//    Copyright (c) 2005,2006 Choe Hwanjin — BSD 3-Clause. 고지: 본 산출물(hanjaHun.json)은
//    위 사전의 훈음 필드에서 파생되었다. 라이선스 전문은 원본 파일 헤더 참조.
// 2. Unihan kTraditionalVariant — 간체→정체 매핑(学→學)으로 정체의 훈을 간체에 상속.
//    unicode.org 직접 egress가 막힌 환경이므로 Unihan_Variants.txt에서 추출한 미러 사본을
//    사용한다(형식: "U+5B66 学\tkTraditionalVariant\tU+5B78"). Unicode License v3.
//
// 결정성: 두 소스 파일 경로를 인자로 받는 오프라인 생성 — 산출물은 커밋한다.
// 다음자 선택 규칙(결정적): hanjaKo.json의 음과 같은 두음 계열(로/노, 락/낙) 행만 후보로,
// ① 두음 적용형 행(老의 '노' 행 → "늙을") ② 본음 행 ③ 계열 내 첫 행 순서로 고른다 —
// 한국 옥편 표제 관례('늙을 로(노)')와 오너 예시에 맞춘 우선순위다.
//
// 재생성: node scripts/generate-hanja-hun.mjs <libhangul-hanja.txt> <kTraditionalVariant.txt>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDueum } from '../src/lib/hanjaKo.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [libhangulPath, ktvPath] = process.argv.slice(2);
if (!libhangulPath || !ktvPath) {
  console.error('사용법: node scripts/generate-hanja-hun.mjs <libhangul-hanja.txt> <kTraditionalVariant.txt>');
  process.exit(1);
}

const koTable = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/hanjaKo.json'), 'utf8'));

// 1) libhangul 단일 글자 훈음 행 수집 — char → [{eum, hun}...]
const rows = new Map();
for (const line of fs.readFileSync(libhangulPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [eum, ch, comment] = line.split(':');
  if (!eum || !ch || !comment || [...ch].length !== 1) continue;
  // 훈음 주석 "늙을 노, 늙은이 노" — 첫 항목의 끝 어절이 음과 일치할 때만 훈으로 신뢰
  const first = comment.split(',')[0].trim();
  const words = first.split(/\s+/);
  if (words.length < 2 || words[words.length - 1] !== eum) continue;
  const hun = words.slice(0, -1).join(' ');
  if (!rows.has(ch)) rows.set(ch, []);
  rows.get(ch).push({ eum, hun });
}

// 2) kTraditionalVariant — 간체 → 정체 후보들(자기 자신 제외)
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

/** 음 계열 일치 행에서 훈 선택 — 두음형 행 → 본음 행 → 계열 첫 행. */
function pickHun(candidates, tableEum) {
  if (!candidates?.length) return null;
  const dueum = applyDueum(tableEum);
  const family = candidates.filter(
    (r) => r.eum === tableEum || applyDueum(r.eum) === dueum
  );
  if (!family.length) return null;
  const byDueum = family.find((r) => r.eum === dueum);
  const byBase = family.find((r) => r.eum === tableEum);
  return (byDueum || byBase || family[0]).hun;
}

// 3) hanjaKo.json의 전 글자에 대해 훈 결정 — 자기 행 → 정체 상속 순
const out = {};
let direct = 0;
let inherited = 0;
for (const [ch, tableEum] of Object.entries(koTable)) {
  let hun = pickHun(rows.get(ch), tableEum);
  if (hun) {
    direct++;
  } else {
    for (const trad of toTrad.get(ch) || []) {
      hun = pickHun(rows.get(trad), tableEum);
      if (hun) { inherited++; break; }
    }
  }
  if (hun) out[ch] = hun;
}

const dest = path.join(root, 'src/lib/data/hanjaHun.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(
  `hanjaHun.json 생성 — ${Object.keys(out).length}자(직접 ${direct} + 정체 상속 ${inherited}), ` +
  `${(fs.statSync(dest).size / 1024).toFixed(0)}KB`
);
