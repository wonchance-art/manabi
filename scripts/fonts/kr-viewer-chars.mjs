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
// 「// kr-subset:<block>:begin」 ~ 「// kr-subset:<block>:end」 사이만 센다(표식 줄 뒤에 단 설명 글도 세어지니 설명은 앞 줄에 둔다).
// match가 있으면 그 정규식의 1번 무리만(시드 제목 리터럴), cjk면 가나 · 한자 · 기호도 싣는다. preload: false인 묶음은 미리 받지 않고
// (첫 그림 뒤에 차는 목록 몫), exclude는 다른 묶음의 글자를 뺀다(같은 글자를 두 파일이 나눠 받지 않게). 문구가 바뀌면 CI 계약
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

/** 시드 제목 — 「[N5 문법 #1] …」 꼴(시리즈 꼬리 · 번호). JS 정본(starter-content의 title: '…')과 SQL 리터럴('…'). */
const SEED_TITLE_JS = /title: '(\[[A-Z0-9]{2} [^'\n\]]{1,20}#\d+\][^'\n]{0,160})'/g;
const SEED_TITLE_SQL = /'(\[[A-Z0-9]{2} [^'\n\]]{1,20}#\d+\][^'\n]{0,160})'/g;

/**
 * 하위 집합 — 이름 → { 산출 파일 · 글자 출처 }. 싣는 세그먼트 레이아웃이 그 이름의 미리 받기 함수를 부른다(계약이 짝을 본다).
 * - viewer: 뷰어 화면 · 뷰어 부품 · 뷰어 문구표 · 셸
 * - vocab: 복습실(/vocab) 손님 첫 화면 — 셸 + VocabPage 손님 블록 + 공통 푸터(VOCAB-GUEST-CLS-001 · VOCAB-SUBSET-SMALL-001). 로그인 복습실은 클라이언트에서
 *   그리므로 원래 조각을 쓴다(#1725 이전과 같다).
 * - reading: 「함께 읽는 글」 손님 첫 화면 — 셸 + 머리 + 언어 칩 + 빈 상태 블록 + 공통 푸터(READING-CHIP-CLS-001).
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
  // 배움(/home) — 셸 + HomePage + 배움 부품(src/components/learn) + 공통 푸터(HOME-KR-SUBSET-001). 페이지 전체 한글이 107자뿐인데
  // Noto Sans KR 조각 12개 · 200KB를 받았다(운영 실측 2026-11-08 KST). 교재 제목 같은 데이터 글자는 원래 조각으로 넘어간다.
  home: Object.freeze({
    stem: 'noto-sans-kr-home', json: 'subset-home.json', css: 'krHomeSubset.css', segment: 'home',
    sources: Object.freeze([
      ...SHELL,
      { file: 'src/views/HomePage.jsx' },
      { dir: 'src/components/learn', pick: /\.(jsx|js)$/ },
      { file: 'src/components/web/SiteFooter.jsx' },
    ]),
  }),
  // 「함께 읽는 글」(/discover?view=reading → /discover/reading) 손님 첫 화면 — 셸 + 머리 + 언어 칩 + 빈 상태 · 「오늘의 소식」 제목 + 공통 푸터
  // (READING-CHIP-CLS-001): 칩이 첫 그림에선 시스템 글꼴(한글 1.0em)로 두 줄, Noto Sans KR 조각이 4.7s에 온 뒤 0.92em로 줄며 「프랑스어」가
  // 첫 줄로 올라갔다(운영 폰 CLS 0.035). 푸터는 PC 첫 화면에서 목록이 정해지기 전에 보인다.
  reading: Object.freeze({
    stem: 'noto-sans-kr-reading', json: 'subset-reading.json', css: 'krReadingSubset.css', segment: 'discover/reading',
    sources: Object.freeze([
      ...SHELL,
      // cjk: 머리 「← 산책」의 ←(U+2190)는 Manrope에 없어(↑ ↓만 있다) Noto Sans KR 조각 하나를 따로 불렀다(READING-LIST-FONT-001).
      { file: 'src/app/(app)/discover/reading/page.jsx', cjk: true },
      { file: 'src/lib/constants.js', block: 'reading-langs' },
      { file: 'src/views/MaterialsPage.jsx', block: 'reading-chips' },
      { file: 'src/views/MaterialsPage.jsx', block: 'reading-sort' },
      { file: 'src/views/MaterialsPage.jsx', block: 'reading-guest' },
      { file: 'src/components/web/SiteFooter.jsx' },
    ]),
  }),
  // 「함께 읽는 글」 목록 글자 묶음(READING-LIST-FONT-001) — 공개 자료 132편이 손님에게 보이자(#1760) 카드 제목 · 꼬리표 · 정렬 · 「더 보기」의 글자가
  // Noto Sans KR 조각 30개 · 855KB를 불렀다(운영 실측 2026-11-08 KST, 화면의 서로 다른 한글은 96자). 그 글자를 한 파일로 묶는다. 미리 받지 않는다
  // (preload: false — 목록은 첫 그림 뒤에 차고, 미리 받으면 FCP 대역을 나눈다). reading에 있는 글자는 빼고(exclude) 그쪽이 그린다.
  // 데이터 글자(시드 제목의 한글 — 일본어 · 중국어 제목 괄호의 풀이)는 시드 정본(starter-content · 마이그레이션 제목 리터럴)에서 뽑는다.
  // cjk: 그 출처의 가나 · 한자 · 전각 기호도 싣는다 — ko 줄의 「NHK ニュース（社会）」 · 「日本語」는 Noto Sans KR 조각이 그렸다(같은 원본이라 같은 그림).
  readingList: Object.freeze({
    stem: 'noto-sans-kr-reading-list', json: 'subset-reading-list.json', css: 'krReadingListSubset.css', segment: 'discover/reading',
    preload: false, exclude: 'reading',
    sources: Object.freeze([
      { file: 'src/views/MaterialsPage.jsx', block: 'reading-list', cjk: true },
      { file: 'src/views/MaterialsPage.jsx', block: 'reading-suggest', cjk: true },
      { file: 'src/lib/constants.js', block: 'reading-levels' },
      { file: 'src/lib/content-sources.js', block: 'reading-nhk', cjk: true },
      { file: 'src/lib/content-sources.js', block: 'reading-nhk-name', cjk: true },
      { file: 'src/lib/bookNavigation.js', block: 'reading-series', cjk: true },
      // 시드 제목은 가나 · 한자까지(cjk) — 일본어 · 중국어 제목 줄은 Noto Sans JP · SC 조각이 오는 동안 다음 글꼴(Noto Sans KR)로 그리려고
      // 그 글자의 KR 조각을 받는다(운영 실측: 중국어 제목에만 있는 店 · 游 · 算의 KR 조각 17개). 같은 원본의 한 파일이 그 몫을 맡는다.
      { file: 'src/lib/starter-content.js', match: SEED_TITLE_JS, cjk: true },
      { dir: 'supabase/migrations', pick: /\.sql$/, match: SEED_TITLE_SQL, cjk: true },
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
    if (s.file) { out.push({ rel: s.file, block: s.block, match: s.match, cjk: s.cjk }); continue; }
    for (const name of fs.readdirSync(path.join(root, s.dir)).sort()) {
      if (s.pick.test(name) && !/\.test\./.test(name)) out.push({ rel: `${s.dir}/${name}`, match: s.match, cjk: s.cjk });
    }
  }
  return out;
}

// cjk 출처에서 싣는 한글 밖 글자 — 가운뎃점 · 줄표(U+00B7 · U+2014 — 일본어 · 중국어 제목 줄에서는 KR이 대체로 그린다) · 화살표 · 기호(U+2190–2BFF) · CJK 기호 · 가나(U+3000–30FF) · 한자(U+4E00–9FFF) · 전각(U+FF00–FFEF).
// 라틴 · 일반 구두점은 Manrope가 그린다. Noto Sans KR에 없는 글자는 생성기가 빼고 skipped로 남긴다(원래도 다음 글꼴이 그린다).
const CJK = /[\u00b7\u2014\u2190-\u2bff\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]/gu;

/** 출처 한 건의 화면 글자 원문 — block이면 표식 사이, match면 그 무리(1번)만, 아니면 주석을 걷은 전체. */
function textOf({ rel, block, match }, root) {
  const raw = fs.readFileSync(path.join(root, rel), 'utf8');
  if (match) return [...raw.matchAll(match)].map((m) => m[1]).join('\n');
  return stripComments(block ? sliceBlock(raw, block, rel) : raw);
}

