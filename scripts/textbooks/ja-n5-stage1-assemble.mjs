// 교재 N5(8a8c) 1단계 정본 조립 — 생성기 출력 + 넓힌 검사 출력 → 정본 표 · 패치(JA-KANJI-A-001 · 오너 승인 2026-11-11 KST).
// 세 단계(리포 루트에서, Node 24 — 앞 둘은 제품 import 훅 scripts/eval/productImportHooks.mjs를 스스로 등록한다):
//   node scripts/textbooks/ja-n5-stage1-generate.mjs <repo> <raw.json> scripts/textbooks/n5-notation/n5-8a8c-stage1-blocked.txt
//   node scripts/textbooks/ja-n5-stage1-check.mjs <repo> <raw.json> scripts/textbooks/n5-notation/n5-8a8c-stage1-blocked.txt <check.json>
//   node scripts/textbooks/ja-n5-stage1-assemble.mjs <raw.json> <check.json> scripts/textbooks/n5-notation
// 출력(바이트 고정 — WEB 재현 계약 scripts/textbooks/n5-notation-release.test.js가 패치 sha256을 못 박는다):
//   n5-8a8c-stage1-table.json  판 5 표(규칙 · 요약 · 바뀐 줄 · 검수 목록 · 넓힌 검사 · 가나 유지 줄)
//   n5-8a8c-stage1-patch.json  { 경로: 바뀐 원문 } — WEB 도구 n5-derive-notation.mjs가 --patch로 읽는다
// 넓힌 검사 실패가 하나라도 있으면 쓰지 않고 멈춘다.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [,, rawF, checkF, outDir] = process.argv;
if (!rawF || !checkF || !outDir) {
  console.error('사용법: node scripts/textbooks/ja-n5-stage1-assemble.mjs <raw.json> <check.json> <outDir>');
  process.exit(1);
}
const j = JSON.parse(readFileSync(rawF, 'utf8'));
const resid = JSON.parse(readFileSync(checkF, 'utf8'));
if (resid.fail !== 0) { console.error(`넓힌 검사 실패 ${resid.fail} — 조립하지 않는다`); process.exit(1); }
if (!j.summary.allKanaFormOk || j.summary.publicMismatch !== 0 || j.mismatches.length) { console.error('kanaForm · 공개 표 어긋남 — 조립하지 않는다'); process.exit(1); }

const KATA = /^[ァ-ヿー]+$/;
const outside = j.outsideLexicon.filter((o) => !KATA.test(o.word) && !/さん$/.test(o.word)); // 가타카나 · 「~さん」은 한자 판정 대상이 아니다
const shortNoun = j.review.shortNoun.map((x) => ({ ...x, after: j.patch[x.path] ?? x.before }));
const table = {
  edition: '8a8c1c1fd452773810abaf8c', stage: 1, version: 5, generated: '2026-11-11 KST',
  definition: 'WEB stage1Eligibility(바탕 8a8c) — 8필드 · 제외 38(과 단위 치환) · {바탕|읽기} · 과 지도 키 맨글 · kanaForm 동일 · 같은 과 같은 원문 = 같은 표기',
  rules: {
    readingRows: 'study_pages rows 중 label에 한자 · 숫자가 있는 줄(읽기표)은 가나 유지',
    conjugationRows: 'study_pages rows 중 label이 가나 용언형(기본형 · ます형 · て형 · た형 · ない형, 끝이 う단 · い · ます · て · で · た · だ · ない)인 줄(활용 카드)은 ja도 가나 유지',
    homonym: '문장이 뜻을 가르면 문맥(목적어 · 주어 · 번역)대로, 같은 과 같은 원문이 여러 뜻으로 갈리면 가나',
    wakaru: 'わかる는 교재 전체 가나',
    shortNoun: '명사 판정 낱말은 분석기가 동사 · 형용사로 본 자리, 뒤가 활용 어미, 앞 가나에 붙은 자리에서 바꾸지 않는다(いけません ≠ 池)',
    regexFill: '분석기 분할과 무관하게 남은 가나를 어간 + 활용 어미 정규식으로 채운다(인라인 바로 뒤는 낱말 경계가 아님 · すみません 등 고정 표현 제외)',
  },
  rulings: '오케스트레이터 11/11 1~4차 판정 반영',
  summary: {
    ...j.summary, outsideLexicon: outside.length,
    widenedPublicCheck: { hits: resid.total, fail: resid.fail, exceptions: resid.exceptions },
    regexFill: j.review.regexFill.length,
    shortNounConverted: shortNoun.filter((x) => x.status === 'converted').length,
    shortNounHeld: shortNoun.filter((x) => x.status === 'held').length,
  },
  rows: j.rows.map((r) => ({ lesson: r.lesson, path: r.path, field: r.path.split('.').slice(2).join('.'), before: r.before, after: r.after, newReadings: r.inline })),
  review: {
    shortNoun, regexFill: j.review.regexFill, homonym: j.review.homonym, oneChar: j.review.oneChar, uncertain: j.review.uncertain,
    jukuji: j.review.jukuji, split: j.review.split, sample: j.review.sample.map((r) => ({ lesson: r.lesson, path: r.path, before: r.before, after: r.after })),
  },
  widenedPublicCheck: resid, readingRowsKept: j.readingRows, conjugationRowsKept: j.conjugationRows, homophoneSplit: j.homophoneSplit,
  outsideLexicon: outside.map((o) => ({ word: o.word, pos: o.pos, analyzerBase: o.analyzerBase, count: o.n, lessons: o.lessons, example: o.ex })),
  mismatches: j.mismatches,
};
writeFileSync(join(outDir, 'n5-8a8c-stage1-table.json'), `${JSON.stringify(table, null, 1)}\n`);
writeFileSync(join(outDir, 'n5-8a8c-stage1-patch.json'), `${JSON.stringify(j.patch, null, 1)}\n`);
console.log(`stage1: rows ${table.rows.length} · patch ${Object.keys(j.patch).length} · widened check ${resid.total} hits / fail ${resid.fail}`);
