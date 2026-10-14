#!/usr/bin/env node
/**
 * 「그림 한 장 읽기」 카탈로그 빌드 (ART-AUTO-1, 설계 docs/design/art-pipeline.md ③-4). 네트워크를 쓰지 않는다.
 * src/content/art/entries/(사람이 쓰는 필드 + 고른 출처 id) + sources/(원 응답 스냅샷) → works.json(기계 필드 생성).
 *
 * 실행(리포 루트):
 *   node scripts/build-art.mjs           works.json 쓰기(바뀐 것만)
 *   node scripts/build-art.mjs --check   쓰지 않고 검사만 — 스냅샷 없음·그림 파일 해시 불일치·해설 계약 위반(내부 메모·읽기 표시·길이)·
 *                                        works.json 낡음이면 exit 1. prebuild가 돈다.
 * 스냅샷을 받는 일(네트워크)은 scripts/art/snapshot-sources.mjs가 한다. 절차는 src/content/art/README.md 「작품 추가 절차」.
 */
// 제품 모듈(src/lib)은 번들러식 확장자 없는 import를 쓴다 — Node가 풀 수 있게 훅을 먼저 등록한다(build-literature와 같은 훅).
import './eval/productImportHooks.mjs';

const check = process.argv.includes('--check');
const { buildArt, ART_ROOT } = await import('./lib/art-build.mjs');
const result = await buildArt({ check });

if (result.errors.length) {
  console.error(`✗ 그림 카탈로그 빌드 실패 ${result.errors.length}건`);
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`✓ 그림 카탈로그 ${check ? '검사' : '빌드'} 통과 — ${ART_ROOT} ${result.works}점 · 해설 ${result.descriptions} · 그림 ${result.images} (works.json ${result.status})`);
