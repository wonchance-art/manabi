import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';
import { hunRubyCells } from '../src/lib/viewerHunRuby.js';

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
const READER_CSS=fs.readFileSync(new URL('../src/components/viewer/reader-controls.css',import.meta.url),'utf8');
const PAGE = (body) => `<style>${CSS}\n${READER_CSS}</style><style>body{margin:0;font-size:20px}#row{padding:48px 64px;width:100%}</style><div class="viewer-layout" data-pron-spacing="reserved" style="--pinyin-size:.75rem;--pinyin-cell:44px"><div id="row">${body}</div></div>`;

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
  await page.setContent(PAGE(`<div class="reader-area" style="font-size:20px;min-height:0;padding:0">${body}</div>`));
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

// Load the real reader overrides after index.css: a later --new rule previously
// erased the selected-state blend even though all canonical rules were present.
for (const theme of ['light','sepia','dark']) {
  test(`단어 상태 × 범위 지정 — ${theme}: 색은 변하고 글자·병음 좌표는 유지된다`, async () => {
    const states=['new','met','saved','due','known'];
    const content=states.map((state,i)=>tok(zhSeg(ZH[i][0],ZH[i][1]),false).replace('word-token',`word-token${state==='known'?'':` word-token--${state}`}${state==='due'?' word-token--saved':''}`)).join('');
    await page.setContent(PAGE(`<style>*,*::before,*::after{transition:none!important;animation:none!important}</style><div class="reader-area reader-area--hl reader-area--${theme}" style="font-size:24px;gap:16px;--reader-selected:#e9eee7;--primary:#944759;--primary-glow:#ead5da">${content}</div>`));
    const read=()=>page.locator('.word-token').evaluateAll(tokens=>tokens.map(t=>{
      const surface=t.querySelector('.surface'),ruby=surface.querySelector('ruby'),rt=surface.querySelector('.rt-an');
      const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
      const b=getComputedStyle(surface,'::before'),w=parseFloat(b.borderBottomWidth)||0,line=w>0&&!/rgba\(\d+, \d+, \d+, 0\)/.test(b.borderBottomColor)?b.borderBottomColor:null;
      return {color:b.backgroundColor,line,opacity:getComputedStyle(surface).opacity,glyph:rect(ruby),pron:rect(rt)};
    }));
    const before=await read();
    // AD-R2(VIEWER-V2-ROUNDS-001 §5 — 오너 확정, 08-27 B안 수정): 새 단어·만난 말은 면 칠 없이 밑줄,
    // 면 칠은 학습 중·복습에만.
    for(const i of [0,1]) {
      assert.equal(before[i].color,'rgba(0, 0, 0, 0)',`${states[i]}: new words must not be filled`);
      assert.ok(before[i].line,`${states[i]}: new words must carry an underline`);
    }
    for(const i of [2,3]) assert.notEqual(before[i].color,'rgba(0, 0, 0, 0)',`${states[i]}: learning/due keep their fill`);
    assert.equal(before[4].color,'rgba(0, 0, 0, 0)');assert.equal(before[4].line,null,'known words stay unmarked');
    await page.locator('.word-token').evaluateAll(tokens=>tokens.forEach(t=>t.classList.add('word-token--picked')));
    const picked=await read();
    for(let i=0;i<states.length;i++) {
      assert.notEqual(picked[i].color,before[i].color,`${states[i]}: range selection must change its state color`);
      assert.deepEqual(picked[i].glyph,before[i].glyph);
      assert.deepEqual(picked[i].pron,before[i].pron);
      assert.equal(picked[i].opacity,'1');
    }
    // VIEWER-R0 bug 11 (owner 2026-10-07): "met" shares the new-word display, so selection keeps four
    // distinct states (new = met, saved, due, known) instead of five. AD-R2: the new-word state is now the
    // underline (kept while selected over the neutral selection band), so a state is fill + underline.
    assert.deepEqual([picked[1].color,picked[1].line],[picked[0].color,picked[0].line],'met keeps the new-word display while selected');
    assert.equal(picked[0].line,before[0].line,'selected new words keep the same underline');
    assert.equal(picked[0].color,picked[4].color,'selected new words sit on the plain selection band (no blend)');
    assert.equal(new Set(picked.map(t=>`${t.color}|${t.line}`)).size,4,'selection must preserve four distinct learning states');
    await page.locator('.word-token').evaluateAll(tokens=>tokens.forEach(t=>t.classList.remove('word-token--picked')));
    assert.deepEqual(await read(),before,'clearing selection restores every state without shifting text');
    await page.locator('.reader-area').evaluate(e=>e.classList.remove('reader-area--hl'));
    await page.locator('.word-token').evaluateAll(tokens=>tokens.forEach(t=>t.classList.add('word-token--picked')));
    const off=await read();
    assert.equal(new Set(off.map(t=>t.color)).size,1,'state mode off keeps the ordinary selection band');
    assert.equal(off[0].line,null,'state mode off: new words carry no underline');
  });
}

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
  assert.equal(sizes[0],12, `병음 기본 12px: ${sizes[0]}px`);
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

