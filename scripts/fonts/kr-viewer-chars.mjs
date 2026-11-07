#!/usr/bin/env node
// 첫 화면 한글 하위 집합의 글자 목록 — 출처는 그 화면이 첫 그림에 그리는 UI 문자열(KR-VIEWER-SUBSET-001, 2026-11-07 KST 오케스트레이터 승인 (가)안).
//
// 왜: 뷰어 첫 화면은 서로 다른 한글이 90자 남짓인데, Google의 Noto Sans KR 조각(unicode-range 124개)에 흩어져 10개 · 약 157KB를 받았다
// (운영 실측). 그 바이트가 스크립트(Low)보다 높은 우선순위(VeryHigh)로 대역을 나눠 하이드레이션을 늦췄다. 화면이 그리는 UI 한글을 한 파일로
// 묶어 첫 그림 전에 주면 대부분의 조각을 받지 않고, 글꼴이 늦게 와 줄이 다시 흐르는 일(CLS)도 없다. 묶음에 없는 글자(자료 본문 · 사용자 글)는
// 원래 조각으로 저절로 넘어간다(같은 family의 unicode-range 규칙) — 이 목록은 성능용이지 정확성 조건이 아니다.
//
// 하위 집합은 화면마다 따로다(VOCAB-SUBSET-SMALL-001): 미리 받는 바이트는 첫 그림 전 대역을 렌더 차단 CSS와 나눠 FCP를 그만큼 늦춘다
// (복습실 실측 — 52KB 미리 받기가 1.6Mbps에서 FCP +0.26s). 그래서 복습실은 손님 첫 화면 글자만(셸 + 손님 블록) 싣는다.
//
// 글자 출처(이 목록이 정본): SUBSETS[이름].sources 파일에서 주석을 걷은 원문의 한글 음절(U+AC00–U+D7A3). block이 있으면 그 파일의
// 「// kr-subset:<block>:begin」 ~ 「// kr-subset:<block>:end」 사이만 센다. 문구가 바뀌면 CI 계약
// (src/components/fonts/__tests__/krViewerSubset.test.js)이 「추출 ⊆ 커밋된 목록」으로 잡고, 재생성은 scripts/fonts/kr-viewer-subset.py.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 공통 셸(머리 · 아래 메뉴) — 어느 화면이든 첫 그림에 있다. */
const SHELL = Object.freeze([
  { file: 'src/components/Layout.jsx' },
  { file: 'src/lib/webNavigation.js' },
]);

/**
 * 하위 집합 — 이름 → { 산출 파일 · 글자 출처 }. 싣는 세그먼트 레이아웃이 그 이름의 미리 받기 함수를 부른다(계약이 짝을 본다).
 * - viewer: 뷰어 화면 · 뷰어 부품 · 뷰어 문구표 · 셸
 * - vocab: 복습실(/vocab) 손님 첫 화면 — 셸 + VocabPage 손님 블록 + 공통 푸터(VOCAB-GUEST-CLS-001 · VOCAB-SUBSET-SMALL-001). 로그인 복습실은 클라이언트에서
 *   그리므로 원래 조각을 쓴다(#1725 이전과 같다).
 */
export const SUBSETS = Object.freeze({
  viewer: Object.freeze({
    stem: 'noto-sans-kr-viewer', json: 'subset.json', css: 'krViewerSubset.css', segment: 'viewer',
    sources: Object.freeze([
      { dir: 'src/views', pick: /^Viewer.*\.jsx$/ },
      { dir: 'src/components/viewer', pick: /\.(jsx|js)$/ },
      { file: 'src/lib/viewerMessages.js' },
      ...SHELL,
    ]),
  }),
  vocab: Object.freeze({
    stem: 'noto-sans-kr-vocab', json: 'subset-vocab.json', css: 'krVocabSubset.css', segment: 'vocab',
    sources: Object.freeze([
      ...SHELL,
      { file: 'src/views/VocabPage.jsx', block: 'vocab-guest' },
      // 공통 푸터(SiteFooter — 손님 복습실은 짧아 첫 화면에 보인다): 빼면 woff2 조각 14 → 16(앞단 실측 2026-11-07 KST, 오케스트레이터 게이트).
      { file: 'src/components/web/SiteFooter.jsx' },
    ]),
  }),
});

/** 옛 이름(뷰어) — 뷰어 하위 집합의 출처. */
export const SOURCES = SUBSETS.viewer.sources;

const HANGUL = /[가-힣]/gu;

/** 주석을 걷는다 — 설명 주석의 한글을 화면 글자로 세지 않게(문자열 안의 // 는 드물고, 세어도 목록이 조금 넓어질 뿐이다). */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/** 「// kr-subset:<name>:begin」 ~ 「…:end」 사이 원문. 표식이 정확히 한 쌍이 아니면 던진다(조용히 빈 목록이 되지 않게). */
export function sliceBlock(src, name, rel = '') {
  const begin = `// kr-subset:${name}:begin`;
  const end = `// kr-subset:${name}:end`;
  const a = src.indexOf(begin);
  const b = src.indexOf(end);
  if (a < 0 || b < a || src.indexOf(begin, a + 1) >= 0 || src.indexOf(end, b + 1) >= 0) {
    throw new Error(`${rel}: 하위 집합 표식 ${begin} … ${end}가 정확히 한 쌍이어야 한다`);
  }
  return src.slice(a + begin.length, b);
}

function entriesOf(sources, root) {
  const out = [];
  for (const s of sources) {
    if (s.file) { out.push({ rel: s.file, block: s.block }); continue; }
    for (const name of fs.readdirSync(path.join(root, s.dir)).sort()) {
      if (s.pick.test(name) && !/\.test\./.test(name)) out.push({ rel: `${s.dir}/${name}` });
    }
  }
  return out;
}

/** 하위 집합의 출처 파일(상대 경로). */
export function sourceFiles(root = ROOT, name = 'viewer') {
  return entriesOf(SUBSETS[name].sources, root).map((e) => e.rel);
}

/** 하위 집합 출처의 한글 음절 — 정렬 · 중복 없음. */
export function extractSubsetHangul(name, root = ROOT) {
  const set = new Set();
  for (const { rel, block } of entriesOf(SUBSETS[name].sources, root)) {
    const raw = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const ch of stripComments(block ? sliceBlock(raw, block, rel) : raw).match(HANGUL) || []) set.add(ch);
  }
  return [...set].sort();
}

/** 옛 이름 — 뷰어 하위 집합. */
export function extractViewerHangul(root = ROOT) {
  return extractSubsetHangul('viewer', root);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // --json: 생성기(kr-viewer-subset.py)가 읽는 하위 집합 전부 — { 이름: { stem, json, css, chars } }
  if (process.argv[2] === '--json') {
    const all = Object.fromEntries(Object.entries(SUBSETS).map(([n, s]) => [n, { stem: s.stem, json: s.json, css: s.css, chars: extractSubsetHangul(n).join('') }]));
    process.stdout.write(JSON.stringify(all));
    process.exit(0);
  }
  const name = process.argv[2] || 'viewer';
  if (!SUBSETS[name]) { process.stderr.write(`모르는 하위 집합: ${name} (${Object.keys(SUBSETS).join(', ')})\n`); process.exit(2); }
  process.stdout.write(extractSubsetHangul(name).join(''));
}
