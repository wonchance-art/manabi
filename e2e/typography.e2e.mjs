import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';

/**
 * 조판 기하 e2e — 실제 렌더 좌표로 병음·요미가나 계약을 지킨다.
 *
 * 왜 필요한가(2026-08-19): 병음·요미가나 조판은 소스 계약(pinyinRuby.test.js — CSS에
 * 이 규칙이 있는가)으로만 지켜지고 있었는데, 규칙이 "있어도" 상호작용으로 결과가
 * 깨질 수 있다 — 실제로 하루에 5개 PR(#1055~#1059)을 왕복한 원인 전부가 소스에는
 * 문제없어 보이는 기하 회귀였다(폭 예약이 그리드를 깨고, bottom 기준 상자가 어긋나고,
 * 크기 차등이 병음 줄을 흔들었다). 여기서는 브라우저가 계산한 좌표 자체를 단언한다.
 *
 * CI 이식성: 러너에 CJK 폰트가 없어도 성립하도록 절대 px가 아니라 **등식·단일값**만
 * 단언한다(ON=OFF 좌표 동일, 폭 단일값, top 단일값 등). 라틴(병음)만은 어느 러너에도
 * 있으므로 겹침 검사에 쓴다. 앱 서버·빌드가 필요 없다(index.css 실물 + 정적 마크업).
 */

const CSS = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const PAGE = (body) => `<style>${CSS}</style><style>body{margin:0;font-size:20px}#row{padding:48px 64px}</style><div id="row">${body}</div>`;

// 뷰어 렌더 구조 재현(ViewerPage renderToken과 동일한 마크업 계약 — pinyinRuby.test.js가
// 소스 쪽을, 이 파일이 결과 쪽을 지킨다)
const zhSeg = (ch, py) => `<ruby data-pinyin="1">${ch}<span class="rt-an">${py}</span></ruby>`;
const jaSeg = (k, r) => `<ruby data-yomi="1">${k}<span class="rt-an">${r}</span></ruby>`;
const tok = (inner, off) => `<div class="word-token"><span class="surface${off ? ' surface--furi-off' : ''}">${inner}</span></div>`;

// 최장 병음(chuāng·shuāng)을 인접시킨 최악 배치 포함
const ZH = [['我', 'wǒ'], ['去', 'qù'], ['窗', 'chuāng'], ['双', 'shuāng'], ['前', 'qián'], ['广', 'guǎng'], ['州', 'zhōu']];
const zhLine = (off) => ZH.map(([c, p]) => tok(zhSeg(c, p), off)).join('') + tok('。', off);

// 최장 요미(志=こころざし·承=うけたまわ) + 가나 혼재
const jaLine = (off) => [
  tok(jaSeg('私', 'わたし'), off), tok('は', off), tok(jaSeg('志', 'こころざし'), off), tok('を', off),
  tok(jaSeg('承', 'うけたまわ') + 'る', off), tok(jaSeg('勉強', 'べんきょう'), off), tok('します', off), tok('。', off),
].join('');

let browser;
let page;

before(async () => {
  browser = await chromium.launch(config.use.launchOptions);
  page = await browser.newPage({ viewport: { width: 1200, height: 500 } });
});
after(async () => { await browser?.close(); });