test('실제 읽기 영역·Aa — 기본 병음색이 같고 성조 색을 덮지 않는다', async () => {
  await page.setContent(PAGE(['reader-area','reader-settings__preview'].map(cls=>`<div class="${cls}">${tok(zhSeg('窗','chuāng'),false)}${tok(zhSeg('我','wǒ'),false)}</div>`).join('')));
  const colors=()=>page.locator('.rt-an').evaluateAll(es=>es.map(e=>getComputedStyle(e).color));
  const normal=await colors();
  assert.equal(new Set(normal).size,1,'body and preview must use the same neutral annotation color');
  await page.locator('.rt-an').evaluateAll(es=>es.forEach((e,i)=>e.classList.add(`pinyin-tone--${i%2?3:1}`)));
  const toned=await colors();
  assert.notEqual(toned[0],normal[0],'first tone must change color inside the reader');
  assert.notEqual(toned[1],normal[1],'third tone must change color inside the reader');
  assert.notEqual(toned[0],toned[1]);
  assert.deepEqual(toned.slice(0,2),toned.slice(2),'Aa must match body tone colors');
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
  // AD-R2(VIEWER-V2-ROUNDS-001 §5 — 오너 확정): 흐림 0.28 → 0.5. 주변 문장도 읽히는 밝기(종이 3.08:1).
  assert.deepEqual(focus.ops,[1,.5,.5], "지정 문장은 선명하게, 주변 문장은 50%로 낮춘다");
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

test('카드 — 표제어는 40–56px, 병음은 독립 15px로 균일', async () => {
  // 카드 마크업 재현(ViewerPage wordDetailCard — 글자는 word-fit__char 스팬으로 감싼다)
  const fitSeg = (ch, py, yomi = false) =>
    `<ruby data-${yomi ? 'yomi' : 'pinyin'}="1"><span class="word-fit__char">${ch}</span><span class="rt-an">${py}</span></ruby>`;
  const fit = (inner, n, cap = '') =>
    `<div class="word-fit-wrap" style="width:248px"><div class="word-fit" style="--fit-n:${n}${cap ? `; --fit-cap:${cap}` : ''}"><span class="surface">${inner}</span></div></div>`;
  await page.setContent(PAGE(
    fit(fitSeg('强', 'qiáng') + fitSeg('调', 'diào'), 2) +
    fit(fitSeg('我', 'wǒ'), 1) +
    fit(fitSeg('志', 'こころざし', true), 2.5) +
    fit(fitSeg('爱', 'ài'), 1, '200px') +
    fit(fitSeg('爱', 'ài'), 1, '300px')
  ));
  const got = await page.evaluate(() => [...document.querySelectorAll('.word-fit')].map((el) => {
    const cells = [...el.querySelectorAll('ruby[data-pinyin]')].map((r) => r.getBoundingClientRect().width);
    const rt = el.querySelector('.rt-an');
    return {
      fs: parseFloat(getComputedStyle(el).fontSize),
      cells,
      rtFs: parseFloat(getComputedStyle(rt).fontSize),
      rtPos: getComputedStyle(rt).position,
    };
  }));
  for(const item of got) assert.ok(item.fs>=32&&item.fs<=36,`표제어는 32–36px 범위: ${item.fs}`);
  assert.equal(got[0].rtFs,15,'카드 병음은 독립 15px');
  assert.equal(got[0].rtPos,'absolute');
  assert.equal(new Set(got[0].cells).size,1,'카드 병음 칸도 균일');

});

/* ────────────────────────────────────────────────────────────────────────────
 * 뷰어 크롬 기하 (v2-Q, 2026-09-01)
 *
 * 이 파일의 존재 이유가 그대로 적용된다 — 「규칙이 있어도 상호작용으로 결과가 깨진다」.
 * v2-Q가 고친 결함이 정확히 그 종류였다: **CSS 규칙 어디에도 문제가 없는데** 배지 3종의
 * 폭이 제각각이었다. 원인은 각 배지가 아니라 **부모**였다(블록인 `.page-header`의 직계
 * 자식이라 `div`가 전체 폭까지 늘어났다). 소스 계약은 「래퍼가 있다」까지만 말할 수
 * 있으므로, 실제로 **한 줄에 내용 폭으로 서는지**는 브라우저 좌표로 못 박는다.
 *
 * 폰트 없는 러너에서도 성립하도록 절대 px가 아니라 **관계**만 단언한다
 * (같은 y · 컨테이너보다 좁다 · 글자 수 순서 · 넘침 0 · 왼쪽/오른쪽).
 * ────────────────────────────────────────────────────────────────────────── */

const CHROME_W = 900;
const chromePage = (body, w = CHROME_W) =>
  `<style>${CSS}</style><style>body{margin:0}#w{width:${w}px}</style><div id="w">${body}</div>`;

const badgeRow = `<div class="viewer-badges">
  <a class="viewer-badge viewer-badge--pop">103개 수집 → 단어장</a>
  <span class="viewer-badge viewer-badge--due">6개 복습</span>
  <span class="viewer-badge">아는 단어 23% · 새 단어 102개</span>
</div>`;
const chromeHeader = `<header class="page-header viewer-header">
  <a class="viewer-back-link">← 자료실</a>
  <div class="viewer-titlerow"><h1 class="page-header__title">HSK 5 — 1과</h1><button class="viewer-title-edit">편집</button></div>
  ${badgeRow}
</header>`;

/** 기하를 재기 전에 진행 중인 애니메이션을 끝까지 돌린다.
 *  수집 배지의 팝(`vocabCounterPop`)은 `scale(0.9)`에서 시작하므로, 그냥 재면 **애니메이션
 *  중간 좌표**를 잡아 좌우가 안쪽으로 밀린 값이 나온다(실측: 첫 배지 left 0 → 7.02).
 *  CI 타이밍에 따라 값이 흔들리는 flaky의 씨앗이라 여기서 확정적으로 없앤다. */
const settle = () => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

const boxes = async (sel) => {
  await settle();
  return page.$$eval(sel, (els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
  }));
};

test('뷰어 배지 3종 — 한 줄에, 각자 내용 폭으로 선다', async () => {
  await page.setContent(chromePage(chromeHeader));
  const b = await boxes('.viewer-badge');
  assert.equal(b.length, 3, '배지 3종');
  assert.equal(new Set(b.map((r) => r.y)).size, 1, `한 줄이어야 한다: ${JSON.stringify(b)}`);
  for (const r of b) {
    assert.ok(r.w < CHROME_W * 0.6, `배지가 전체 폭으로 늘어났다(${r.w}px) — 래퍼가 죽었다`);
  }
  // 글자 수가 적은 배지가 더 좁다 = 내용 폭이라는 증거(고정 폭이면 같아진다).
  assert.ok(b[1].w < b[0].w && b[0].w < b[2].w, `내용 폭 순서 기대(복습<수집<커버리지): ${JSON.stringify(b.map((r) => r.w))}`);
  // 래퍼가 죽어도(block) 배지가 inline-flex라 한 줄·내용 폭은 유지된다 — 돌연변이 실측.
  // 래퍼만이 주는 것은 **간격**이다: 공백 문자가 아니라 토큰 gap(8px)이어야 한다.
  // (위 boxes()는 x·w를 따로 반올림해 간격이 ±2px 흔들린다 — 여기선 원좌표로 잰다.)
  await settle();
  const gaps = await page.$$eval('.viewer-badge', (els) => {
    const r = els.map((e) => e.getBoundingClientRect());
    return [r[1].left - r[0].right, r[2].left - r[1].right];
  });
  for (const gap of gaps) {
    assert.ok(Math.abs(gap - 8) < 0.6, `배지 사이 gap 8px 기대(래퍼 flex가 죽으면 공백 폭이 된다): ${gap}`);
  }
});

test('옛 구조 대조군 — 래퍼가 없으면 실제로 전체 폭까지 늘어난다', async () => {
  // 진단이 추측이 아니었음을 브라우저로 남긴다. 이 단언이 깨지면 전제가 바뀐 것이므로
  // 위 계약의 의미도 다시 봐야 한다.
  await page.setContent(chromePage(`<header class="page-header viewer-header">
    <h1 class="page-header__title">HSK 5 — 1과</h1>
    <a style="display:inline-block;padding:4px 12px">103개 수집 → 단어장</a>
    <div style="padding:4px 10px">6개 복습</div>
    <div style="padding:4px 10px">아는 단어 23% · 새 단어 102개</div>
  </header>`));
  const w = await page.$$eval('header > a, header > div', (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  assert.equal(w.filter((x) => x >= CHROME_W).length, 2, `블록 배지 둘이 전체 폭이어야 한다(옛 결함): ${JSON.stringify(w)}`);
  assert.ok(w[0] < CHROME_W, `inline-block 배지만 내용 폭이었다: ${w[0]}`);
});

test('좁은 화면 — 배지가 눌리지 않고 다음 줄로 흐른다', async () => {
  // `flex-wrap`이 지키는 것은 **넘침이 아니라 모양**이다. 실측: wrap을 빼도 넘침은 0인데
  // (flex 항목이 기본으로 줄어든다) 배지가 눌려 알약 **안에서 글자가 접힌다**
  //   wrap 있음 → 2줄, 폭 [140,70,192] 높이 30
  //   wrap 없음 → 1줄, 폭 [130,66,178] 높이 **50**
  // 그래서 넘침만 보면 회귀를 놓친다(돌연변이 실측: flex-wrap 제거가 생존했다).
  //
  // ⚠ 폭을 390px로 못 박았더니 **CJK 폰트가 없는 러너에서 셋이 한 줄에 들어가** 깨졌다
  //    (이 파일 머리의 이식성 규칙을 내가 어겼다: 절대 px가 아니라 관계로 단언할 것).
  //    그래서 좁은 폭을 **측정값에서 끌어낸다** — 가장 넓은 배지는 들어가되 셋이 다 서지는
  //    못하는 폭. 폰트가 무엇이든 같은 상황이 만들어진다.
  await page.setContent(chromePage(chromeHeader));
  await settle();
  const wide = await page.$$eval('.viewer-badge', (els) => els.map((e) => {
    const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) };
  }));
  const widest = Math.max(...wide.map((r) => r.w));
  const total = wide.reduce((a, r) => a + r.w, 0) + 8 * (wide.length - 1);
  const narrowW = widest + 20;
  assert.ok(narrowW < total, `좁은 폭이 한 줄 총폭보다 작아야 상황이 성립한다: ${narrowW} vs ${total}`);

  await page.setContent(chromePage(chromeHeader, narrowW));
  await settle();
  const narrow = await page.$$eval('.viewer-badge', (els) => els.map((e) => {
    const r = e.getBoundingClientRect(); return { y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }));
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }));

  assert.ok(sw <= cw, `가로 넘침 ${sw - cw}px`);
  assert.ok(new Set(narrow.map((r) => r.y)).size > 1, `좁은 화면(${narrowW}px)에서는 줄을 나눠 흘러야 한다`);
  narrow.forEach((r, i) => {
    assert.equal(r.w, wide[i].w, `배지 ${i}가 눌렸다(폭 ${wide[i].w}→${r.w}) — 줄바꿈 대신 압축됐다`);
    assert.equal(r.h, wide[i].h, `배지 ${i}가 두 줄이 됐다(높이 ${wide[i].h}→${r.h}) — 알약 안에서 글자가 접혔다`);
  });
});

