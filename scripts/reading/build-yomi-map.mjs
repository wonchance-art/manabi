#!/usr/bin/env node
/**
 * build-yomi-map — 신뢰본 n5_tokyo.js(P4 감사·교정 완료)에서 기대 독음 사전(표면형 맵)을 생성한다.
 *
 * ⚠ 강등(P1-1·P1-2·P2-5): 이 맵(G7)은 이제 **보조 진단**이다. 주 게이트는 문장 단위 요미 락
 *   (build-yomi-lock.mjs → yomi-lock.json, check-reading의 YLOCK)이다. 표면형 맵은 구조적 구멍
 *   3종(가나-온리 문장 무검사 / 오쿠리가나·문맥 독음 미구분: 来ます→くます 통과 / 정렬 아티팩트 오염:
 *   建物→たても)을 남기므로 검증 게이트로는 부족하다. G7은 check-reading에서 경고로만 뜨며,
 *   **신규 문장 초안 작성 시 한자별 허용 독음을 참고**하는 진단 용도로만 유지한다(완전 삭제 금지).
 *
 * 헌법: 요미는 사람이 손으로 쓰지 않는다. 이 스크립트는 이미 검증된 트랙의
 * body 문장을 check-furigana의 정렬 로직(align-furigana.cjs 재사용)으로 분해해
 * "한자 표면형 → 검증된 요미" 대응만 뽑아 scripts/reading/yomi-map.json으로 고정한다.
 *
 * 산출: { "表面形": ["요미1", "요미2", ...] }
 *   - 복수 문맥 독음(何 → なん·なに)은 배열로 함께 담는다.
 *   - 숫자+조수사 복합(九時十分·三百五番)은 패턴 일반화 없이 "표면형 그대로" 한 항목.
 *     정렬이 한자 연속 구간을 통째로 한 표면형으로 잡으므로 자연히 그대로 저장된다.
 *
 * 이 맵은 check-reading.mjs의 G7(기대 독음) 검사가 소비한다: 전 body를 같은 정렬로
 * 분해해 각 표면형 요미가 맵 허용치 중 하나여야 통과. 맵 미등재 표면형 = 오류(사람 게이트).
 *
 * 실행: node scripts/reading/build-yomi-map.mjs
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { extractReadings } = require('./align-furigana.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'yomi-map.json');
const TRACK_URL = new URL('../../src/content/japanese/reading/n5_tokyo.js', import.meta.url);

async function main() {
  const track = (await import(TRACK_URL)).default;
  const texts = Array.isArray(track?.texts) ? track.texts : [];

  const map = new Map(); // surface → Set<reading>
  const fails = [];      // 정렬 불가 문장(맵 신뢰 불가 → 빌드 실패)
  let sentences = 0, aligned = 0;

  for (const t of texts) {
    for (const b of (t.body || [])) {
      if (!b.ja || !b.yomi) continue; // narr(한국어 서술)·요미 부재는 대상 아님
      sentences++;
      const { ok, status, readings } = extractReadings(b.ja, b.yomi);
      if (!ok) { fails.push({ order: t.order, ja: b.ja, yomi: b.yomi }); continue; }
      if (status === 'ALIGNED') aligned++;
      for (const { surface, reading } of readings) {
        if (!map.has(surface)) map.set(surface, new Set());
        map.get(surface).add(reading);
      }
    }
  }

  if (fails.length) {
    console.error(`✗ 정렬 불가 ${fails.length}건 — 맵 신뢰 불가, 생성 중단:`);
    for (const f of fails) console.error(`   글${f.order}  ja:${f.ja}  yomi:${f.yomi}`);
    process.exit(1);
  }

  // 표면형·요미 모두 정렬해 결정적 출력(diff 안정)
  const out = {};
  for (const surface of [...map.keys()].sort()) out[surface] = [...map.get(surface)].sort();

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

  const multi = Object.entries(out).filter(([, v]) => v.length > 1);
  console.log(`기대 독음 사전 생성 → ${path.relative(path.join(__dirname, '..', '..'), OUT)}`);
  console.log(`  문장 ${sentences}개(정렬 ${aligned}) · 표면형 ${Object.keys(out).length}개`);
  if (multi.length) {
    console.log(`  복수 독음 표면형 ${multi.length}개:`);
    for (const [k, v] of multi) console.log(`    ${k} → ${v.join(' / ')}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
