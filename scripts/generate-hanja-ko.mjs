// 한자→한국 한자음 정적 테이블 생성 — 옵트인 '한자 대조'(중국어 뷰어) 데이터.
// 소스: npm `hanja`(MIT, rockpicado/hanja)의 hanjaeum.json(27,497자 — 간체 직접 수록 실측:
// 师=사·图=도·让=양·汉=한). CJK 통합 메인 블록(U+4E00–9FFF)만 추출한다(20,902자).
//
// 음 교정 패스(2026-08-23 '훈음 데이터 3층 보수'): 간체 코드포인트가 한국 자전의
// 다른 글자와 동형이라 npm hanja가 엉뚱한 계보의 음을 실은 글자(达='체'·关='소' 등)를
// 바로잡는다. 뷰어에서 이 글자들은 항상 중국어 텍스트로 등장하므로 정체 계보의 음이
// 올바른 발음 앵커다. 규칙(결정적):
//   ① OpenCC STCharacters(간체→정체)로 정체 후보를 얻고, 후보(및 한국 정자 이체)의
//      libhangul 음과 현재 음이 같은 두음 계열이면 유지(师 '사'=師 '사' → 무변경).
//   ② 어느 후보와도 계열이 안 맞으면 첫 후보의 libhangul 대표음으로 교정(达 체→달).
//      대표음은 두음 본음 행 우선(량/양 병재 시 '량'), 그 외 수록 순.
//   ③ KO_EUM_MANUAL(수기 감수)이 최종 우선(撕 서→시 — ST 매핑이 없는 글자).
//   전 교정 내역을 stdout으로 출력한다(감수용).
//
// 소스 파일(오프라인 인자 — 네트워크 없는 결정적 생성, 산출물은 커밋):
//   libhangul hanja.txt  https://raw.githubusercontent.com/libhangul/libhangul/master/data/hanja/hanja.txt
//     (BSD 3-Clause, Choe Hwanjin)
//   STCharacters.txt     npm opencc-data@1.4.1 data/STCharacters.txt (Apache-2.0 — hanjaJa 생성과 같은 채택 원천)
//
// 재생성: node scripts/generate-hanja-ko.mjs <libhangul-hanja.txt> <STCharacters.txt>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDueum } from '../src/lib/hanjaKo.js';
import { KR_VARIANTS, KO_EUM_MANUAL } from './hanja-curated.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [libhangulPath, stPath] = process.argv.slice(2);
if (!libhangulPath || !stPath) {
  console.error('사용법: node scripts/generate-hanja-ko.mjs <libhangul-hanja.txt> <STCharacters.txt>');
  process.exit(1);
}

const src = JSON.parse(
  fs.readFileSync(path.join(root, 'node_modules/hanja/lib/data/hanjaeum.json'), 'utf8')
);

// libhangul 단일 글자 행 — char → [eum...] (수록 순, 중복 제거)
const eumRows = new Map();
for (const line of fs.readFileSync(libhangulPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [eum, ch] = line.split(':');
  if (!eum || !ch || [...ch].length !== 1) continue;
  if (!eumRows.has(ch)) eumRows.set(ch, []);
  if (!eumRows.get(ch).includes(eum)) eumRows.get(ch).push(eum);
}

// OpenCC 간체→정체 후보들
const st = new Map();
for (const line of fs.readFileSync(stPath, 'utf8').split('\n')) {
  const [s, ts] = line.split('\t');
  if (s && ts && [...s].length === 1) st.set(s, ts.trim().split(' '));
}

/** 글자의 libhangul 음 목록 — 한국 정자 이체까지 합쳐서. */
function eumsOf(ch) {
  const own = eumRows.get(ch) || [];
  const kr = KR_VARIANTS[ch] ? eumRows.get(KR_VARIANTS[ch]) || [] : [];
  return [...own, ...kr];
}

/** 대표음 선택 — 두음 본음 행 우선(량/양 병재 시 '량'), 그 외 수록 순. */
function representativeEum(eums) {
  if (!eums.length) return null;
  const base = eums.find((e) => applyDueum(e) !== e && eums.includes(applyDueum(e)));
  return base || eums[0];
}

const out = {};
let count = 0;
const corrections = [];
for (const [ch, reading] of Object.entries(src)) {
  const cp = ch.codePointAt(0);
  if (cp < 0x4e00 || cp > 0x9fff) continue; // 메인 블록 외(희귀 확장 한자) 제외
  if (typeof reading !== 'string' || !reading) continue;
  let eum = reading;
  const trads = st.get(ch);
  if (trads) {
    const dueum = applyDueum(eum);
    const familyMatch = trads.some((t) =>
      eumsOf(t).some((e) => e === eum || applyDueum(e) === dueum)
    );
    if (!familyMatch) {
      for (const t of trads) {
        const rep = representativeEum(eumsOf(t));
        if (rep) {
          corrections.push(`${ch} ${eum}→${rep} (${t})`);
          eum = rep;
          break;
        }
      }
    }
  }
  if (KO_EUM_MANUAL[ch] && KO_EUM_MANUAL[ch] !== eum) {
    corrections.push(`${ch} ${eum}→${KO_EUM_MANUAL[ch]} (수기)`);
    eum = KO_EUM_MANUAL[ch];
  }
  out[ch] = eum;
  count++;
}

const dest = path.join(root, 'src/lib/data/hanjaKo.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`hanjaKo.json 생성 — ${count}자, ${(fs.statSync(dest).size / 1024).toFixed(0)}KB`);
console.log(`음 교정 ${corrections.length}자:`);
for (const c of corrections) console.log('  ' + c);