test('경로 줄 — 경로(뒤로가기·형제 내비)는 왼쪽, 도구는 오른쪽 끝 (뷰어 정돈 A안)', async () => {
  // v2-Q의 액션바(행동 왼쪽·도구 오른쪽)는 A안(#1077 5547935464)에서 경로 줄로 대체됐다 — 행동은
  // 본문 아래로 갔고, 위에는 경로와 도구만 남는다. 축은 같다: 왼쪽 정렬 + 도구는 auto 마진으로 오른쪽 끝.
  await page.setContent(chromePage(`<div class="viewer-topbar">
    <a class="viewer-back-link" href="#">← 자료실</a>
    <div class="viewer-series-nav" title="《HSK 5 문장 320》"><span class="viewer-series-nav__btn">◀</span><span class="viewer-series-nav__position">3/20</span><span class="viewer-series-nav__btn">▶</span></div>
    <div class="viewer-topbar__tools">
      <div class="listen-controls"><button class="btn btn--ghost btn--sm">▷ 듣기</button></div>
      <button class="viewer-tool viewer-tool--aa"><span aria-hidden="true">Aa</span></button>
    </div>
  </div>`));
  const back = (await boxes('.viewer-back-link'))[0];
  const nav = (await boxes('.viewer-series-nav'))[0];
  const tools = (await boxes('.viewer-topbar__tools'))[0];
  assert.ok(back.x <= 1, `경로는 왼쪽 정렬(제목·배지와 같은 축): x=${back.x}`);
  assert.ok(back.x < nav.x && nav.x < tools.x, `뒤로가기 → 내비 → 도구 순서: ${JSON.stringify([back, nav, tools])}`);
  assert.ok(Math.abs(tools.x + tools.w - CHROME_W) <= 1, `도구는 오른쪽 끝: 우변 ${tools.x + tools.w}`);
  // 한 줄 — 내비가 옛 .book-nav처럼 아래 줄에 채워진 바로 내려앉지 않는다
  assert.ok(Math.abs(back.y - nav.y) <= 4 && Math.abs(nav.y - tools.y) <= 8, `경로 줄이 갈라졌다: ${JSON.stringify([back, nav, tools])}`);
});

test('경로 줄 — 뒤로가기·내비가 없어도 도구는 오른쪽에 남는다', async () => {
  // 왼쪽이 비면 `justify-content: space-between`은 도구를 **왼쪽으로 보낸다**.
  // 두 경우를 다 감당하는 것은 auto 마진뿐이라, 그 근거를 여기서 못 박는다(v2-Q 선례 그대로).
  await page.setContent(chromePage(`<div class="viewer-topbar">
    <div class="viewer-topbar__tools">
      <button class="viewer-tool viewer-tool--aa"><span aria-hidden="true">Aa</span></button>
    </div>
  </div>`));
  const tools = (await boxes('.viewer-topbar__tools'))[0];
  assert.ok(Math.abs(tools.x + tools.w - CHROME_W) <= 1, `도구가 왼쪽으로 튀었다: ${JSON.stringify(tools)}`);
});


// The original pinyin grid remains unchanged (HUN_CARD(false) is the plain pinyin card used below).
const HUN_CARD = () => `<div class="word-fit-wrap"><div class="word-fit" lang="zh-Hans" style="--fit-n:2">
  <span class="surface"><ruby data-pinyin="1">杯<span class="rt-an">bēi</span></ruby><ruby data-pinyin="1">子<span class="rt-an">zi</span></ruby></span>
</div></div>`;

// AE-R1 개정(VIEWER-V2-ROUNDS-001 §2.1 표제어 덩어리 — 「훈음은 한자 아래 루비로 되돌린다. 별도 훈음 목록은 없앤다.
// 겹침 방지: 훈음이 글자 폭을 넘으면 그 글자 칸을 벌린다(--hun-n), 그래도 넘치면 훈과 음을 두 줄로」, 설계서 §7.2):
// 옛 별도 목록(.reader-hun) 대신 실제 셀 계산(hunRubyCells)으로 만든 루비 셀 마크업을 index.css·reader-controls.css
// 실물로 그려, 긴 풀이 훈(弩)도 잘리지 않고 자기 칸 안에서 줄바꿈하며 이웃 칸·글자·뜻과 겹치지 않는지 잰다.
const readData=f=>JSON.parse(fs.readFileSync(new URL(`../src/lib/data/${f}`,import.meta.url),'utf8'));
const hunTables={koTable:readData('hanjaKo.json'),hunTable:readData('hanjaHun.json'),tradTable:readData('hanjaTrad.json')};
const longHun=hunTables.hunTable.弩+' 노';
const hunCols=(word,readings)=>hunRubyCells(word,hunTables).map((cell,i)=>`<span class="word-fit__col"><ruby data-pinyin="1"><span class="reader-card-ruby-glyphs"><span class="word-fit__char">${cell.ch}</span></span><span class="rt-an">${readings[i]}</span></ruby><span class="word-fit__hunrow">${cell.label?`<span class="word-fit__hun" lang="ko" data-label="${cell.label}"${cell.wrap?' data-wrap="1"':''} style="--hun-n:${cell.hunN}">${cell.lines.map(l=>`<span class="word-fit__hun-line">${l}</span>`).join('')}</span>`:''}</span></span>`).join('');
const longHunCard=`<div class="reader-card-headword"><div class="word-fit-wrap"><div class="word-fit word-fit--hun" lang="zh-Hans" style="--fit-n:2"><span class="surface">${hunCols('连弩',['lián','nǔ'])}</span></div></div></div><div class="word-detail-card__meaning">연발 쇠뇌</div>`;
for(const width of [170,300,680])for(const scale of [1,2]) {
 test(`긴 훈음 루비 — ${width}px 카드/${scale*100}% 확대에서 온전한 셀·칸 벌림·무겹침`,async()=>{
  await page.setContent(PAGE(`<style>#row{padding:0;width:${width}px;zoom:${scale}}</style>${longHunCard}`));
  const g=await page.evaluate(()=>{
   const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom,height:b.height}};
   const ink=e=>{const range=document.createRange();range.selectNodeContents(e);return r(range);};
   return {row:r(document.querySelector('#row')),meaning:r(document.querySelector('.word-detail-card__meaning')),
    cols:[...document.querySelectorAll('.word-fit__col')].map(col=>({col:r(col),glyph:ink(col.querySelector('.word-fit__char')),hun:r(col.querySelector('.word-fit__hun')),
     style:(s=>({position:s.position,overflow:s.overflow,textOverflow:s.textOverflow}))(getComputedStyle(col.querySelector('.word-fit__hun')))})),
    labels:[...document.querySelectorAll('.word-fit__hun')].map(e=>e.dataset.label),text:[...document.querySelectorAll('.word-fit__hun')].map(e=>e.textContent)};
  });
  assert.equal(g.cols.length,2);
  for(const {col,glyph,hun,style} of g.cols){
   assert.notEqual(style.position,'absolute','hun cell is in flow');
   assert.equal(style.overflow,'visible');assert.equal(style.textOverflow,'clip');
   assert.ok(hun.y>=glyph.bottom-.5,'hun label sits below its own glyph');
   assert.ok(hun.x>=col.x-.5&&hun.right<=col.right+.5,'hun label stays inside its own column');
   assert.ok(hun.x>=g.row.x-.5&&hun.right<=g.row.right+.5,`hun label stays inside the card: ${JSON.stringify(hun)} / ${JSON.stringify(g.row)}`);
   assert.ok(g.meaning.y>=hun.bottom-.5,'meaning must follow all wrapped labels');
  }
  const [a,b]=g.cols;
  const overlap=(p,q)=>Math.min(p.right,q.right)-Math.max(p.x,q.x)>.5&&Math.min(p.bottom,q.bottom)-Math.max(p.y,q.y)>.5;
  assert.ok(!overlap(a.col,b.col),'neighbouring columns do not overlap');
  assert.ok(!overlap(a.hun,b.glyph)&&!overlap(b.hun,a.glyph),'a label never covers the neighbouring glyph');
  assert.deepEqual(g.labels,['연할 련(연)',longHun],'complete labels — nothing truncated');
  assert.ok(g.text[1].replace(/\s/g,'').includes(longHun.replace(/\s/g,'')),'the long gloss is fully rendered');
  assert.ok(b.hun.height>a.hun.height,'the long gloss wraps inside its capped cell instead of widening without bound');
 });
}

