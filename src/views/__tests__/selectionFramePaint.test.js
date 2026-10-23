// 낱말 고름 표시는 그리기 속성만 바꾼다(VIEWER-TAP-INP-002). 본문(특히 쪽 넘김 = 다단) 안에서 낱말을 누를 때 바뀌는 것은
// data-selected 하나다. 그 표시가 배치 속성(position · 크기 · 여백 · 상자 생성)을 건드리면 본문 전체가 다시 배치된다 —
// 예전 테두리(고르면 position:relative + ::before 상자)가 300줄 자료에서 탭마다 250ms 넘게 썼다(390 · CPU×4).
// 실제 배치 횟수 계약은 e2e/viewer-select-paint.e2e.mjs(LayoutCount 0)이고, 여기는 CSS · 마크업 구조 계약이다.
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ReaderToken from '../../components/viewer/ReaderToken';

const files = ['src/index.css', 'src/components/viewer/reader-controls.css', 'src/components/viewer/paged-reader.css'];
// @media 안도 펼친 규칙 목록(선택자, 선언 [속성, 값])
function rules(css) {
  const out = [];
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (text) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i); if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const inner = text.slice(open + 1, j - 1);
      if (head.startsWith('@')) walk(inner);
      else out.push({ selector: head.replace(/\s+/g, ' '), decls: inner.split(';').map(d => d.trim()).filter(Boolean).map(d => { const k = d.indexOf(':'); return [d.slice(0, k).trim(), d.slice(k + 1).trim()]; }) });
      i = j;
    }
  };
  walk(body);
  return out;
}
const all = files.flatMap(f => rules(fs.readFileSync(f, 'utf8')));
// 그리기만 바꾸는 속성(배치 · 상자 생성과 무관). 이 밖의 속성을 고름 상태로 바꾸려면 아래 「짝」 규칙이 같은 값을 들고 있어야 한다.
const PAINT = new Set(['opacity', 'color', 'background', 'background-color', 'outline', 'outline-color', 'animation', 'transform', 'border-bottom-color', 'transition', 'visibility']);
const sel = '[data-selected="true"]', notSel = ':not([data-selected="true"])';

describe('고름 표시 CSS — 그리기 속성만 바뀐다', () => {
  const toggled = all.filter(r => r.selector.includes('data-selected'));
  it('전제: 고름 상태 규칙을 찾았다(테두리 · 집중 어둡기 · 새 단어 밑줄)', () => {
    expect(toggled.some(r => r.selector.includes('.word-frame'))).toBe(true);
    expect(toggled.some(r => r.selector.includes(notSel))).toBe(true);
    expect(toggled.length).toBeGreaterThan(8);
  });
  it('고름으로 켜지거나 꺼지는 배치 속성은 반대 상태 규칙이 같은 값을 갖는다(값이 그대로라 배치가 없다)', () => {
    const bad = [];
    for (const r of toggled) {
      // 낱말 상태가 아니라 다른 판정에 쓰는 선택자(사본 등)는 이 계약 밖 — 본문 낱말만
      if (!/word-token/.test(r.selector)) continue;
      const twin = r.selector.includes(notSel) ? r.selector.replace(notSel, sel) : r.selector.replace(sel, notSel);
      const pair = all.find(x => x.selector === twin);
      for (const [prop, value] of r.decls) {
        if (PAINT.has(prop)) continue;
        const shape = (p, v) => (p === 'border-bottom' ? v.replace(/\s+(var\(.*\)|transparent|#[0-9a-f]+|rgba?\(.*\))$/i, '') : v);
        const other = pair?.decls.find(([p]) => p === prop);
        if (!other || shape(prop, other[1]) !== shape(prop, value)) bad.push(`${r.selector} { ${prop}: ${value} } ↔ ${pair ? `짝 ${other ? other[1] : '없음'}` : '짝 규칙 없음'}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('예전 테두리(고르면 position:relative · 낱말 ::before 상자) 부활 금지', () => {
    expect(all.filter(r => r.selector.includes(sel) && /word-token\[data-selected="true"\](:has\([^)]*\))?::before/.test(r.selector))).toEqual([]);
    expect(all.filter(r => r.selector.includes(sel) && r.decls.some(([p]) => ['position', 'z-index', 'content', 'display'].includes(p)))).toEqual([]);
  });
  it('테두리 상자: 글자 상자 폭 · 줄 높이 0 · 그리기는 outline(배치에 영향 없음)', () => {
    const frame = all.find(r => r.selector === '.viewer-layout .word-frame');
    const d = Object.fromEntries(frame.decls);
    expect(d).toMatchObject({ display: 'inline-block', width: '100%', 'margin-left': '-100%', 'vertical-align': 'top', 'border-radius': '6px', 'outline-offset': '-1.5px', 'pointer-events': 'none', visibility: 'hidden', outline: 'none' });
    expect(d['margin-bottom']).toBe('calc(-1 * (var(--hl-band-top) + var(--hl-band-h) + var(--hl-frame-bottom)))'); // 여백 상자 높이 0
    expect(d.height).toBe('calc(var(--hl-frame-top) + var(--hl-band-h) + var(--hl-frame-bottom))');
    expect(Object.keys(d)).not.toContain('border'); // 테두리 두께는 글자 상자 폭 계산에 들어간다 — 선은 outline으로
  });
});

describe('마크업 — 모든 낱말이 테두리 칸을 처음부터 갖는다', () => {
  const base = { tokenId: 'id_0_2', token: { text: '駅', furigana: 'えき', base_form: '駅', pos: '명사' }, className: 'word-token', selected: false, paceStyle: undefined, tokenRefs: { current: {} },
    lineHeadText: null, lineHeadRawIdx: null, linePickLabel: '문장 전체 분석', onLinePick: () => {}, onTokenClick: () => {}, pronDisplay: 'all', isKnown: false, isSaved: false, patternMark: false, zhGrid: false, showToneColors: false };
  it.each([
    ['루비 · 고르지 않음', {}],
    ['루비 · 고름', { selected: true }],
    ['글자만 · 문형 밑줄', { token: { text: 'で', furigana: '', base_form: 'で', pos: '조사' }, patternMark: true }],
    ['줄 머리 막대', { lineHeadText: '駅で待つ', lineHeadRawIdx: 0 }],
  ])('%s: .surface 마지막 자식 하나, 고름과 무관하게 같은 마크업', (_, patch) => {
    const html = renderToStaticMarkup(createElement(ReaderToken, { ...base, ...patch }));
    expect(html.match(/class="word-frame"/g)).toHaveLength(1);
    expect(html).toMatch(/<span class="word-frame" aria-hidden="true"><\/span><\/span><\/div>$/);
    const other = renderToStaticMarkup(createElement(ReaderToken, { ...base, ...patch, selected: !patch.selected }));
    expect(other.replace(' data-selected="true"', '')).toBe(html.replace(' data-selected="true"', ''));
  });
});
