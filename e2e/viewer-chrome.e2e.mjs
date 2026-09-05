import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';

/**
 * 뷰어 크롬 기하 e2e — 첫 글자가 나오기까지의 높이를 **브라우저 좌표**로 지킨다.
 *
 * 왜(뷰어 정돈 A안, #1077 5547935464): 실측에서 폰(390px)의 첫 글자가 화면 35~63% 지점에 있었다 —
 * 본문 위에 뒤로가기 줄·시리즈 내비 줄·배지·액션바(두 줄 89px)·책 내비 바(50px)·PDF 카드(148px)가
 * 쌓여서다. 소스 계약(viewerMinimal.test.js)은 "무엇이 어디에 있나"를 지키지만 **높이**는 못 잰다 —
 * 크롬 기하는 CSS 규칙 하나하나가 옳아도 상호작용으로 깨진다(v2-Q 교훈, typography.e2e.mjs 선례).
 *
 * 이식성: 앱 서버·빌드 불요(index.css 실물 + ViewerPage 렌더 구조 재현). 러너에 CJK 폰트가 없어도
 * 크롬 행 높이는 라틴·시스템 폰트로 결정되므로 **상한 단언**은 성립한다(여유 20px 포함).
 */
const CSS = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const GNB = 56;
const wrap = (body) => `<style>${CSS}</style><style>body{margin:0}</style>
<div class="viewer-3col viewer-theme-light"><aside class="viewer-side viewer-side--left"></aside><main class="viewer-center">${body}</main><aside class="viewer-side viewer-side--right"></aside></div>`;

// ViewerPage 헤더 구조 재현(A안) — 경로 줄 [← 자료실 · 형제 내비 | 도구] → 제목 → 배지 3
const header = ({ nav }) => `
<header class="page-header viewer-header">
  <div class="viewer-topbar">
    <a class="viewer-back-link" href="#">← 자료실</a>
    ${nav ? '<div class="viewer-series-nav" title="《HSK 5 문장 320》"><span class="viewer-series-nav__btn">◀</span><span class="viewer-series-nav__position">3/20</span><span class="viewer-series-nav__btn">▶</span></div>' : ''}
    <div class="viewer-topbar__tools"><div class="listen-controls"><button class="btn btn--ghost btn--sm">▷ 듣기</button></div><button class="viewer-aa">Aa</button></div>
  </div>
  <div class="viewer-titlerow"><h1 class="page-header__title">北京的秋天 — 第三课</h1><button class="viewer-title-edit">편집</button></div>
  <div class="viewer-badges"><a class="viewer-badge" href="#">12개 수집 → 단어장</a><span class="viewer-badge viewer-badge--due">3개 복습 가능</span><span class="viewer-badge">아는 단어 92% · 새 단어 14개</span></div>
</header>`;
const pdfLine = '<p class="viewer-attribution">출처: PDF 《新HSK5 阅读》 p.12-16<span class="viewer-attribution__muted"> / 180p</span> · <a href="#">원본 PDF 보기 →</a></p>';
const reader = '<div class="card reader-area reader-area--light"><div class="word-token" id="first"><span class="surface">秋</span></div></div>';

/** 경우별 상한(px, GNB 포함) — 정돈 전 실측: B 374 · C 434 · D 534 (390px). */
const CASES = [
  { name: 'B 단어 담긴 뒤(배지 3)', body: header({ nav: false }) + reader, max390: 300, max1280: 290 },
  { name: 'C 책 챕터(배지 3 + 형제 내비)', body: header({ nav: true }) + reader, max390: 300, max1280: 290 },
  { name: 'D PDF 범위(배지 3 + 출처 한 줄)', body: header({ nav: false }) + pdfLine + reader, max390: 330, max1280: 320 },
];

let browser;
before(async () => { browser = await chromium.launch(config.use.launchOptions); });
after(async () => { await browser?.close(); });

async function firstGlyphTop(width, body) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  try {
    await page.setContent(wrap(body));
    return await page.evaluate(() => Math.round(document.querySelector('#first').getBoundingClientRect().top));
  } finally { await page.close(); }
}

for (const c of CASES) {
  test(`첫 글자 상한 — ${c.name}`, async () => {
    const at390 = (await firstGlyphTop(390, c.body)) + GNB;
    const at1280 = (await firstGlyphTop(1280, c.body)) + GNB;
    assert.ok(at390 <= c.max390, `390px: 첫 글자 top ${at390}px > ${c.max390}px — 본문 위 크롬이 다시 자랐다`);
    assert.ok(at1280 <= c.max1280, `1280px: 첫 글자 top ${at1280}px > ${c.max1280}px`);
  });
}

test('경로 줄이 한 줄이다 — 뒤로가기·내비·도구가 같은 행(390px에서도 내비가 있으면 두 줄까지)', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  try {
    await page.setContent(wrap(header({ nav: true }) + reader));
    const tops = await page.evaluate(() => [...document.querySelectorAll('.viewer-back-link, .viewer-series-nav, .viewer-aa')]
      .map((el) => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)));
    assert.ok(Math.max(...tops) - Math.min(...tops) <= 4, `경로 줄 요소들의 세로 중심이 갈렸다: ${tops.join(',')}`);
  } finally { await page.close(); }
});