/* ── 요미 칸 分散配置 (JLReq / JIS X 4051, 오너 승인 2026-09-01) ─────────────────────
 * 일본 조판은 요미가 본체보다 길 때 **요미를 삐치게 두지 않고 본체 글자를 벌린다.**
 * 삐짐(はみ出し)은 한쪽 요미 1글자까지만 허용되고 **줄머리·줄끝으로는 금지**인데,
 * 우리 카드는 둘 다 어기고 있었다 — 실측 `志望者`(요미 1.50자 초과)가 카드 왼쪽으로
 * 47px, 요미가 줄 위로 17.8px.
 *
 * 폭은 `--yomi-n`(요미 글자수) × 0.5em을 CSS가 계산한다(`--fit-n`과 같은 패턴).
 * ────────────────────────────────────────────────────────────────────────── */

const JA_CARD = (kanji, yomi, fitN, yomiN) => `<div class="word-fit-wrap"><div class="word-fit" lang="ja" style="--fit-n:${fitN}">
  <span class="surface"><ruby data-yomi="1"${yomiN ? ` style="--yomi-n:${yomiN}"` : ''}>${
  [...kanji].map((c) => `<span class="word-fit__char">${c}</span>`).join('')
}<span class="rt-an">${yomi}</span></ruby></span>
</div></div>`;

const jaGeom = async (markup) => {
  await page.setContent(chromePage(markup, 300));
  await settle();
  return page.evaluate(() => {
    const ruby = document.querySelector('ruby[data-yomi]');
    const rt = ruby.querySelector('.rt-an').getBoundingClientRect();
    const chars = [...ruby.querySelectorAll('.word-fit__char')].map((e) => e.getBoundingClientRect());
    const surf = document.querySelector('.surface').getBoundingClientRect();
    const fit = document.querySelector('.word-fit').getBoundingClientRect();
    const box = ruby.getBoundingClientRect();
    // 인접 간격 n+1개(양끝 포함) — space-evenly면 전부 같다
    const gaps = [box.left, ...chars.map((c) => c.right)]
      .map((l, i) => (i < chars.length ? chars[i].left : box.right) - l);
    return {
      overTop: surf.top - rt.top,       // 줄 위로 삐진 양(양수면 위반)
      overLeft: fit.left - rt.left,     // 줄머리로 삐진 양(양수면 위반)
      overRight: rt.right - fit.right,  // 줄끝으로 삐진 양
      blockH: fit.height,
      firstL: chars[0]?.left, lastR: chars[chars.length - 1]?.right,
      rtL: rt.left, rtR: rt.right,
      boxW: box.width,
      charSum: chars.reduce((a, c) => a + c.width, 0),
      em: parseFloat(getComputedStyle(ruby).fontSize),
      gaps,
    };
  });
};

test('요미가 줄머리·줄끝으로 삐치지 않는다 — JLReq 금지 조항', async () => {
  // 이 셋이 라운드의 합격선이다. 절대 px가 아니라 **부호**만 본다(폰트 없는 러너 대비).
  for (const [k, y, n, yn] of [['志望者', 'こころざしぼうしゃ', 4.5, 9], ['志', 'こころざし', 2.5, 5],
    ['勉強', 'べんきょう', 2.5, 5], ['図書館', 'としょかん', 3, 5]]) {
    const g = await jaGeom(JA_CARD(k, y, n, yn));
    assert.ok(g.overLeft <= 0.5, `${k}: 요미가 줄머리로 ${g.overLeft}px 삐졌다`);
    assert.ok(g.overRight <= 0.5, `${k}: 요미가 줄끝으로 ${g.overRight}px 삐졌다`);
    assert.ok(g.overTop <= 0.5, `${k}: 요미가 줄 위로 ${g.overTop}px 넘쳤다`);
  }
});

test('요미 칸 폭 = max(본체 폭, 요미 예약) — 예약식이 分散配置의 조건이다', async () => {
  // ⚠ 여기서 **렌더된 요미 폭**을 기준으로 삼으면 안 된다. 예약은 `--yomi-n × 0.5em`
  // 이라는 산술이고, 실제 가나가 그 폭으로 그려지는지는 러너 폰트에 달렸다 —
  // CJK 폰트가 없는 CI에서는 가나가 0.5em보다 좁게 떨어져 `志望者`조차 **본체가 이겼다**
  // (실측 본체 225px vs 요미 216px). 그래서 어느 쪽이 이기는지를 전제하지 않고
  // **등식만** 단언한다(이 파일 머리의 이식성 규칙 그대로다).
  for (const [k, y, n, yn] of [['志望者', 'こころざしぼうしゃ', 4.5, 9], ['志', 'こころざし', 2.5, 5],
    ['勉強', 'べんきょう', 2.5, 5], ['図書館', 'としょかん', 3, 5]]) {
    const g = await jaGeom(JA_CARD(k, y, n, yn));
    const want = Math.max(g.charSum, yn * 0.5 * g.em);
    assert.ok(Math.abs(g.boxW - want) <= 0.5,
      `${k}: 요미 칸 폭이 max(본체 ${g.charSum.toFixed(2)}, 예약 ${(yn * 0.5 * g.em).toFixed(2)})가 아니다 — ${g.boxW}`);
  }
});

test('예약이 이기면 본체를 고르게 벌린다 — 지면 벌리지 않는다(分散配置)', async () => {
  // 분기를 폰트에 맡기지 않는다. 먼저 예약 없이 본체 폭을 **재고**, 그 실측 위에서
  // 반드시 이기는 값과 반드시 지는 값을 만들어 양쪽 가지를 모두 밟는다.
  const bare = await jaGeom(JA_CARD('志望者', 'こころざしぼうしゃ', 4.5, null));
  assert.ok(Math.abs(bare.boxW - bare.charSum) <= 0.5, '예약이 없으면 칸은 본체 폭이어야 한다');
  assert.ok(bare.gaps.every((g) => Math.abs(g) <= 0.5),
    `예약이 없는데 본체가 벌어졌다: ${bare.gaps}`);

  const nWide = Math.ceil((bare.charSum / bare.em) * 2) + 2;   // 예약 > 본체 확정
  const wide = await jaGeom(JA_CARD('志望者', 'こころざしぼうしゃ', 4.5, nWide));
  assert.ok(Math.abs(wide.boxW - nWide * 0.5 * wide.em) <= 0.5,
    `예약이 이겼는데 칸이 예약 폭이 아니다: ${wide.boxW}`);
  // space-evenly — 양끝을 포함한 네 간격이 **모두 같고** 0보다 크다
  const spread = (wide.boxW - wide.charSum) / wide.gaps.length;
  assert.ok(spread > 0.5, `예약이 이겼는데 벌어지지 않았다: 여백 ${spread}`);
  for (const g of wide.gaps) {
    assert.ok(Math.abs(g - spread) <= 0.5, `간격이 고르지 않다 — space-evenly가 아니다: ${wide.gaps}`);
  }

  const tight = await jaGeom(JA_CARD('志望者', 'こころざしぼうしゃ', 4.5, 1)); // 예약 0.5em < 본체
  assert.ok(Math.abs(tight.boxW - tight.charSum) <= 0.5,
    `예약이 졌는데 칸이 본체 폭이 아니다: ${tight.boxW} vs ${tight.charSum}`);
  assert.ok(tight.gaps.every((g) => Math.abs(g) <= 0.5),
    `예약이 졌는데 본체가 벌어졌다: ${tight.gaps}`);
});

test('블록 세로는 그대로다 — 分散配置는 가로 처리다', async () => {
  for (const [k, y, n, yn] of [['志望者', 'こころざしぼうしゃ', 4.5, 9], ['図書館', 'としょかん', 3, 5]]) {
    const on = await jaGeom(JA_CARD(k, y, n, yn));
    const off = await jaGeom(JA_CARD(k, y, n, null)); // --yomi-n 없음 = min-width 0
    assert.equal(Math.round(on.blockH * 100), Math.round(off.blockH * 100),
      `${k}: 分散配置가 블록 높이를 바꿨다 ${off.blockH} → ${on.blockH}`);
  }
});

