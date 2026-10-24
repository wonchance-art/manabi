import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * 계약: 번체 글꼴(Noto Sans TC)은 번체를 그리는 화면에만 싣는다 (FONT-TC-SCOPE-001, 2026-10-17 KST).
 *
 * 루트 레이아웃이 CJK 4종을 걸어 모든 페이지 head CSS에 TC @font-face 325개(운영 gz 36KB, 렌더 차단)가 실렸다.
 * 번체(zh-TW · zh-Hant-TW)를 그리는 곳은 뷰어(UI · 해설 언어 zh-TW, 자형 열 正, 한자 창)와 중국어 레벨 목록(正 표기)이다.
 * 지역 없는 zh-Hant(HanziBoard · refShared)는 index.css 규칙상 :lang(zh) = SC로 그린다 — TC 대상이 아니다.
 *
 * 지키는 것: ① 루트는 TC를 걸지 않는다 ② 번체 화면의 라우트는 TC를 거는 세그먼트 안에 있다
 * ③ --font-noto-tc를 쓰는 곳은 모두 폴백을 둔다 — 범위 밖(숨긴 수업 화면 등)에서도 선언이 통째로 무효가 되지 않는다.
 */
const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const walk = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
};

const SCOPE = 'src/components/fonts/TcFontScope.jsx';
// TC를 거는 세그먼트 — 번체를 그리는 보이는 화면.
const TC_SEGMENTS = ['src/app/(app)/viewer', 'src/app/(app)/pdf', 'src/app/(app)/suggestions', 'src/app/(app)/chinese'];
// 번체를 그리는 화면 부품 — 이것을 여는 라우트는 TC 세그먼트 안에 있어야 한다.
const TC_SCREENS = ['@/views/ViewerPage', '@/views/PdfViewerPage', '@/components/materials/SuggestionReader', '@/views/levelListRoute'];
// 범위 밖으로 둔 라우트 — 이유와 함께. 여기서는 CSS 폴백(③)으로 시스템 TC · KR 글꼴에 떨어진다.
const OUTSIDE = Object.freeze({
  'src/app/(app)/japanese': '일본어 레벨 목록 — LevelListPage의 正(zh-TW) 줄은 중국어 자료에만 나온다',
});

describe('번체 글꼴 범위 — Noto Sans TC', () => {
  const files = walk(path.join(ROOT, 'src'));
  const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');

  it('① 루트 레이아웃은 Noto Sans TC를 걸지 않는다', () => {
    const root = read('src/app/layout.jsx');
    expect(root).not.toMatch(/Noto_Sans_TC|notoTc|--font-noto-tc/);
    expect(root).not.toContain('Noto_Sans_SC('); // SC도 범위 부품이다(FONT-SC-SCOPE-001, 아래).
  });

  it('TC는 범위 부품 한 곳에서 정의하고, 번체 세그먼트 레이아웃이 그것으로 감싼다', () => {
    const scope = read(SCOPE);
    expect(scope).toContain('Noto_Sans_TC(');
    expect(scope).toContain("variable: '--font-noto-tc'");
    expect(scope).toContain("style={{ display: 'contents' }}");
    const definers = files.filter(f => /Noto_Sans_TC\(/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(definers).toEqual([SCOPE]);
    for (const seg of TC_SEGMENTS) {
      const layout = read(`${seg}/layout.jsx`);
      expect(layout, seg).toContain("import TcFontScope from '@/components/fonts/TcFontScope'");
      expect(layout, seg).toContain('<TcFontScope>{children}</TcFontScope>');
    }
  });

  it('② 번체 화면을 여는 라우트는 TC 세그먼트 안에 있다', () => {
    const routes = files.filter(f => rel(f).startsWith('src/app/') && /\/(page|layout)\.jsx$/.test(f));
    const hits = routes.filter(f => TC_SCREENS.some(m => fs.readFileSync(f, 'utf8').includes(`from '${m}'`))).map(rel);
    expect(hits.length).toBeGreaterThanOrEqual(4); // viewer · pdf · suggestions · chinese 레벨(공허 통과 방지)
    const outside = hits.filter(f => !TC_SEGMENTS.some(seg => f.startsWith(`${seg}/`)) && !Object.keys(OUTSIDE).some(o => f.startsWith(`${o}/`)));
    expect(outside, '번체 화면이 TC 범위 밖 라우트에서 열린다 — TC_SEGMENTS에 넣거나 OUTSIDE에 이유를 적는다').toEqual([]);
  });

  it('③ --font-noto-tc를 쓰는 곳은 모두 폴백이 있다(범위 밖에서 font-family가 무효가 되지 않게)', () => {
    const uses = files.flatMap(f => (fs.readFileSync(f, 'utf8').match(/var\(--font-noto-tc[^)]*\)/g) || []).map(u => `${rel(f)}: ${u}`));
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter(u => !/var\(--font-noto-tc,\s*'Noto Sans TC'\)/.test(u))).toEqual([]);
  });

  it('범위 밖 목록의 경로는 실제로 있고 이유가 있다', () => {
    for (const [dir, reason] of Object.entries(OUTSIDE)) {
      expect(fs.existsSync(path.join(ROOT, dir)), dir).toBe(true);
      expect(reason.length, dir).toBeGreaterThan(10);
    }
  });
});

