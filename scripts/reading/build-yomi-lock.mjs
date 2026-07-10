#!/usr/bin/env node
/**
 * build-yomi-lock — 신뢰본 n5_tokyo.js(P4 감사·전 오독 교정 완료)에서 문장 단위 요미 락을 생성한다.
 *
 * 왜 락파일인가(P1-1·P1-2·P2-5 통합 해법): 표면형 맵(G7)은 한자 표면형→요미 대응만 고정해
 * 구조적 구멍 3종을 남긴다 — ① 가나-온리 문장 무검사 ② 오쿠리가나·문맥 독음 미구분(来ます→くます 통과)
 * ③ 정렬 아티팩트가 맵에 허용값으로 오염(建物→たても). 문장 전체 요미를 통째로 락으로 박으면
 * 세 구멍이 한 번에 소멸한다: 아티팩트든 오쿠리가나든 가나-온리든 "그 문장의 요미가 이것"으로 고정되므로.
 *
 * 산출: scripts/reading/yomi-lock.json
 *   { "<text_id>#<body index>": { ja:<정규화 ja>, yomi:<정규화 yomi> } }
 *   - 키는 위치(글 id + body 배열 인덱스). 검증기가 같은 방식으로 키를 만들어 대조한다.
 *   - 정규화(normLock, align-furigana.cjs 공유): 카타카나→히라가나 + 공백·구두점 제거(한자·한글·ー 보존).
 *   - 가나-온리 문장 포함 ja+yomi를 가진 전 문장을 담는다(narr 서술만 있는 항목은 제외).
 *
 * 이 락은 check-reading.mjs의 YLOCK 게이트가 소비한다: 전 body 문장을 같은 정규화로 락과 대조.
 *   ① 락 미등재/수정 문장 = 오류(재생성+검수 강제) ② ja 같은데 yomi 불일치 = 오류 ③ 사라진 문장 = 경고.
 *
 * 실행: node scripts/reading/build-yomi-lock.mjs
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { normLock } = require('./align-furigana.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'yomi-lock.json');
const TRACK_URL = new URL('../../src/content/japanese/reading/n5_tokyo.js', import.meta.url);

async function main() {
  const track = (await import(TRACK_URL)).default;
  const texts = Array.isArray(track?.texts) ? track.texts : [];

  const out = {};
  const komixed = []; // 요미에 한글 섞임 — 락 신뢰 불가 → 빌드 실패
  let sentences = 0, kanaOnly = 0;

  for (const t of texts) {
    const body = t.body || [];
    for (let i = 0; i < body.length; i++) {
      const b = body[i];
      if (!b.ja || !b.yomi) continue; // narr(한국어 서술)·요미 부재는 문장이 아님
      sentences++;
      const ja = normLock(b.ja);
      const yomi = normLock(b.yomi);
      if (/[가-힣]/.test(ja) || /[가-힣]/.test(yomi)) { komixed.push({ id: t.id, i, ja: b.ja, yomi: b.yomi }); continue; }
      if (![...ja].some((c) => /[一-鿿々〆ヶ]/.test(c))) kanaOnly++;
      out[`${t.id}#${i}`] = { ja, yomi };
    }
  }

  if (komixed.length) {
    console.error(`✗ KO_MIXED(요미에 한글 섞임) ${komixed.length}건 — 락 신뢰 불가, 생성 중단:`);
    for (const f of komixed) console.error(`   ${f.id}#${f.i}  ja:${f.ja}  yomi:${f.yomi}`);
    process.exit(1);
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`문장 단위 요미 락 생성 → ${path.relative(path.join(__dirname, '..', '..'), OUT)}`);
  console.log(`  문장 ${sentences}개(가나-온리 ${kanaOnly} 포함) · 락 항목 ${Object.keys(out).length}개`);
}

main().catch((e) => { console.error(e); process.exit(1); });
