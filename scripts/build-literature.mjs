#!/usr/bin/env node
/**
 * 정본 문학책 빌드 — 青空文庫(설계 §3.1)와 Standard Ebooks(LIT-SRC-EN-1, scripts/lib/standard-ebooks-build.mjs). 아오조라 작품 폴더 src/content/literature/aozora/<workKey>/의
 * source.txt(UTF-8 변환본) + entry.json(카탈로그·권리)을 chapters.json(장별 raw_text·루비 잠금·크레딧)으로 만든다.
 *
 * 실행(리포 루트):
 *   node scripts/build-literature.mjs           chapters.json 쓰기(바뀐 것만)
 *   node scripts/build-literature.mjs --check   쓰지 않고 검사만 — 권리 미승인·원문 해시 불일치·미해결 외자·파서 경고·
 *                                               chapters.json 낡음이면 exit 1. 작품 0편이면 통과(no-op).
 * 루트에 index.generated.js(게시 API용 책 목록)·manifest.generated.json(뷰어 정본 대조표)도 만든다(--check가 함께 검사).
 * 게시(공개 reading_materials 삽입·관리자 1회 분석)는 이 스크립트가 하지 않는다 — 관리자 → 📚 정본 문학책(/api/admin/literature).
 */
// 제품 모듈(src/lib)은 번들러식 확장자 없는 import를 쓴다 — Node가 풀 수 있게 훅을 먼저 등록한다(eval 스크립트와 같은 훅 재사용).
import './eval/productImportHooks.mjs';

const check = process.argv.includes('--check');
const { buildLiterature, LITERATURE_ROOT } = await import('./lib/literature-build.mjs');
const { buildStandardEbooks, STANDARD_EBOOKS_ROOT } = await import('./lib/standard-ebooks-build.mjs');
const { buildWikisource, WIKISOURCE_ROOT } = await import('./lib/wikisource-build.mjs');
const { buildPdSite, PDSITE_ROOT } = await import('./lib/pdsite-build.mjs');
// 정본 문학책은 출처마다 폴더·빌드가 따로다(青空文庫 · Standard Ebooks — LIT-SRC-EN-1 · Wikisource — LIT-SRC-WS-1 ·
// 퍼블릭 도메인 전자책 사이트 — LIT-SRC-PD-1). prebuild --check가 모두 본다.
const runs = [
  [LITERATURE_ROOT, await buildLiterature({ check })],
  [STANDARD_EBOOKS_ROOT, await buildStandardEbooks({ check })],
  [WIKISOURCE_ROOT, await buildWikisource({ check })],
  [PDSITE_ROOT, await buildPdSite({ check })],
];
let failed = false;
for (const [root, { works, errors }] of runs) {
  for (const work of works) console.log(`  ${work.key}: ${work.chapters}장 (${work.status})`);
  if (errors.length) {
    failed = true;
    console.error(`✗ 문학책 빌드 실패 ${errors.length}건 — ${root}`);
    for (const error of errors) console.error(`  - ${error}`);
  } else {
    console.log(`✓ 문학책 ${check ? '검사' : '빌드'} 통과 — ${root} ${works.length}편`);
  }
}
if (failed) process.exit(1);