/**
 * 계약: 간체 중국어(Noto Sans SC)는 중국어를 그릴 수 있는 화면에만 싣는다 (FONT-SC-SCOPE-001, 2026-10-17 KST).
 *
 * 루트가 SC를 걸어 모든 페이지 head CSS에 SC @font-face 303개(gz 약 91KB, 렌더 차단)가 실렸다. SC로 그리는 것은
 * lang zh*(:lang(zh) 전역 규칙) · 중국어 뷰어 글꼴(readerFontFamily) · 표지/이어 읽기 글자[lang=zh] · 수업 [lang=zh]다.
 * 그 lang은 대부분 데이터(자료 · 단어 · 표지 언어)를 따라가므로, 학습 언어를 섞어 보여 주는 화면은 모두 범위에 넣는다.
 * 범위 밖은 한 언어만 그리는 화면(일본어 · 영어 · 프랑스어 레퍼런스 · 일본어 교재 · 지역학 · 계정 · 안내 · 관리)이다.
 *
 * 지키는 것: ① 루트는 SC를 걸지 않고 정의는 범위 부품 한 곳(이중 선언 금지 — FONT-HINT-001과 같은 원칙)
 * ② 범위 밖 라우트가 import 그래프로 닿는 zh 신호 부품은 근거(라우트 패턴 + 이유)가 있는 것뿐(SC_OUTSIDE)
 * ③ --font-noto-sc는 모두 폴백을 둔다 — 범위 밖에서 선언 통째 무효(→ 상속 글꼴로 바뀜)가 되지 않게.
 * ④ 그 폴백 'Noto Sans SC'는 웹폰트 @font-face 이름 그대로다(next/font 15.5는 패밀리 이름을 해시하지 않는다) — SC CSS가
 *    문서에 실려 있으면 변수 없이도 웹폰트를 쓴다. 해시가 돌아오면 폴백이 로컬 설치 글꼴만 가리키므로 설치된 Next로 핀한다.
 */
