// 중국어 경성(轻声) 사전 CEDICT 층 생성기 (분석 개선 R2 — 오너 승인 2026-08-29).
//
// 원천: CC-CEDICT (© MDBG, https://www.mdbg.net/chinese/dictionary?page=cc-cedict)
//   — 라이선스 CC BY-SA 4.0 (상업 사용 가능·출처 표기 의무). 조달은 npm 패키지
//   cedict-json@1.3.20251213 (2025-12-13자 스냅샷, JSON 변환본)의 cedict.json.
//   실행: node scripts/build-zh-neutral-tone.mjs --cedict <cedict.json 경로>
//   출력: src/lib/server/data/zhNeutralToneCedict.json (정렬 고정 — 결정성)
//
// 수제 사전(zhNeutralTone.js)의 등재 기준 3종을 그대로 기계화한다:
// ① 라이브러리(pinyin-pro, 앱과 같은 버전)가 이미 맞게 내는 어휘는 싣지 않는다
//    — 단어 단위 실측 대조로 걸러 오버라이드 표를 최소로 유지.
// ② 같은 표제어에 서로 다른 독음이 병존(5성/비5성 다의어 포함)하면 배제
//    — 地道(dì dao/dì dào)류. 틀릴 수 있는 건 안 싣는다.
// ③ 방향보어(V+来/去/起/上/下/进/出/回/过/开 경성)와 접미 边은 가벼운 읽기
//    (可轻读) 논쟁권이라 배제 — 수제 v1 정책 유지.
// 추가 기계 필터: 고유명사(병음 대문자)·얼화(r5 음절 — 后儿 hòu r처럼 글자수가
// 우연히 맞아도 儿 병음을 표현할 수 없다)·비한자 표제어·음절수≠글자수·
// 표제어 5자 이상(속담·잡복합어 — jieba 토큰 실현성 낮고 성어는 4자까지) 배제.
// 수제 층이 항상 이긴다(zhNeutralTone.js에서 {...CEDICT, ...수제}로 병합).

import fs from 'node:fs';
import path from 'node:path';
import { pinyin } from 'pinyin-pro';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const cedictPath = arg('cedict');
if (!cedictPath) {
  console.error('사용법: node scripts/build-zh-neutral-tone.mjs --cedict <cedict.json>');
  process.exit(1);
}

const HANZI_ONLY = /^[一-鿿]+$/;
// 성조 숫자 병음 → 기호 병음. 5(또는 0) = 경성(무표기). ü는 u:/v 표기 병존.
const TONE_MARKS = {
  a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ',
};
function syllableToSymbol(syl) {
  const m = syl.match(/^([a-zü:]+)([0-5])$/i);
  if (!m) return null; // 예상 밖 형식(r5는 상류에서 배제) — 항목 통째 폐기 신호
  let body = m[1].toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const tone = Number(m[2]);
  if (tone === 5 || tone === 0) return body;
  // 표기 위치 규칙: a > e > ou의 o > 마지막 모음
  const pick = body.includes('a') ? 'a'
    : body.includes('e') ? 'e'
    : body.includes('ou') ? 'o'
    : [...body].reverse().find((c) => 'aeiouü'.includes(c));
  if (!pick) return null;
  const idx = body.lastIndexOf(pick === 'a' ? 'a' : pick === 'e' ? 'e' : pick);
  return body.slice(0, idx) + TONE_MARKS[pick][tone - 1] + body.slice(idx + 1);
}

// ③ 방향보어·접미 边 — 말미 경성이 이 글자면 배제
const DIRECTIONAL_TAIL = new Set([...'来去起上下进出回过开边']);

const raw = JSON.parse(fs.readFileSync(cedictPath, 'utf8'));

// 표제어(간체) → 독음 집합(원문 병음 그대로) — ② 판정용
const readings = new Map();
for (const e of raw) {
  const w = e.simplified;
  if (!HANZI_ONLY.test(w)) continue;
  if (!readings.has(w)) readings.set(w, new Set());
  readings.get(w).add(e.pinyin.toLowerCase());
}

const stats = { candidates: 0, polyphony: 0, proper: 0, malformed: 0, directional: 0, libCorrect: 0, kept: 0 };
const out = {};
for (const e of raw) {
  const w = e.simplified;
  const chars = [...w];
  if (!HANZI_ONLY.test(w) || chars.length < 2 || chars.length > 4) continue;
  const syls = e.pinyin.split(/\s+/);
  if (!syls.some((s) => /[50]$/.test(s))) continue; // 경성 미포함
  stats.candidates++;
  if (/[A-Z]/.test(e.pinyin)) { stats.proper++; continue; }         // 고유명사
  if (readings.get(w).size > 1) { stats.polyphony++; continue; }    // ② 다의어
  if (syls.some((s) => /^r[50]$/i.test(s))) { stats.malformed++; continue; } // 얼화
  if (syls.length !== chars.length) { stats.malformed++; continue; } // 이형
  const lastSyl = syls[syls.length - 1];
  if (/[50]$/.test(lastSyl) && DIRECTIONAL_TAIL.has(chars[chars.length - 1])) {
    stats.directional++; continue;                                   // ③ 방향보어·边
  }
  const converted = syls.map(syllableToSymbol);
  if (converted.some((s) => !s)) { stats.malformed++; continue; }
  const value = converted.join(' ');
  // ① 라이브러리 정답분 제외 — 앱과 같은 pinyin-pro 단어 호출로 실측 대조
  const lib = pinyin(w, { toneType: 'symbol', type: 'string' });
  if (lib === value) { stats.libCorrect++; continue; }
  out[w] = value;
  stats.kept++;
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, 'zh')));
const outPath = path.join(process.cwd(), 'src/lib/server/data/zhNeutralToneCedict.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(sorted, null, 1) + '\n');

console.log('경성 후보(경성 음절 포함 한자어):', stats.candidates);
console.log(' 배제 — 고유명사:', stats.proper, '/ 다의어(②):', stats.polyphony,
  '/ 얼화·이형:', stats.malformed, '/ 방향보어·边(③):', stats.directional,
  '/ 라이브러리 정답(①):', stats.libCorrect);
console.log('등재:', stats.kept, '→', outPath);
// 스팟 프로브 — 수제 층과의 정합(값이 같아야 정상: 수제가 이기지만 어긋나면 조사)
for (const w of ['怪不得', '朋友', '知道', '地道', '东西']) {
  console.log(' 스팟', w, '=', sorted[w] ?? '(미등재)');
}
