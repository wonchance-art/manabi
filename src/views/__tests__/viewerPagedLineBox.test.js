// 쪽 넘김 본문의 줄 상자(VIEWER-PAGED-RENDER-001 A안, 오너 승인 2026-10-25 KST). 원문 한 줄을 안쪽 flex 상자(.reader-line)로
// 묶어 본문 상자(.reader-area)의 직속 flex 항목을 낱말 수천 개 → 줄 수백 개로 줄인다 — 다단(쪽 넘김)의 그리기 준비(PrePaint)가
// 「단 수 × 직속 항목 수」로 커지던 비용(300줄 390 · CPU 4배: 127 → 12ms). 승인된 보이는 변화는 하나뿐: 쪽 경계에 걸친 문단 다음
// 문단이 최대 줄 간격 하나 내려간다(쪽 수 소폭 증가). 아래는 그 구조와, 낱말이 본문 상자의 손자가 된 뒤에도 깨지지 않을 가정.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const css = read('src/index.css');
const pagedCss = read('src/components/viewer/paged-reader.css');
const ruleOf = (src, selector) => {
  const head = `${selector} {`;
  const body = sliceBetween(src, head, '}').slice(head.length);
  return Object.fromEntries(body.replace(/\/\*[\s\S]*?\*\//g, '').split(';').map((d) => d.trim()).filter(Boolean).map((d) => d.split(':').map((s) => s.trim())));
};
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'world') walk(p, out); } else if (/\.(css|jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};

describe('분석 본문 — 원문 한 줄 = 줄 상자 하나', () => {
  const analyzed = sliceBetween(viewer, '// 분석 완료 후: 줄 단위로 그룹핑', '{/* 문장 이동(▲ 위 / ▼ 아래)');
  it('줄마다 .reader-line div 하나 — 헤딩 클래스를 함께 달고, 줄바꿈 칸은 상자 안 마지막 자식', () => {
    expect(analyzed).toContain("<div key={gi} className={`reader-line${hClass ? ` ${hClass}` : ''}`}>");
    const box = sliceBetween(analyzed, '<div key={gi} className={`reader-line', '</div>\n            );');
    expect(box.indexOf('renderToken(id, headOf(id, ti)')).toBeGreaterThan(0);
    expect(box.indexOf('<div className="line-break" />')).toBeGreaterThan(box.indexOf('renderToken(id, headOf(id, ti)'));
  });
  it('분석 본문에는 display:contents 줄 감싸개가 남지 않는다 — 낱말이 다시 본문 상자의 직속 항목이 되지 않게', () => {
    expect(analyzed).not.toContain("display: 'contents'");
    expect(analyzed).not.toContain('<span key={gi}');
  });
  it('줄 상자는 분석 본문 한 곳뿐 — 분석 전 원문 보기 · 대화 말풍선 · 설정 미리보기는 지금 그대로', () => {
    expect(viewer.split('reader-line').length - 1).toBe(3); // 렌더 1 + 설명 주석 2
    const raw = sliceBetween(viewer, 'if (showRaw) {', '// 분석 완료 후: 줄 단위로 그룹핑');
    expect(raw).toContain("style={{ display: 'contents' }}");
    expect(raw).not.toContain('reader-line');
    for (const f of ['src/components/conversation/ConversationThread.jsx', 'src/components/viewer/ViewerPreview.jsx']) expect(read(f)).not.toContain('reader-line');
  });
});

describe('줄 상자 CSS — 감김 · 간격 · 기준선은 본문 상자와 같다', () => {
  const rule = ruleOf(css, '.reader-area > .reader-line');
  it('혼자 한 flex 줄(100%)을 차지하고 안에서 본문과 같은 gap · 기준선 정렬로 감는다', () => {
    expect(rule).toEqual({
      display: 'flex', 'flex-wrap': 'wrap', 'align-content': 'flex-start', 'align-items': 'baseline',
      flex: '0 1 100%', 'min-width': '0', gap: 'inherit',
    });
    const area = ruleOf(css, '.reader-area');
    expect(area).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap', 'align-content': 'flex-start', 'align-items': 'baseline' });
  });
  it('헤딩(.viewer-h1~3 display:contents)보다 구체적이다 — 헤딩 줄도 상자로 남는다(글자 크기 규칙 .viewer-hN .surface는 그대로 닿는다)', () => {
    expect(css).toMatch(/\.viewer-h1, \.viewer-h2, \.viewer-h3 \{\s*display: contents;/);
    for (const n of [1, 2, 3]) expect(css).toContain(`.viewer-h${n} .surface {`);
    expect(css.indexOf('.reader-area > .reader-line {')).toBeGreaterThan(css.indexOf('.viewer-h1, .viewer-h2, .viewer-h3 {'));
  });
  it('쪽에 걸친 문단은 쪽을 넘어 나뉜다 — 줄 상자에 break-inside · contain · content-visibility · overflow를 걸지 않는다', () => {
    for (const src of [css, pagedCss, read('src/components/viewer/reader-controls.css')]) {
      for (const m of src.matchAll(/([^{}]*\.reader-line\b[^{}]*)\{([^}]*)\}/g)) {
        expect(m[2], m[1]).not.toMatch(/break-inside|break-before|break-after|contain\s*:|content-visibility|overflow|position\s*:/);
      }
    }
    expect(pagedCss.match(/break-inside:\s*avoid/g)).toHaveLength(1); // 끝 상자 묶음 하나뿐(NEXT-CARD-SPLIT-001)
  });
  it('인쇄는 다단을 그대로 푼다 — 줄 상자는 인쇄에서도 평범한 flex 줄', () => {
    expect(pagedCss).toContain('[data-reader-pages="paged"] { height: auto; columns: auto; overflow: visible; }');
  });
});

describe('낱말은 본문 상자의 손자다 — 직속 자식 가정 금지', () => {
  const files = walk('src');
  it('어떤 CSS · 코드도 본문 낱말 · 줄바꿈 칸을 직속 자식(>)으로 고르지 않는다 — 줄 상자 규칙 하나만', () => {
    const hits = [];
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/[^\n]*>\s*(?:\.word-token|\.line-break|\[data-source-token|\.reader-line)\b[^\n]*/g)) hits.push(`${f}: ${m[0].trim()}`);
    }
    expect(hits).toEqual(['src/index.css: .reader-area > .reader-line {']);
  });
  it('본문 상자의 자식 수 · 순서에 기대는 셀렉터가 없다 — 낱말 사이 이웃 규칙은 한 문장(한 줄) 안에서만 닿는다', () => {
    for (const f of files.filter((p) => p.endsWith('.css'))) {
      const src = read(f);
      expect(src, f).not.toMatch(/\.reader-area\s*>\s*(?:\*|:(?:first|last|nth)-)/);
      expect(src, f).not.toMatch(/\.reader-area\s*:(?:first|last|nth)-/);
      expect(src, f).not.toMatch(/\.line-break\s*[+~]\s*\.word-token|\.word-token[^,{]*[+~]\s*\.line-break/);
    }
    // 지정 이음매 · 진행 선은 지정 문장 안의 이웃만 잇는다 — 문장은 한 줄 안에 있으므로 줄 상자로 끊기지 않는다.
    expect(css).toContain('.word-token--picked:has(+ .word-token--picked) {');
  });
  it('본문을 훑는 공용 코드는 자손 질의([data-source-token])로 낱말을 찾는다 — .children · :scope > 로 본문을 걷지 않는다', () => {
    const hook = read('src/lib/usePagedReader.js');
    expect(hook).toContain("pages.querySelectorAll?.(opt().anchorSelector || '[data-source-token]')");
    expect(hook).not.toMatch(/pages\.children|:scope\s*>/);
    const viewport = read('src/lib/readingViewport.js');
    expect(viewport).toContain("root.querySelectorAll('[data-source-token]')");
    expect(viewport).not.toMatch(/root\.children|:scope\s*>/);
    expect(viewer).not.toMatch(/readerRef\.current\??\.(?:children|childNodes|firstElementChild|lastElementChild)/);
  });
});