test('가나가 아닌 읽기에는 폭을 예약하지 않는다 — 0.5em/자는 가나 전제다', async () => {
  // 혼종 중국어 토큰(`T壮`)의 읽기는 병음이라 라틴이고, 라틴은 0.5em보다 훨씬 좁다.
  // 게이트 없이 글자수를 넘기면 **없는 폭을 예약**한다 — 실측: 실제 필요 198.5px 자리에
  // 384px(6 × 0.5em)를 잡아 루비가 카드(340px)보다 넓어진다.
  const CARD = (yn) => `<div class="word-fit-wrap"><div class="word-fit" lang="zh-Hans" style="--fit-n:2">
    <span class="surface"><span>T</span><ruby data-yomi="1"${yn ? ` style="--yomi-n:${yn}"` : ''}><span class="word-fit__char">壮</span><span class="rt-an">zhuàng</span></ruby></span>
  </div></div>`;
  const measure = async (markup) => {
    await page.setContent(chromePage(markup, 300));
    await settle();
    return page.evaluate(() => {
      const ruby = document.querySelector('ruby[data-yomi]');
      const rt = ruby.querySelector('.rt-an').getBoundingClientRect();
      return { rubyW: ruby.getBoundingClientRect().width, readW: rt.width,
        fitW: document.querySelector('.word-fit').getBoundingClientRect().width };
    });
  };
  const gated = await measure(CARD(null));
  const leaked = await measure(CARD(6));
  assert.ok(gated.rubyW <= gated.fitW, `게이트가 있는데도 루비가 카드보다 넓다: ${gated.rubyW} vs ${gated.fitW}`);
  // 게이트가 없으면 실제 읽기 폭보다 훨씬 큰 자리를 잡는다 — 그 차이가 게이트의 존재 이유다.
  assert.ok(leaked.rubyW > leaked.readW * 1.5,
    `게이트 없이도 예약이 과하지 않다 — 이 계약의 전제가 무너졌다: ${leaked.rubyW} vs ${leaked.readW}`);
  assert.ok(leaked.rubyW > gated.rubyW, '게이트 유무로 루비 폭이 같다 — 게이트가 일하지 않는다');
});

test('병음 칸은 무접촉 — 요미 규칙이 격자를 건드리지 않는다', async () => {
  // 요미 칸 규칙은 `[data-yomi]` 스코프다. 병음 칸의 1em 격자·읽기 자리는 불변이어야 한다.
  await page.setContent(chromePage(HUN_CARD(false), 300));
  await settle();
  const g = await page.evaluate(() => {
    const ruby = document.querySelector('ruby[data-pinyin]');
    const cs = getComputedStyle(ruby);
    const box = ruby.getBoundingClientRect();
    const rt = ruby.querySelector('.rt-an').getBoundingClientRect();
    return { w: cs.width, minW: cs.minWidth, justify: cs.justifyContent, fromTop: rt.bottom - box.top };
  });
  assert.equal(g.justify, 'center', '병음 칸의 정렬이 바뀌었다');
  assert.ok(!/px/.test(g.minW) || g.minW === '0px', `병음 칸에 min-width가 붙었다: ${g.minW}`);
  assert.equal(Math.round(g.fromTop * 10) / 10, 64, `병음 읽기 자리가 움직였다: ${g.fromTop}`);
});

test('Aa 중국어 명조 — 실제 글자까지 본문과 같은 서체, 병음은 별도 서체', async () => {
  const token=tok(zhSeg('读','dú'),false);
  await page.setContent(PAGE(`<div style="--reader-font:Georgia,serif;--font-noto-sans:Arial,sans-serif">
    <div class="reader-area" lang="zh-Hans">${token}</div>
    <div class="reader-settings__preview" lang="zh-Hans" style="font-family:var(--reader-font)">${token}</div>
  </div>`));
  const fonts=await page.evaluate(()=>{
    const font=s=>getComputedStyle(document.querySelector(s)).fontFamily;
    return {body:font('.reader-area ruby'),preview:font('.reader-settings__preview ruby'),pinyin:font('.reader-settings__preview .rt-an')};
  });
  assert.equal(fonts.preview,fonts.body,'미리보기의 실제 한자가 전역 :lang(zh) 고딕 규칙으로 바뀌면 안 된다');
  assert.match(fonts.preview,/Georgia/);assert.match(fonts.pinyin,/Arial/);
});

/* ──────────────────────────────────────────────────────────────────────────
 * VIEWER-R0 — 띠 밖 표지(문형 밑줄·선택 테두리·병음·저장 밑줄) 기하와 「만난 말」 표시.
 * 마크업은 ViewerPage renderToken과 같은 계약이다(.pattern-mark는 .surface 안 — 소스 쪽은
 * patternIndex.test.js가 지킨다). 상자 기준이라 러너 글꼴과 무관하다. 실글꼴(Noto) 잉크
 * 측정은 이 파일 범위 밖이다(러너에 Noto CJK가 없다).
 * ────────────────────────────────────────────────────────────────────────── */
// 셸 토큰(.manabi-app — --ink 등)이 있어야 선택선·문형선 색이 실제 값으로 풀린다.
const SHELL_CSS = fs.readFileSync(new URL('../src/components/web/web-shell.css', import.meta.url), 'utf8');
const R0_PAGE = (areas, { py = 12, family = 'sans-serif' } = {}) => `<style>${CSS}\n${SHELL_CSS}\n${READER_CSS}</style>
<style>*,*::before,*::after{transition:none!important;animation:none!important}body{margin:0}.reader-area{min-height:0}</style>
<div class="manabi-app"><div class="viewer-layout" data-reader-theme="sepia" data-pron-spacing="reserved" style="--book-main:#466c5d;--book-wash:#e3ebe5;--book-dark-text:#acccb8;--pinyin-size:${py}px;--pinyin-cell:${(py * 3.6).toFixed(1)}px;--reader-font:${family}">${areas}</div></div>`;
const r0Area = ({ fs = 25.6, hl = false, theme = 'sepia', lang = 'zh-Hans', family = 'sans-serif' }, body) =>
  `<div class="reader-area reader-area--${theme}${hl ? ' reader-area--hl' : ''}" lang="${lang}" style="font-size:${fs}px;font-family:${family};gap:15px .25rem;--char-gap:.25rem;padding:24px 16px">${body}<i class="r0-probe" style="position:absolute;width:0;height:0;background:var(--pattern-line)"></i></div>`;
const r0Tok = (segs, { cls = '', selected = false, pattern = false, linePick = false, ja = false } = {}) =>
  `<div class="word-token${cls ? ` ${cls}` : ''}${pattern ? ' word-token--pattern' : ''}"${selected ? ' data-selected="true"' : ''}>${linePick ? '<button class="line-pick"></button>' : ''}<span class="surface">${
    segs.map(([c, r]) => (r ? `<ruby ${ja ? 'data-yomi' : 'data-pinyin'}="1">${c}<span class="rt-an">${r}</span></ruby>` : `<span>${c}</span>`)).join('')
  }${pattern ? '<span class="pattern-mark" aria-hidden="true"></span>' : ''}</span></div>`;

// 상태별 토큰 — 저장·복습·미저장 × 문형 유무, 줄 첫 토큰(막대), 새 단어·만난 말
const R0_ZH = [
  { name: '眼前 미저장+막대', segs: [['眼', 'yǎn'], ['前', 'qián']], linePick: true },
  { name: '体育场 저장', segs: [['体', 'tǐ'], ['育', 'yù'], ['场', 'chǎng']], cls: 'word-token--saved' },
  { name: '比 문형', segs: [['比', 'bǐ']], pattern: true },
  { name: '照片 복습', segs: [['照', 'zhào'], ['片', 'piàn']], cls: 'word-token--saved word-token--due' },
  { name: '尽量 문형+저장', segs: [['尽', 'jǐn'], ['量', 'liàng']], cls: 'word-token--saved', pattern: true },
  { name: '熬夜 새 단어', segs: [['熬', 'áo'], ['夜', 'yè']], cls: 'word-token--new' },
  { name: '爱惜 만난 말', segs: [['爱', 'ài'], ['惜', 'xī']], cls: 'word-token--met' },
  { name: '。', segs: [['。', '']] },
  { name: '更 문형+새 단어', segs: [['更', 'gèng']], cls: 'word-token--new', pattern: true },
];
const R0_JA = [
  { name: 'ja 喫茶店 미저장', segs: [['喫茶店', 'きっさてん']] },
  { name: 'ja 駅前 저장', segs: [['駅前', 'えきまえ']], cls: 'word-token--saved' },
  { name: 'ja 会 복습', segs: [['会', 'あ'], ['いました', '']], cls: 'word-token--saved word-token--due' },
];

