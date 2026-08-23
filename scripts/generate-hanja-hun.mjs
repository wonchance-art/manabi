// 한자→한국식 훈(뜻) 정적 테이블 생성 — 옵트인 '한자 대조' 훈음 병기 데이터.
// hanjaKo.json(자→음)을 먼저 생성한 뒤 실행한다(음 계열 필터가 교정된 음을 쓴다).
//
// 소스:
// 1. libhangul hanja.txt — 한국어 IME 생태계 표준 사전. 단일 글자 행(음:字:훈음 주석)에
//    훈음("늙을 노, 늙은이 노")이 실려 있다. BSD 3-Clause (Choe Hwanjin). 고지: 본
//    산출물(hanjaHun.json)은 위 사전의 훈음 필드에서 파생되었다.
//    https://raw.githubusercontent.com/libhangul/libhangul/master/data/hanja/hanja.txt
// 2. OpenCC STCharacters.txt — 간체→정체 매핑(npm opencc-data@1.4.1, Apache-2.0).
//    초판이 쓰던 Unihan kTraditionalVariant 미러의 재확보가 어려워 교체했다(2026-08-23
//    '훈음 데이터 3층 보수') — hanjaJa 생성이 이미 채택한 원천이라 라이선스·유지 검토 동일.
// 3. scripts/hanja-curated.mjs — 한국 정자 이체 맵(清→淸·教→敎 등)·수기 훈(전량 감수).
//
// 훈 추출 규칙(2026-08-23 보수 — 초판은 첫 콤마 항목만 신뢰해 "牀의 俗字, 평상 상" 같은
// 행의 훈을 놓쳤다): 행의 모든 콤마 항목을 순서대로 보고, 끝 어절이 목표 음과 일치하는
// 첫 항목을 훈으로 채택한다(同字/俗字/本字 참조 항목은 자연 탈락).
// 다음자 선택(결정적): ① 두음 적용형 항목(老의 '노' → "늙을") ② 본음 항목 ③ 계열 항목
// 순 — 한국 옥편 표제 관례('늙을 로(노)') 우선순위 유지.
// 조회 순서: 자기 행(+한국 정자 이체 행) → 정체 후보 행(+그 이체 행). 마지막에 수기
// 훈(HUN_MANUAL)이 자동 결과를 덮는다.
//
// 재생성: node scripts/generate-hanja-hun.mjs <libhangul-hanja.txt> <STCharacters.txt>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDueum } from '../src/lib/hanjaKo.js';
import { KR_VARIANTS, HUN_MANUAL } from './hanja-curated.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [libhangulPath, stPath] = process.argv.slice(2);
if (!libhangulPath || !stPath) {
  console.error('사용법: node scripts/generate-hanja-hun.mjs <libhangul-hanja.txt> <STCharacters.txt>');
  process.exit(1);
}

const koTable = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/hanjaKo.json'), 'utf8'));

// 1) libhangul 행 수집 — char → [{eum, items:[콤마 항목...]}]
const rows = new Map();
for (const line of fs.readFileSync(libhangulPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [eum, ch, comment] = line.split(':');
  if (!eum || !ch || [...ch].length !== 1) continue;
  const items = (comment || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!rows.has(ch)) rows.set(ch, []);
  rows.get(ch).push({ eum, items });
}

// 2) OpenCC 간체→정체 후보들
const st = new Map();
for (const line of fs.readFileSync(stPath, 'utf8').split('\n')) {
  const [s, ts] = line.split('\t');
  if (s && ts && [...s].length === 1) st.set(s, ts.trim().split(' '));
}

/** 글자의 후보 행 — 자기 행 + 한국 정자 이체 행. */
function rowsOf(ch) {
  const own = rows.get(ch) || [];
  const kr = KR_VARIANTS[ch] ? rows.get(KR_VARIANTS[ch]) || [] : [];
  return [...own, ...kr];
}

/** 항목 끝 어절이 target 음일 때 훈을 반환. */
function hunFromItem(item, target) {
  const words = item.split(/\s+/);
  if (words.length < 2 || words[words.length - 1] !== target) return null;
  return words.slice(0, -1).join(' ');
}

/** 음 계열 일치 항목에서 훈 선택 — 두음형 → 본음 → 계열 순(항목 단위 전수 스캔). */
function pickHun(cands, tableEum) {
  if (!cands?.length) return null;
  const dueum = applyDueum(tableEum);
  for (const pass of ['dueum', 'base', 'family']) {
    for (const r of cands) {
      for (const item of r.items) {
        let hit = null;
        if (pass === 'dueum') hit = hunFromItem(item, dueum);
        else if (pass === 'base') hit = hunFromItem(item, tableEum);
        else {
          const words = item.split(/\s+/);
          const last = words[words.length - 1];
          if (words.length >= 2 && (last === tableEum || applyDueum(last) === dueum)) {
            hit = words.slice(0, -1).join(' ');
          }
        }
        if (hit) return hit;
      }
    }
  }
  return null;
}

// 3) hanjaKo.json 전 글자에 대해 훈 결정 — 자기(+이체) 행 → 정체(+이체) 상속 → 수기
const out = {};
let direct = 0;
let inherited = 0;
let manual = 0;
for (const [ch, tableEum] of Object.entries(koTable)) {
  let hun = pickHun(rowsOf(ch), tableEum);
  if (hun) {
    direct++;
  } else {
    for (const trad of st.get(ch) || []) {
      hun = pickHun(rowsOf(trad), tableEum);
      if (hun) { inherited++; break; }
    }
  }
  if (HUN_MANUAL[ch]) {
    if (!hun) manual++;
    hun = HUN_MANUAL[ch];
  }
  if (hun) out[ch] = hun;
}

const dest = path.join(root, 'src/lib/data/hanjaHun.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(
  `hanjaHun.json 생성 — ${Object.keys(out).length}자(직접 ${direct} + 상속 ${inherited} + 수기 신규 ${manual}), ` +
  `${(fs.statSync(dest).size / 1024).toFixed(0)}KB`
);
