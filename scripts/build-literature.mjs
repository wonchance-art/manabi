#!/usr/bin/env node
/**
 * 정본 문학책(아오조라) 빌드 — 설계 §3.1. 작품 폴더 src/content/literature/aozora/<workKey>/의
 * source.txt(UTF-8 변환본) + entry.json(카탈로그·권리)을 chapters.json(장별 raw_text·루비 잠금·크레딧)으로 만든다.
 *
 * 실행(리포 루트):
 *   node scripts/build-literature.mjs           chapters.json 쓰기(바뀐 것만)
 *   node scripts/build-literature.mjs --check   쓰지 않고 검사만 — 권리 미승인·원문 해시 불일치·미해결 외자·파서 경고·
 *                                               chapters.json 낡음이면 exit 1. 작품 0편이면 통과(no-op).
 * 게시(공개 reading_materials 삽입·사전 분석)는 이 스크립트가 하지 않는다 — 관리자 게시 단계(다음 PR)의 몫이다.
 */
// 제품 모듈(src/lib)은 번들러식 확장자 없는 import를 쓴다 — Node가 풀 수 있게 훅을 먼저 등록한다(eval 스크립트와 같은 훅 재사용).
import './eval/productImportHooks.mjs';

const check = process.argv.includes('--check');
const { buildLiterature, LITERATURE_ROOT } = await import('./lib/literature-build.mjs');
const { works, errors } = await buildLiterature({ check });

for (const work of works) console.log(`  ${work.key}: ${work.chapters}장 (${work.status})`);
if (errors.length) {
  console.error(`✗ 문학책 빌드 실패 ${errors.length}건`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`✓ 문학책 ${check ? '검사' : '빌드'} 통과 — ${LITERATURE_ROOT} ${works.length}편`);