/** 토큰별 상자 기하 — 띠(.surface::before)·테두리(.word-token::before, 없으면 옛 inset 그림자)·
 *  병음·밑줄·문형 밑줄. 띠 = 면 칠 범위(top~top+height): content-box면 height가 칠 높이이고,
 *  옛 border-box는 밑줄이 그 안에 있다 — 두 경우 모두 이 식이 「띠」다. */
const r0Geometry = (p = page) => p.evaluate(() => [...document.querySelectorAll('.word-token')].map((t) => {
  const px = (v) => parseFloat(v) || 0;
  const s = t.querySelector('.surface'), sr = s.getBoundingClientRect(), tr = t.getBoundingClientRect();
  const b = getComputedStyle(s, '::before');
  const bandTop = sr.top + px(b.top), bandBottom = bandTop + px(b.height), bb = px(b.borderBottomWidth);
  const boxBottom = b.boxSizing === 'content-box' ? bandBottom + px(b.paddingBottom) + bb : bandBottom;
  const f = getComputedStyle(t, '::before');
  let frame = null;
  if (f.content && f.content !== 'none' && f.content !== 'normal' && f.position === 'absolute') {
    const top = tr.top + px(f.top);
    frame = { outerTop: top, innerTop: top + px(f.borderTopWidth), innerBottom: top + px(f.height) - px(f.borderBottomWidth),
      outerBottom: top + px(f.height), left: tr.left + px(f.left), right: tr.right - px(f.right) };
  } else if (/inset/.test(b.boxShadow)) { // 옛 문법: 띠 안쪽 1.5px 그림자
    const padBottom = boxBottom - bb;
    frame = { outerTop: bandTop, innerTop: bandTop + 1.5, innerBottom: padBottom - 1.5, outerBottom: padBottom, left: sr.left, right: sr.right };
  }
  const rt = s.querySelector('.rt-an')?.getBoundingClientRect();
  const mark = s.querySelector('.pattern-mark')?.getBoundingClientRect();
  return {
    name: t.dataset.name, fs: px(getComputedStyle(s).fontSize), ja: !!s.querySelector('ruby[data-yomi]'),
    token: { l: tr.left, r: tr.right }, surface: { l: sr.left, r: sr.right, top: sr.top },
    band: { top: bandTop, bottom: bandBottom, h: px(b.height), clip: b.backgroundClip },
    underline: bb > 0 ? { top: boxBottom - bb, bottom: boxBottom } : null,
    frame, rt: rt ? { top: rt.top, bottom: rt.bottom, l: rt.left, r: rt.right } : null,
    mark: mark && mark.height > 0 ? { top: mark.top, bottom: mark.bottom } : null,
  };
}));

const r0Line = (list, opts) => list.map((x) => r0Tok(x.segs, { ...x, ...opts }).replace('<div class="word-token', `<div data-name="${x.name}" class="word-token`)).join('');

for (const fs of [12.8, 25.6, 48]) {
  test(`R0 버그 6 — 본문 ${fs}px: 병음·선택 테두리·저장 밑줄이 띠 밖 자기 자리에 있다(병음 12·16px × 고딕·명조 × 상태색 켬·끔)`, async () => {
    // 기준별로 위반을 모은다 — 한 건에서 멈추면 어느 기준이 깨졌는지 전체 그림이 안 보인다.
    const bad = {};
    const check = (ok, key, msg) => { if (!ok) (bad[key] ||= []).push(msg); };
    for (const py of [12, 16]) for (const family of ['sans-serif', 'serif']) for (const hl of [false, true]) {
      const label = `${fs}px·병음 ${py}px·${family}·상태색 ${hl ? '켬' : '끔'}`;
      await page.setContent(R0_PAGE(
        r0Area({ fs, hl, family }, r0Line(R0_ZH, { selected: true }))
        + r0Area({ fs, hl, family, lang: 'ja' }, r0Line(R0_JA, { selected: true, ja: true })),
        { py, family }));
      const all = await r0Geometry();
      for (const g of all) {
        const at = `${label} ${g.name}`;
        assert.ok(g.frame, `${at}: 선택 테두리가 없다`);
        // 6b — 테두리는 띠(면 칠)에서 떨어진다: 위 1px+, 아래 2px+
        check(g.frame.innerTop <= g.band.top - 1 + 0.01, '6b 테두리 위', `${at}: 안쪽 윗변 ${g.frame.innerTop.toFixed(2)} > 띠 윗변 ${g.band.top.toFixed(2)} − 1`);
        check(g.frame.innerBottom >= g.band.bottom + 2 - 0.01, '6b 테두리 아래', `${at}: 안쪽 아랫변 ${g.frame.innerBottom.toFixed(2)} < 띠 아랫변 ${g.band.bottom.toFixed(2)} + 2`);
        // 좌우는 토큰 폭 그대로 — 이웃을 침범하지 않고, 글자 상자는 다 감싼다
        check(g.frame.left >= g.token.l - 0.01 && g.frame.right <= g.token.r + 0.01, '좌우 침범', `${at}: 테두리가 토큰 밖으로 나갔다`);
        check(g.frame.left <= g.surface.l + 0.5 && g.frame.right >= g.surface.r - 0.5, '좌우 감쌈', `${at}: 테두리가 글자 상자보다 좁다`);
        // 면 칠 높이는 불변(1.04em) — 밑줄이 띠 밖으로 나가도 칠은 늘지 않는다
        check(Math.abs(g.band.h - 1.04 * g.fs) < 0.05, '칠 높이', `${at}: 띠 높이 ${g.band.h} ≠ 1.04em`);
        if (g.underline) {
          check(g.underline.top >= g.band.bottom + 2 - 0.01, '6b 밑줄', `${at}: 밑줄 윗변 ${g.underline.top.toFixed(2)} < 띠 아랫변 ${g.band.bottom.toFixed(2)} + 2`);
          check(g.underline.bottom <= g.frame.innerBottom - 0.5 + 0.01, '밑줄 테두리 안', `${at}: 밑줄이 테두리 선에 닿거나 밖으로 나갔다`);
          check(g.band.clip === 'content-box', '칠 번짐', `${at}: 밑줄 여백까지 면 칠이 번진다(clip ${g.band.clip})`);
        }
        if (g.mark) {
          check(g.mark.top >= g.band.bottom + 2 - 0.01 && g.mark.bottom <= g.frame.innerBottom + 0.01, '문형선 자리', `${at}: 문형 밑줄이 띠 밖·테두리 안 자리가 아니다`);
          if (g.underline) check(g.mark.bottom <= g.underline.top - 0.5, '문형선·밑줄 겹침', `${at}: 문형 밑줄과 저장 밑줄이 겹친다`);
        }
        // 6a — 병음(중국어) 상자는 테두리 바깥 윗변보다 2.5px 이상 위(실글꼴 내림획·화소 맞춤 여유 — 잉크 2px)
        if (g.rt && !g.ja) check(g.rt.bottom <= g.frame.outerTop - 2.5 + 0.01, '6a 병음', `${at}: 병음 아래 끝 ${g.rt.bottom.toFixed(2)} > 테두리 바깥 윗변 ${g.frame.outerTop.toFixed(2)} − 2.5`);
      }
      // 고르기 전·후로 글자·병음이 1px도 안 움직인다(테두리는 자리만 갖고 흐름에 없다)
      await page.locator('.word-token').evaluateAll((ts) => ts.forEach((t) => t.removeAttribute('data-selected')));
      const plain = await r0Geometry();
      plain.forEach((g, i) => {
        assert.deepEqual([g.surface, g.rt], [all[i].surface, all[i].rt], `${label} ${g.name}: 선택이 글자·병음 좌표를 바꿨다`);
        assert.equal(g.frame, null, `${label} ${g.name}: 고르지 않았는데 테두리가 있다`);
      });
    }
    const summary = Object.entries(bad).map(([k, v]) => `${k} ${v.length}건 — 예: ${v[0]}`);
    assert.deepEqual(summary, [], `기하 위반:\n${summary.join('\n')}`);
  });
}