/** 하위 집합의 출처 파일(상대 경로). */
export function sourceFiles(root = ROOT, name = 'viewer') {
  return entriesOf(SUBSETS[name].sources, root).map((e) => e.rel);
}

/** 하위 집합 출처의 한글 음절 — 정렬 · 중복 없음. exclude가 있으면 그 하위 집합의 글자는 뺀다(그쪽 파일이 그린다). */
export function extractSubsetHangul(name, root = ROOT) {
  return extractSubsetChars(name, root).filter((ch) => /[가-힣]/u.test(ch));
}

/** 하위 집합에 싣는 글자 전부 — 한글 음절 + cjk 출처의 가나 · 한자 · 기호. 정렬(코드포인트) · 중복 없음. */
export function extractSubsetChars(name, root = ROOT) {
  const spec = SUBSETS[name];
  const set = new Set();
  for (const entry of entriesOf(spec.sources, root)) {
    const text = textOf(entry, root);
    for (const ch of text.match(HANGUL) || []) set.add(ch);
    if (entry.cjk) for (const ch of text.match(CJK) || []) set.add(ch);
  }
  if (spec.exclude) for (const ch of extractSubsetChars(spec.exclude, root)) set.delete(ch);
  return [...set].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

/** 옛 이름 — 뷰어 하위 집합. */
export function extractViewerHangul(root = ROOT) {
  return extractSubsetHangul('viewer', root);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // --json: 생성기(kr-viewer-subset.py)가 읽는 하위 집합 전부 — { 이름: { stem, json, css, chars } }
  if (process.argv[2] === '--json') {
    const all = Object.fromEntries(Object.entries(SUBSETS).map(([n, s]) => [n, { stem: s.stem, json: s.json, css: s.css, chars: extractSubsetChars(n).join('') }]));
    process.stdout.write(JSON.stringify(all));
    process.exit(0);
  }
  const name = process.argv[2] || 'viewer';
  if (!SUBSETS[name]) { process.stderr.write(`모르는 하위 집합: ${name} (${Object.keys(SUBSETS).join(', ')})\n`); process.exit(2); }
  process.stdout.write(extractSubsetChars(name).join(''));
}