/** 토큰별 기하: 글자(비-rt 텍스트) 좌표와 rt 좌표 */
async function measure(body) {
  await page.setContent(PAGE(body));
  return page.evaluate(() => {
    const out = [];
    for (const t of document.querySelectorAll('.word-token')) {
      const surface = t.querySelector('.surface');
      const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
      let node; const glyphs = [];
      while ((node = walker.nextNode())) {
        if (node.parentElement.tagName === 'RT' || node.parentElement.classList.contains('rt-an')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const b = range.getBoundingClientRect();
        glyphs.push({ l: b.left, r: b.right, t: b.top, w: b.width });
      }
      const rt = surface.querySelector('rt, .rt-an');
      const rb = rt ? rt.getBoundingClientRect() : null;
      out.push({
        left: +glyphs[0].l.toFixed(1), tops: glyphs.map((g) => +g.t.toFixed(1)),
        width: +(glyphs.at(-1).r - glyphs[0].l).toFixed(1),
        rt: rb ? { l: +rb.left.toFixed(1), r: +rb.right.toFixed(1), b: +rb.bottom.toFixed(1), fs: parseFloat(getComputedStyle(rt).fontSize) } : null,
        glyphTop: +glyphs[0].t.toFixed(1),
      });
    }
    return out;
  });
}

const uniq = (arr) => [...new Set(arr)];

/** rt가 본문 바로 위 띠 안에 있는가 — 절대배치가 풀리면(rt가 옆이나 아래로 가면) ON=OFF
 *  등식·단일값 검사는 전부 통과해버린다(visibility:hidden이 자리를 유지하므로). 실측
 *  정상값은 −2~−2.5px(살짝 겹침)이고, 절대배치가 풀리면 −1em급, bottom:100% 회귀면
 *  +13px(0.65em)이므로 [−6, +6]px 대역이 셋을 전부 구분한다(음성 검증으로 확인). */
function assertGapBand(gap, label) {
  assert.ok(gap >= -6 && gap <= 6,
    `${label}-본문 간격 ${gap}px가 정상 대역[-6, +6]을 벗어남 — rt가 본문 위에 있지 않다`);
}

test('중국어 — 병음 토글이 글자 좌표를 1px도 못 움직인다', async () => {
  const on = await measure(zhLine(false));
  const off = await measure(zhLine(true));
  const shifts = on.map((x, i) => +(x.left - off[i].left).toFixed(1));
  assert.deepEqual(uniq(shifts), [0], `토큰별 시프트: ${shifts}`);
});

test('중국어 — 정사각 그리드: 병음 글자 폭·세로 위치가 단일값이다', async () => {
  const on = await measure(zhLine(false));
  const rubyToks = on.slice(0, ZH.length); // 마지막 。 제외
  const widths = uniq(rubyToks.map((x) => x.width));
  assert.equal(widths.length, 1, `병음 길이(wǒ~chuāng)와 무관하게 폭 단일값이어야 함: ${widths}`);
  const tops = uniq(on.flatMap((x) => x.tops));
  assert.equal(tops.length, 1, `글자 top 단일값(일자)이어야 함: ${tops}`);
});

test('중국어 — 병음은 전 음절 단일 크기이고 최장 인접쌍(chuāng·shuāng)도 겹치지 않는다', async () => {
  const on = await measure(zhLine(false));
  const rts = on.filter((x) => x.rt);
  const sizes = uniq(rts.map((x) => x.rt.fs));
  assert.equal(sizes.length, 1, `병음 크기 단일값이어야 함: ${sizes}`);
  assert.ok(sizes[0] < 10, `병음(0.26em)은 요미(0.5em=10px)보다 작아야 함: ${sizes[0]}px`);
  for (let i = 0; i + 1 < rts.length; i++) {
    assert.ok(rts[i].rt.r <= rts[i + 1].rt.l + 0.5,
      `병음 겹침: ${i}번째 rt 오른끝 ${rts[i].rt.r} > 다음 rt 왼끝 ${rts[i + 1].rt.l}`);
  }
  const gaps = uniq(rts.map((x) => +(x.glyphTop - x.rt.b).toFixed(1)));
  assert.equal(gaps.length, 1, `병음-본문 간격 단일값이어야 함: ${gaps}`);
  assertGapBand(gaps[0], '병음');
});

test('일본어 — 요미 토글이 글자 좌표를 못 움직이고, 최장 요미(志)도 한자 폭을 못 늘린다', async () => {
  const on = await measure(jaLine(false));
  const off = await measure(jaLine(true));
  const shifts = on.map((x, i) => +(x.left - off[i].left).toFixed(1));
  assert.deepEqual(uniq(shifts), [0], `토큰별 시프트: ${shifts}`);
  // 志(1자, 요미 5자)의 base 폭 = 다른 1자 한자와 동일해야 함(요미가 밀어내지 못함)
  const kokorozashi = on[2]; const watashi = on[0];
  assert.equal(kokorozashi.width, watashi.width,
    `志 폭 ${kokorozashi.width} ≠ 私 폭 ${watashi.width} — 요미가 base를 밀었다`);
  // 요미는 넘침이 정상 — rt가 base보다 넓다(절대배치가 살아 있다는 표지)
  assert.ok(kokorozashi.rt.r - kokorozashi.rt.l > kokorozashi.width,
    '志의 rt(こころざし)는 base보다 넓게 넘쳐야 정상(일본 조판 표준)');
});

test('일본어 — 글자 top·요미 크기·간격이 단일값이다(요미는 0.5em 유지)', async () => {
  const on = await measure(jaLine(false));
  const tops = uniq(on.flatMap((x) => x.tops));
  assert.equal(tops.length, 1, `글자 top 단일값이어야 함: ${tops}`);
  const rts = on.filter((x) => x.rt);
  assert.deepEqual(uniq(rts.map((x) => x.rt.fs)), [10], '요미 크기는 0.5em(=10px@20px) 유지');
  const gaps = uniq(rts.map((x) => +(x.glyphTop - x.rt.b).toFixed(1)));
  assert.equal(gaps.length, 1, `요미-본문 간격 단일값이어야 함: ${gaps}`);
  assertGapBand(gaps[0], '요미');
});

test('성조 색상 — 본문(.word-token 안) 병음 rt에 실제로 색이 칠해진다', async () => {
  // #1064 회귀(오너 발견): 소스에는 규칙이 있었지만 기본색 규칙(.word-token rt)이
  // 순서로 이겨 본문만 무색이었다 — 소스 검사로는 못 잡는 종류라 계산된 색을 단언한다.
  await page.setContent(PAGE(
    tok(`<ruby data-pinyin="1">我<span class="rt-an pinyin-tone--3">wǒ</span></ruby>`, false)
    + tok(`<ruby data-pinyin="1">去<span class="rt-an">qù</span></ruby>`, false),
  ));
  const { toned, plain } = await page.evaluate(() => {
    const [a, b] = [...document.querySelectorAll('.rt-an')].map((el) => getComputedStyle(el).color);
    return { toned: a, plain: b };
  });
  assert.notEqual(toned, plain, `성조 클래스 rt가 기본 병음색 그대로다: ${toned}`);
});

test('집중 모드 — 지정 문장만 원래 밝기, 나머지는 어둡고, 좌표는 1px도 안 움직인다', async () => {
  const line = (focus) => `<div id="row2" class="reader-area${focus ? ' reader-area--focus' : ''}" style="min-height:0;padding:24px">`
    + tok(zhSeg('我', 'wǒ'), false).replace('word-token', 'word-token word-token--picked')
    + tok(zhSeg('去', 'qù'), false) + tok('。', false) + '</div>';
  await page.setContent(PAGE(line(true)));
  const focus = await page.evaluate(() => {
    const toks = [...document.querySelectorAll('#row2 .word-token')];
    return {
      ops: toks.map((t) => parseFloat(getComputedStyle(t).opacity)),
      lefts: toks.map((t) => +t.getBoundingClientRect().left.toFixed(1)),
    };
  });
  assert.equal(focus.ops[0], 1, `지정 토큰은 원래 밝기여야 함: ${focus.ops[0]}`);
  assert.ok(focus.ops[1] < 0.3 && focus.ops[2] < 0.3, `비지정 토큰은 어두워야 함: ${focus.ops.slice(1)}`);
  await page.setContent(PAGE(line(false)));
  const off = await page.evaluate(() => {
    const toks = [...document.querySelectorAll('#row2 .word-token')];
    return {
      ops: toks.map((t) => parseFloat(getComputedStyle(t).opacity)),
      lefts: toks.map((t) => +t.getBoundingClientRect().left.toFixed(1)),
    };
  });
  assert.deepEqual(uniq(off.ops), [1], '집중 모드 해제 시 전 토큰 원래 밝기');
  assert.deepEqual(focus.lefts, off.lefts, '어둡기는 좌표를 못 움직인다(opacity는 레이아웃 무관)');
});

test('레퍼런스(.ja-ruby) — 긴 요미가 문장 폭을 못 늘리고, 두 line-height 컨텍스트의 간격이 정합한다', async () => {
  const body = `
    <div id="withRuby" class="ja-ruby" style="display:inline-block">私<span>は</span><ruby>志<span class="rt-an">こころざし</span></ruby><span>を</span><ruby>承<span class="rt-an">うけたまわ</span></ruby><span>る</span></div>
    <br />
    <div id="noRuby" class="ja-ruby" style="display:inline-block">私<span>は</span>志<span>を</span>承<span>る</span></div>
    <div class="bk-ex__ja"><span class="ja-ruby" id="bk"><ruby>勉強<span class="rt-an">べんきょう</span></ruby><span>します</span></span></div>`;
  await page.setContent(PAGE(body));
  const out = await page.evaluate(() => {
    const w = (id) => +document.getElementById(id).getBoundingClientRect().width.toFixed(1);
    const gap = (rootId) => {
      const root = document.getElementById(rootId);
      const rt = root.querySelector('rt, .rt-an');
      const range = document.createRange();
      range.selectNodeContents(root.querySelector('ruby').childNodes[0]);
      return +(range.getBoundingClientRect().top - rt.getBoundingClientRect().bottom).toFixed(1);
    };
    return { withRuby: w('withRuby'), noRuby: w('noRuby'), gapMain: gap('withRuby'), gapBk: gap('bk') };
  });
  assert.equal(out.withRuby, out.noRuby,
    `루비 유무로 문장 폭이 달라짐: ${out.withRuby} vs ${out.noRuby} — 요미가 base를 밀었다`);
  // 두 컨텍스트(lh 2.05 / 1.9)의 bottom 상수가 각자 유도식대로면 간격이 근사해야 한다(±1px)
  assert.ok(Math.abs(out.gapMain - out.gapBk) <= 1,
    `lh 컨텍스트 간 간격 불일치: 본문 ${out.gapMain} vs 책예문 ${out.gapBk}`);
  assertGapBand(out.gapMain, '레퍼런스 요미');
  assertGapBand(out.gapBk, '책예문 요미');
});