test('R0 버그 6 — 다음 줄 병음이 앞줄의 테두리·밑줄·문형선에 얹히지 않는다(작은 글자 × 큰 병음 × 최소 줄 간격)', async () => {
  // 병음을 테두리 위로 올리면서 생긴 줄 사이 겹침(실글꼴: 12.8px·병음 16px·간격 15px에서 −3.3px)의
  // 방지선. ViewerPage와 같이 간격을 max(줄 간격, --hl-row-gap-min)으로 쓰고, 가장 깊은 표지(문형+저장
  // 선택 테두리)를 모든 토큰에 둔 채 상자 기준으로 잰다(병음 상자 위 끝은 잉크보다 ≈0.1P 높다).
  const bad = [];
  for (const fs of [12.8, 25.6, 48]) for (const py of [12, 16]) for (const gap of [10, 15]) {
    const v = { cls: 'word-token--saved', pattern: true, selected: true };
    const line = Array.from({ length: 6 }, () => [R0_ZH[4], R0_ZH[2], R0_ZH[1]]).flat().map((x) => r0Tok(x.segs, { ...x, ...v })).join('');
    await page.setContent(R0_PAGE(r0Area({ fs }, line).replace(/gap:15px \.25rem/, `gap:max(${gap}px, var(--hl-row-gap-min, 0px)) .25rem;width:${Math.round(fs * 14)}px`), { py }));
    const rows = await page.evaluate(() => {
      const m = new Map();
      for (const t of document.querySelectorAll('.word-token')) {
        const s = t.querySelector('.surface').getBoundingClientRect(), f = getComputedStyle(t, '::before'), tr = t.getBoundingClientRect();
        const k = Math.round(s.top), e = m.get(k) || { rtTop: Infinity, markBottom: -Infinity };
        for (const rt of t.querySelectorAll('.rt-an')) e.rtTop = Math.min(e.rtTop, rt.getBoundingClientRect().top);
        e.markBottom = Math.max(e.markBottom, tr.top + parseFloat(f.top) + parseFloat(f.height));
        m.set(k, e);
      }
      return [...m.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    });
    if (rows.length < 2) bad.push(`${fs}px·병음 ${py}·간격 ${gap}: 줄이 하나뿐 — 전제 실패`);
    for (let i = 0; i + 1 < rows.length; i++) {
      const clear = rows[i + 1].rtTop - rows[i].markBottom;
      if (clear < 1 - 0.01) bad.push(`${fs}px·병음 ${py}·간격 ${gap}: 다음 줄 병음 상자 위 끝이 앞줄 테두리 아래 끝과 ${clear.toFixed(2)}px`);
    }
  }
  assert.deepEqual(bad, []);
});

test('R0 버그 6 — 요미가나는 테두리에 닿을 때만 올라간다(작은 글자), 테두리·밑줄(6b)은 위 행렬이 일본어에도 잰다', async () => {
  // 요미 상자는 2.2 줄 높이를 물려받아 가나 잉크가 상자 아래 끝보다 ≈0.6em(요미 크기) 위에 있다.
  // 「잉크 아래 끝 ≈ 상자 아래 끝 − 0.55em(요미)」가 테두리 바깥 윗변 − 2.5px 이하여야 한다(실글꼴:
  // 옛 0.65em 자리는 본문 12.8px에서 테두리와 0.67px). 25.6px 이상에서는 옛 자리를 그대로 둔다.
  for (const fs of [12.8, 25.6, 48]) {
    await page.setContent(R0_PAGE(r0Area({ fs, lang: 'ja' }, r0Line(R0_JA, { ja: true, selected: true }))));
    const g = await r0Geometry();
    const fromTop = await page.evaluate(() => [...document.querySelectorAll('.rt-an')].map((rt) => rt.getBoundingClientRect().bottom - rt.closest('.surface').getBoundingClientRect().top));
    g.forEach((t, i) => {
      const inkBottom = t.rt.bottom - 0.55 * (fs / 2);
      assert.ok(inkBottom <= t.frame.outerTop - 2.5 + 0.01, `${fs}px ${t.name}: 요미 잉크 추정 아래 끝 ${inkBottom.toFixed(2)} > 테두리 ${t.frame.outerTop.toFixed(2)} − 2.5`);
      assert.ok(fromTop[i] <= 0.65 * fs + 0.01, `${fs}px ${t.name}: 요미가 옛 자리보다 내려갔다 ${fromTop[i]}`);
      if (fs >= 25.6) assert.ok(Math.abs(fromTop[i] - 0.65 * fs) < 0.6, `${fs}px ${t.name}: 큰 글자에서 요미가 옛 기준점(0.65em)에서 움직였다: ${fromTop[i]}`);
    });
  }
});

test('R0 버그 6 — 터치 화면 줄 첫 토큰: 테두리가 문장 막대를 감싸지 않는다', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
  try {
    const p = await context.newPage();
    await p.setContent(R0_PAGE(r0Area({ fs: 25.6 }, r0Line(R0_ZH.slice(0, 2), { selected: true }))));
    const out = await p.evaluate(() => {
      const t = document.querySelector('.word-token'), f = getComputedStyle(t, '::before');
      return { hoverNone: matchMedia('(hover: none)').matches, frameLeft: t.getBoundingClientRect().left + parseFloat(f.left), surfaceLeft: t.querySelector('.surface').getBoundingClientRect().left };
    });
    assert.ok(out.hoverNone, '터치 컨텍스트가 (hover: none)이 아니다 — 전제가 무너졌다');
    assert.ok(Math.abs(out.frameLeft - out.surfaceLeft) < 0.5, `테두리 왼변 ${out.frameLeft} ≠ 글자 상자 왼변 ${out.surfaceLeft}`);
  } finally { await context.close(); }
});

test('R0 버그 1 — 문형 밑줄은 문장 지정·드래그·단어 선택 중에도 남는다(높이 ≥1px·폭 ≥80%)', async () => {
  // 드래그 범위와 문장 지정은 같은 클래스(word-token--picked)를 쓴다(ViewerPage pickedClass) —
  // 이음매(:has(+ picked))가 생기는 「뒤에 지정 토큰이 이어지는」 자리에 문형 토큰을 둔다.
  const line = [R0_ZH[0], R0_ZH[2], R0_ZH[3], R0_ZH[4], R0_ZH[1], R0_ZH[7]];
  const states = {
    '고르기 전': () => {},
    '문장 지정·드래그': (ts) => ts.forEach((t) => t.classList.add('word-token--picked')),
    '단어 선택(집중 흐름)': (ts) => ts.forEach((t) => { t.classList.add('word-token--picked'); if (t.classList.contains('word-token--pattern')) t.dataset.selected = 'true'; }),
  };
  for (const hl of [false, true]) for (const [state, apply] of Object.entries(states)) {
    await page.setContent(R0_PAGE(r0Area({ fs: 25.6, hl }, r0Line(line))));
    await page.locator('.word-token').evaluateAll(apply);
    const marks = await page.evaluate(() => {
      const want = getComputedStyle(document.querySelector('.r0-probe')).backgroundColor;
      if (!want || want === 'rgba(0, 0, 0, 0)') throw new Error(`--pattern-line이 풀리지 않았다: ${want}`);
      return [...document.querySelectorAll('.word-token--pattern')].map((t) => {
        const s = t.querySelector('.surface'), cands = [];
        const m = s.querySelector('.pattern-mark');
        if (m) { const r = m.getBoundingClientRect(); cands.push({ w: r.width, h: r.height, bg: getComputedStyle(m).backgroundColor }); }
        const a = getComputedStyle(s, '::after');
        if (a.content !== 'none') cands.push({ w: parseFloat(a.width), h: parseFloat(a.height), bg: a.backgroundColor });
        return { name: t.dataset.name, width: s.getBoundingClientRect().width, line: cands.find((c) => c.bg === want && c.h > 0) || null, cands };
      });
    });
    assert.equal(marks.length, 2, '문형 토큰 둘(比·尽量)이 있어야 한다');
    for (const m of marks) {
      const at = `${state}·상태색 ${hl ? '켬' : '끔'} ${m.name}`;
      assert.ok(m.line, `${at}: 문형 밑줄이 없다 — 후보 ${JSON.stringify(m.cands)}`);
      assert.ok(m.line.h >= 1, `${at}: 밑줄 높이 ${m.line.h}px < 1px`);
      assert.ok(m.line.w >= m.width * 0.8, `${at}: 밑줄 폭 ${m.line.w}px < 토큰 폭 ${m.width}px의 80%`);
    }
  }
});