const SC_SCOPE = 'src/components/fonts/ScFontScope.jsx';
const SC_SEGMENTS = [
  'lessons', 'materials', 'notes', 'class', 'chinese', 'viewer', 'pdf', 'suggestions', 'study', 'vocab',
  'review', 'writing', 'quick', 'progress', 'world', 'conversation', 'admin/legacy-textbooks',
].map(s => `src/app/(app)/${s}`);
// 잎이 독립 스타일시트를 직접 거는 세그먼트(SC-LINK-001 2단계 — next/font SC를 싣지 않는다). 나머지는 다음 단계에서 옮긴다.
const SC_LINK_SEGMENTS = ['home', 'discover'].map(s => `src/app/(app)/${s}`);
// 링크 세그먼트에서 lang을 데이터로 정하지만 SC로 그리지 않는 잎 — ZhSlot으로 감싸지 않는다(스타일시트 대기만 늘어난다).
// 근거는 그 클래스의 CSS 규칙(css + 글꼴 패턴)으로 계약이 직접 확인한다.
const SC_LINK_NOT_SC = Object.freeze({
  'src/components/learn/ResumeTile.jsx': {
    'learn-resume__title': { css: 'src/components/learn/learn.css', font: /var\(--font-serif-kr\)/, reason: '이어 읽기 제목은 언어와 무관하게 Noto Serif KR로 그린다(기존 디자인)' },
  },
});
// 중국어를 그릴 수 있는 부품은 손으로 적지 않는다 — 라우트에서 import 그래프를 따라가 「zh 신호」가 있는 화면 파일을 찾는다
// (FONT-SC-SCOPE-002, 2026-10-17 KST — 수기 목록은 새 라우트가 목록 밖 부품을 열면 조용히 통과했다).
// zh 신호(.jsx만 — 그리는 쪽): lang에 zh를 직접 쓰거나, 값이 데이터에서 오는 lang={…}에 zh · Chinese를 함께 쓰거나,
// SC CSS 고리(표지 · 이어 읽기 글자 · 수업 · 뷰어 · 중국어 뷰어 글꼴)를 쓴다.
const EXT = ['.jsx', '.js', '.mjs', '.tsx', '.ts'];
const IMPORT = /(?:\bimport\s+(?:[^'"()]*?\s+from\s+)?|\bimport\s*\(\s*|\brequire\s*\(\s*|\bexport\s+[^'"]*?\s+from\s+)['"]([^'"]+)['"]/g;
const ZH_LITERAL = /lang=["'{]\s*['"]?zh/;
const ZH_DYNAMIC = /\blang=\{(?!['"](?:ja|en|fr|ko|und)['"])/;
const ZH_VALUE = /['"]zh(?:-[A-Za-z]+)*['"]|\bChinese\b/;
const SC_HOOK = /manabi-cover__glyph|learn-resume__glyph|classroom-shell|reader-modal|viewer-layout|readerFontFamily\(/;
function scGraph() {
  const resolve = (from, spec) => {
    let p;
    if (spec.startsWith('@/')) p = path.join('src', spec.slice(2));
    else if (spec.startsWith('.')) p = path.join(path.dirname(from), spec);
    else return null;
    for (const c of [p, ...EXT.map(e => p + e), ...EXT.map(e => path.join(p, `index${e}`))]) {
      const abs = path.join(ROOT, c);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return c.replaceAll('\\', '/');
    }
    return null;
  };
  const deps = new Map();
  const depsOf = (f) => {
    if (!deps.has(f)) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      deps.set(f, [...src.matchAll(IMPORT)].map(m => resolve(f, m[1])).filter(r => r && !/\.(css|json)$/.test(r)));
    }
    return deps.get(f);
  };
  const reach = (start) => {
    const seen = new Set(); const stack = [start];
    while (stack.length) { const f = stack.pop(); if (seen.has(f)) continue; seen.add(f); stack.push(...depsOf(f)); }
    return seen;
  };
  const zhCapable = (f) => {
    if (!/\.(jsx|tsx)$/.test(f)) return false;
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return ZH_LITERAL.test(src) || (ZH_DYNAMIC.test(src) && ZH_VALUE.test(src)) || SC_HOOK.test(src);
  };
  return { reach, zhCapable };
}
// 범위 밖 라우트가 닿아도 되는 zh 신호 부품 — 그 라우트에서는 중국어로 열리지 않는다는 근거(라우트 패턴 + 이유).
const REF_ROUTES = /^src\/app\/\(app\)\/(japanese|english|french)\/|^src\/app\/nihongo\//;
const SC_OUTSIDE = Object.freeze({
  'src/components/books/BookCover.jsx': { routes: /^src\/app\/\(app\)\/books\//, reason: '출판 교재는 일본어 N5 · N4뿐이다 — 표지 글자 lang은 ja로만 열린다' },
  'src/views/refShared.jsx': { routes: REF_ROUTES, reason: '레퍼런스 공용 부품 — lang은 그 라우트의 언어(ja · en · fr)를 따른다. 중국어는 /chinese(범위 안)' },
  'src/components/RefPatternCheck.jsx': { routes: REF_ROUTES, reason: '문형 확인 — 라우트 언어(ja · en · fr)로만 열린다' },
  'src/components/WritingPractice.jsx': { routes: REF_ROUTES, reason: '챕터 작문 연습 — 라우트 언어(ja · en · fr)로만 열린다' },
  'src/views/ReferenceVocabPage.jsx': { routes: REF_ROUTES, reason: '레퍼런스 단어 목록 — 영어 · 프랑스어 라우트의 언어로만 열린다' },
  'src/views/LevelListPage.jsx': { routes: /^src\/app\/\(app\)\/japanese\//, reason: '일본어 레벨 목록 — zh-CN/zh-TW 줄은 chinese 경로(범위 안)에서만 나온다' },
  'src/components/levels/HanziBoard.jsx': { routes: /^src\/app\/\(app\)\/japanese\//, reason: '한자판은 중국어 레벨(hanzi)에서만 그린다 — 일본어 레벨 목록은 같은 모듈을 불러올 뿐 열지 않는다' },
  'src/components/books/FirstEditionCover.jsx': { routes: /^src\/app\/\(app\)\/admin\/page\.jsx$/, reason: '정본 책 게시 패널의 초판 표지 — 중국어 표지 글자는 자체 송체(Noto Serif SC · --font-ws-song, 폴백 포함)로 그려 Noto Sans SC 범위에 기대지 않는다' },
});

describe('간체 글꼴 범위 — Noto Sans SC', () => {
  const files = walk(path.join(ROOT, 'src'));
  const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');

  it('① 루트는 SC를 걸지 않고, 정의는 범위 부품 한 곳뿐이다(이중 선언 금지)', () => {
    const root = read('src/app/layout.jsx');
    expect(root).not.toMatch(/Noto_Sans_SC|notoSc/);
    const definers = files.filter(f => /Noto_Sans_SC\(/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(definers).toEqual([SC_SCOPE]);
    const scope = read(SC_SCOPE);
    expect(scope).toContain("variable: '--font-noto-sc'");
    expect(scope).toContain("weight: ['400', '500', '700'],");
    expect(scope).toContain("style={{ display: 'contents' }}");
    expect(scope).toContain('<ScFontBodyVariable className={notoSc.variable} />'); // 감싸개 밖 포털(한자판 · 판서)
  });

  it('SC 세그먼트 레이아웃은 모두 ScFontScope로 감싼다', () => {
    for (const seg of SC_SEGMENTS) {
      const layout = read(`${seg}/layout.jsx`);
      expect(layout, seg).toContain("import ScFontScope from '@/components/fonts/ScFontScope'");
      expect(layout, seg).toMatch(/<ScFontScope>[\s\S]*\{children\}[\s\S]*<\/ScFontScope>/);
    }
  });

  it('② 범위 밖 라우트가 닿는 zh 신호 부품은 근거 목록(SC_OUTSIDE)에 있는 것뿐이다 — import 그래프로 판정', () => {
    const { reach, zhCapable } = scGraph();
    const routes = files.map(rel).filter(f => f.startsWith('src/app/') && /\/(page|layout|loading|error|not-found|template|default)\.jsx?$|Client\.jsx$/.test(f));
    // 링크 세그먼트는 범위 대신 잎이 스타일시트를 건다 — 아래 「링크 세그먼트 … ZhSlot」 계약이 그 잎을 지킨다.
    const inside = (f) => [...SC_SEGMENTS, ...SC_LINK_SEGMENTS].some(seg => f.startsWith(`${seg}/`));
    // 공허 통과 방지: 신호는 알려진 중국어 부품을 잡고, 범위 안 라우트는 실제로 그것들에 닿는다.
    for (const known of ['src/views/ViewerPage.jsx', 'src/views/QuickPage.jsx', 'src/components/levels/HanziBoard.jsx', 'src/components/books/BookCover.jsx']) {
      expect(zhCapable(known), known).toBe(true);
    }
    const insideHits = new Set(routes.filter(inside).flatMap(r => [...reach(r)].filter(zhCapable)));
    expect(insideHits.size).toBeGreaterThanOrEqual(20);
    const unexplained = routes.filter(r => !inside(r)).flatMap(r => [...reach(r)].filter(zhCapable)
      .filter(f => !(SC_OUTSIDE[f] && SC_OUTSIDE[f].routes.test(r))).map(f => `${r} → ${f}`));
    expect(unexplained, '중국어를 그릴 수 있는 부품이 SC 범위 밖 라우트에서 열린다 — 그 세그먼트를 SC_SEGMENTS에 넣거나 SC_OUTSIDE에 근거를 적는다').toEqual([]);
  });

  it('③ --font-noto-sc를 쓰는 곳은 모두 폴백이 있다', () => {
    const uses = files.flatMap(f => (fs.readFileSync(f, 'utf8').match(/var\(--font-noto-sc[^)]*\)/g) || []).map(u => `${rel(f)}: ${u}`));
    expect(uses.length).toBeGreaterThan(5);
    expect(uses.filter(u => !/var\(--font-noto-sc,\s*'Noto Sans SC'\)/.test(u))).toEqual([]);
  });

  it('범위 밖 근거 목록의 파일은 실제로 있고, zh 신호가 있으며(낡은 항목 금지), 이유가 있다', () => {
    const { zhCapable } = scGraph();
    for (const [file, { reason }] of Object.entries(SC_OUTSIDE)) {
      expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
      expect(zhCapable(file), file).toBe(true);
      expect(reason.length, file).toBeGreaterThan(10);
    }
  });

  it('링크 세그먼트는 ScFontScope 없이 힌트 쿠키 부품만 두고, 이미 동적 라우트다(쿠키로 정적을 동적으로 바꾸지 않음)', () => {
    // 배움(/home, GUEST-STATIC-001 4단계): 산책과 같은 판 나누기 — 판(ISR) · 세그먼트 layout은 쿠키를 읽지 않고, 힌트 쿠키 판정은 middleware가 해서
    // 늘 링크를 싣는 간체 판(/home/sc · /home/member/sc)으로 넘긴다.
    const home = 'src/app/(app)/home';
    const homeLayout = read(`${home}/layout.jsx`).replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
    expect(homeLayout).not.toMatch(/import ScFontScope|<ScFontScope>/);
    expect(homeLayout, '배움 세그먼트 layout이 쿠키를 읽으면 ISR 판이 동적이 된다').not.toMatch(/ScFontCookieHint|next\/headers|cookies\(/);
    for (const f of ['(guest)/page.jsx', '(guest)/sc/page.jsx', 'member/page.jsx', 'member/sc/page.jsx']) expect(read(`${home}/${f}`), f).toContain('export const revalidate = 3600;');
    expect(read(`${home}/(guest)/sc/page.jsx`)).toContain('<HomeVariant member={false} sc />');
    expect(read(`${home}/member/sc/page.jsx`)).toContain('<HomeVariant member sc />');
    expect(read('src/components/learn/HomeVariant.jsx')).toContain('return <>{sc && <ScFontLink />}<HomePage book={book} sessionHint={member} /></>;');
    expect(read('src/middleware.js')).toContain("const variant = `/home${member ? '/member' : ''}${sc ? '/sc' : ''}`;");
    // 산책(/discover, GUEST-STATIC-001 2단계): 같은 뜻(「쿠키로 정적을 동적으로 바꾸지 않음」)을 판 나누기로 지킨다 — 본 화면은 ISR이라 쿠키를 읽지 않고,
    // 힌트 쿠키 판정은 middleware가 해서 늘 링크를 싣는 간체 판(/discover/sc, 역시 ISR)으로 넘긴다. 쿠키를 읽는 부품은 이미 동적인 잎 화면에만 둔다.
    const discover = 'src/app/(app)/discover';
    // 세그먼트 layout은 글꼴 미리 받기(빌드 값)만 둔다 — 쿠키를 읽는 부품이 들어오면 ISR 판이 동적이 된다.
    expect(read(`${discover}/layout.jsx`), '산책 세그먼트 layout이 쿠키를 읽으면 ISR 판이 동적이 된다').not.toMatch(/ScFontCookieHint|ScFontScope|next\/headers|cookies\(/);
    expect(read(`${discover}/page.jsx`)).toContain('export const revalidate = 300;');
    expect(read(`${discover}/page.jsx`)).not.toMatch(/ScFontScope|ScFontCookieHint/);
    expect(read(`${discover}/sc/page.jsx`)).toContain('return <><ScFontLink /><DiscoverPage /></>;');
    expect(read('src/middleware.js')).toContain("if (request.cookies.get(SC_HINT_COOKIE)?.value === '1') return rewriteTo(request, '/discover/sc');");
    for (const leaf of ['reading', 'classics']) {
      expect(read(`${discover}/${leaf}/page.jsx`), leaf).toContain("export const dynamic = 'force-dynamic';");
      expect(read(`${discover}/${leaf}/page.jsx`), leaf).toContain('<ScFontCookieHint />');
    }
    const hint = read('src/components/fonts/ScFontCookieHint.jsx');
    expect(hint).toContain('return scHintFromJar(await cookies()) ? <ScFontLink /> : null;');
  });

  it('범위(ScFontScope) 안의 잎은 링크를 걸지 않는다 — @font-face 두 벌 방지', () => {
    expect(read(SC_SCOPE)).toContain('<ScFontScopeMarker>{children}</ScFontScopeMarker>');
  });

  it('링크 세그먼트에서 열리는 부품의 lang을 데이터로 정하는 요소는 ZhSlot 안에 있다(SC로 그리지 않는 잎은 근거와 함께 밖)', () => {
    const { reach } = scGraph();
    // 산책의 판 나누기(GUEST-STATIC-001 2단계) 뒤에도 같은 화면을 본다 — 「함께 읽는 글」 · 간체 판은 하위 경로의 page다.
    // 배움 판(4단계)은 (guest) · member 아래 page · loading이다.
    const reached = new Set(SC_LINK_SEGMENTS.flatMap(seg => ['page.jsx', 'layout.jsx', 'loading.jsx', 'reading/page.jsx', 'sc/page.jsx',
      '(guest)/page.jsx', '(guest)/loading.jsx', '(guest)/sc/page.jsx', 'member/page.jsx', 'member/loading.jsx', 'member/sc/page.jsx']
      .map(f => `${seg}/${f}`).filter(f => fs.existsSync(path.join(ROOT, f))).flatMap(f => [...reach(f)])));
    const leaves = [], bare = [], notSc = [];
    for (const f of reached) {
      const src = read(f);
      for (const m of src.matchAll(/\blang=\{/g)) {
        const before = src.slice(0, m.index);
        const tag = [...before.matchAll(/<([A-Za-z][\w.]*)/g)].at(-1);
        if (!tag || !/^[a-z]/.test(tag[1])) continue; // 부품 prop(lang=언어 이름)은 그 부품의 잎이 판단한다
        const cls = /className="([^"]+)"/.exec(before.slice(tag.index))?.[1]?.split(/\s+/) || [];
        const at = `${f}:${before.split('\n').length} <${tag[1]}${cls.length ? `.${cls[0]}` : ''}>`;
        const open = before.lastIndexOf('<ZhSlot lang=', tag.index);
        const wrapped = open >= 0 && !before.slice(open, tag.index).includes('</ZhSlot>') && before.slice(open, tag.index).split('\n').length <= 2;
        const exempt = cls.map(c => SC_LINK_NOT_SC[f]?.[c] && [c, SC_LINK_NOT_SC[f][c]]).find(Boolean);
        if (exempt) { expect(wrapped, `${at} — SC로 그리지 않는 잎은 감싸지 않는다`).toBe(false); notSc.push([at, ...exempt]); }
        else (wrapped ? leaves : bare).push(at);
      }
    }
    expect(leaves.length).toBeGreaterThanOrEqual(9); // 공허 통과 방지 — 배움 · 발견의 표지 · 제목 · 단어 · 문단 잎
    expect(bare, 'lang을 데이터로 정하는 요소가 ZhSlot 밖에 있다 — 중국어면 독립 스타일시트 없이 대체 글꼴로 그린다').toEqual([]);
    // 예외 목록은 실제로 쓰이고, 그 클래스의 CSS가 SC가 아닌 글꼴을 가리킨다(낡은 예외 금지).
    expect(notSc.map(([, c]) => c).sort()).toEqual(Object.values(SC_LINK_NOT_SC).flatMap(o => Object.keys(o)).sort());
    for (const [at, cls, { css, font, reason }] of notSc) {
      const rules = [...read(css).matchAll(new RegExp(`\\.${cls}(?:\\[[^\\]]*\\])?\\{([^}]*)\\}`, 'g'))].map(r => r[1]);
      expect(rules.some(r => font.test(r)), `${at} ${css}`).toBe(true);
      expect(rules.filter(r => /font/.test(r) && /noto-sc|Noto Sans SC/.test(r)), `${at} — SC로 그리면 감싸야 한다`).toEqual([]);
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it("④ next/font는 패밀리 이름을 해시하지 않는다 — 폴백 'Noto Sans SC'가 웹폰트 자신을 가리키는 전제(설치된 Next로 실제 변환)", async () => {
    // Next 13 · 14는 __Noto_Sans_SC_<hash>로 바꿨다. 15.5는 이름을 그대로 둔다(postcss-next-font formatFamily). 해시가 돌아오면
    // var(--font-noto-sc, 'Noto Sans SC')의 폴백은 로컬 설치 글꼴만 가리키게 된다 — 그때 이 계약이 먼저 깨진다.
    const require = createRequire(path.join(ROOT, 'package.json'));
    const postcss = require('postcss');
    const plugin = require('next/dist/build/webpack/loaders/next-font-loader/postcss-next-font').default;
    const out = await postcss([plugin({ exports: [], variable: '--font-noto-sc', adjustFontFallback: { fallbackFont: 'Arial' } })])
      .process("@font-face{font-family:'Noto Sans SC';src:url(a.woff2) format('woff2')}", { from: undefined });
    expect(out.css).toMatch(/@font-face\s*\{\s*font-family:\s*'Noto Sans SC';/);
    expect(out.css).toMatch(/--font-noto-sc:\s*'Noto Sans SC',\s*'Noto Sans SC Fallback'/);
    expect(out.css).not.toMatch(/__Noto_Sans_SC/);
  });
});