for (const theme of ['light', 'sepia', 'dark']) {
  test(`R0 버그 11 — 「만난 말」은 새 단어와 같은 표시다(${theme}: 칠·지정 혼색·선택 테두리)`, async () => {
    await page.setContent(R0_PAGE(r0Area({ fs: 25.6, hl: true, theme }, r0Line([R0_ZH[5], R0_ZH[6]]))));
    const read = () => page.evaluate(() => [...document.querySelectorAll('.word-token')].map((t) => {
      const b = getComputedStyle(t.querySelector('.surface'), '::before'), f = getComputedStyle(t, '::before');
      return { band: b.backgroundColor, line: `${b.borderBottomWidth} ${b.borderBottomColor}`, frame: f.content !== 'none' ? f.borderTopColor : b.boxShadow };
    }));
    const plain = await read();
    assert.deepEqual(plain[1], plain[0], `만난 말 칠 ${plain[1].band} ≠ 새 단어 칠 ${plain[0].band}`);
    await page.locator('.word-token').evaluateAll((ts) => ts.forEach((t) => t.classList.add('word-token--picked')));
    const picked = await read();
    assert.deepEqual(picked[1], picked[0], '지정 중 표시(띠·밑줄)도 같아야 한다');
    assert.notEqual(picked[0].band, plain[0].band, '지정하면 지정 띠가 깔린다');
    assert.equal(picked[0].line, plain[0].line, '지정 중에도 밑줄은 그대로다(AD-R2)');
    await page.locator('.word-token').evaluateAll((ts) => ts.forEach((t) => { t.classList.remove('word-token--picked'); t.dataset.selected = 'true'; }));
    const selected = await read();
    assert.equal(selected[1].frame, selected[0].frame, '선택 테두리 색도 같아야 한다');
  });
}

/* ── AD-R2 새 단어 밑줄(VIEWER-V2-ROUNDS-001 §5 — 오너 확정, 08-27 B안 수정) ──────────────────────
 * 새 단어·만난 말 = 얇은 파란 밑줄(면 칠 없음), 면 칠은 학습 중·복습에만. 밑줄은 #1354 「밑줄 자리」
 * (띠 아래 --hl-mark-gap, 문형 밑줄이 있으면 둘째 칸)에 이름만 더한다 — 좌표 신설 0.
 * 축: 상태색 켬·끔 × 종이(sepia)·어둡게(dark)·밝게 × 선택(테두리)·지정(띠)·미선택 × 문형 동시.
 * 위 버그 6 행렬도 「更 문형+새 단어」 행과 새 단어·만난 말 밑줄을 같은 기준(띠 + 2px, 테두리 안 0.5px)으로 잰다. */
for (const theme of ['sepia', 'dark', 'light']) {
  test(`AD-R2 — 새 단어는 밑줄·면 칠 없음(선택 중 숨김·지정 중 유지), 학습 중·복습은 면 칠(${theme} × 상태색 켬·끔 × 선택·지정·미선택 × 문형 동시)`, async () => {
    const LIST = [
      { name: '熬夜 새 단어', segs: [['熬', 'áo'], ['夜', 'yè']], cls: 'word-token--new', kind: 'new' },
      { name: '爱惜 만난 말', segs: [['爱', 'ài'], ['惜', 'xī']], cls: 'word-token--met', kind: 'new' },
      { name: '更 문형+새 단어', segs: [['更', 'gèng']], cls: 'word-token--new', pattern: true, kind: 'new' },
      { name: '体育场 저장', segs: [['体', 'tǐ'], ['育', 'yù'], ['场', 'chǎng']], cls: 'word-token--saved', kind: 'fill' },
      { name: '照片 복습', segs: [['照', 'zhào'], ['片', 'piàn']], cls: 'word-token--saved word-token--due', kind: 'fill' },
      { name: '尽量 문형+저장', segs: [['尽', 'jǐn'], ['量', 'liàng']], cls: 'word-token--saved', pattern: true, kind: 'fill' },
      { name: '眼前 미저장', segs: [['眼', 'yǎn'], ['前', 'qián']], kind: 'plain' },
    ];
    const bad = [];
    const check = (ok, msg) => { if (!ok) bad.push(msg); };
    for (const hl of [true, false]) for (const mode of ['미선택', '지정', '선택']) {
      await page.setContent(R0_PAGE(r0Area({ fs: 25.6, hl, theme }, r0Line(LIST, { selected: mode === '선택' }))
        + `<i id="ln" class="reader-area reader-area--${theme}" style="position:absolute;width:0;height:0;padding:0;min-height:0;color:var(--ws-new-ln)"></i>`));
      if (mode === '지정') await page.locator('.word-token').evaluateAll((ts) => ts.forEach((t) => t.classList.add('word-token--picked')));
      const want = await page.evaluate(() => getComputedStyle(document.getElementById('ln')).color);
      const geo = await r0Geometry();
      const css = await page.evaluate(() => [...document.querySelectorAll('.word-token')].map((t) => {
        const b = getComputedStyle(t.querySelector('.surface'), '::before');
        return { bg: b.backgroundColor, ulw: parseFloat(b.borderBottomWidth) || 0, ulc: b.borderBottomColor };
      }));
      const clear = 'rgba(0, 0, 0, 0)';
      const pickedBg = mode === '지정' ? css[LIST.findIndex((x) => x.kind === 'plain')].bg : clear;
      LIST.forEach((x, i) => {
        const at = `${theme}·상태색 ${hl ? '켬' : '끔'}·${mode} ${x.name}`, c = css[i], g = geo[i];
        if (x.kind === 'new') {
          check(c.bg === pickedBg, `${at}: 면 칠 ${c.bg} — 새 단어는 칠하지 않는다(지정 중이면 중립 지정 띠 ${pickedBg}만)`);
          if (!hl) { check(c.ulw === 0 || c.ulc === clear, `${at}: 상태색 끔인데 밑줄이 있다`); return; }
          // 선택(단어창 열림)은 밑줄 없음 — 파란 밑줄 + 파란 테두리 아랫선이 이중 밑줄로 읽혔다(검수 2026-10-07).
          // 지정(문장 선택·드래그)은 밑줄 유지.
          if (mode === '선택') { check(c.ulw === 0 || c.ulc === clear, `${at}: 선택 중에는 새 단어 밑줄을 숨긴다(테두리가 자리를 표시)`); return; }
          check(c.ulw >= 1 && c.ulw <= 2 && c.ulc === want, `${at}: 밑줄 ${c.ulw}px ${c.ulc} ≠ 1~2px ${want}`);
          check(g.underline && g.underline.top >= g.band.bottom + 2 - 0.01, `${at}: 밑줄이 띠 아래 첫 칸(띠 + 2px)보다 위다`);
          check(g.band.clip === 'content-box', `${at}: 지정 띠가 밑줄 여백까지 번진다`);
          if (x.pattern) check(g.mark && g.underline && g.mark.bottom <= g.underline.top - 0.5, `${at}: 문형 밑줄 다음 칸이 아니다(겹침)`);
          if (g.frame && g.underline) check(g.underline.bottom <= g.frame.innerBottom - 0.5 + 0.01, `${at}: 밑줄 ${g.underline.bottom.toFixed(2)}이 선택 테두리 선 ${g.frame.innerBottom.toFixed(2)}에 닿는다`);
        } else if (x.kind === 'fill') {
          if (hl) check(c.bg !== clear && c.bg !== pickedBg, `${at}: 학습 중·복습은 면 칠이어야 한다(${c.bg})`);
        } else {
          check(c.bg === pickedBg && (c.ulw === 0 || c.ulc === clear), `${at}: 아는/미저장 단어에 표시가 생겼다`);
        }
      });
    }
    assert.deepEqual(bad, []);
  });
}
