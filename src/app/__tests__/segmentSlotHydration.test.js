import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// HYDRATION-SLOT-001 (2026-10-26 KST) — 세그먼트 자리({children})를 DOM 요소 바로 안에 두지 않는다.
// korean-learning e2e의 React #418(HTML) 간헐: 뷰어 TcFontScope의 <div>{children}</div>에서 세그먼트 자리(OuterLayoutRouter —
// viewer/error.jsx 조각을 가리킨다)가 조각 도착 전이라 lazy로 남으면 div가 멈췄다가 다시 그려지고(replay), Next 15.5 동봉 React는
// 그때 하이드레이션 커서를 되돌리지 않아 div를 자기 첫 자식에 맞추려다 #418을 냈다(React 19.3.0에서 고침). 사이에 함수 부품
// (src/components/SegmentSlot.jsx)을 두면 다시 그리는 단위가 그 부품이 되어 커서를 건드리지 않는다.
// 검사 범위: 모든 layout.jsx · template.jsx와, 그 레이아웃이 {children}을 넘기는 부품(ScFontScope · TcFontScope · Layout 등 — 자동 추적).
const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');

function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/** 각 `{children}` 자리를 바로 감싸는 JSX 요소 이름(없으면 null — return children 등). 속성 안의 `=>` · 중괄호는 건너뛴다. */
export function childrenParents(source) {
  const src = stripComments(source);
  const stack = [], parents = [];
  for (let i = 0; i < src.length; i++) {
    if (src.startsWith('{children}', i)) { parents.push(stack.at(-1) ?? null); i += 9; continue; }
    if (src[i] !== '<' || !/[A-Za-z/>]/.test(src[i + 1] || '')) continue;
    if (src[i + 1] === '>') { stack.push('#fragment'); i++; continue; }
    if (src.startsWith('</>', i)) { stack.pop(); i += 2; continue; }
    const closing = src[i + 1] === '/';
    const name = /^[A-Za-z][\w.]*/.exec(src.slice(i + (closing ? 2 : 1)))?.[0];
    if (!name) continue;
    let j = i + 1, depth = 0, quote = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const selfClosing = src[j - 1] === '/';
    if (closing) { const at = stack.lastIndexOf(name); if (at >= 0) stack.length = at; }
    else if (!selfClosing) stack.push(name);
    i = j;
  }
  return parents;
}

const isHost = (name) => !!name && /^[a-z]/.test(name);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/^(layout|template)\.jsx$/.test(name)) out.push(p);
  }
  return out;
}

/** 레이아웃이 {children}을 넘기는 부품의 파일(import 경로 → src 안의 .jsx). */
function carriers(file) {
  const src = read(file);
  const out = [];
  for (const parent of childrenParents(src)) {
    if (!parent || isHost(parent) || parent === '#fragment') continue;
    const m = new RegExp(`import\\s+${parent}\\s+from\\s+['"]([^'"]+)['"]`).exec(src);
    if (!m) continue;
    const spec = m[1].startsWith('@/') ? path.join(SRC, m[1].slice(2)) : m[1].startsWith('.') ? path.resolve(path.dirname(file), m[1]) : null;
    const target = spec && [spec, `${spec}.jsx`, `${spec}.js`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    if (target) out.push(target);
  }
  return out;
}

describe('세그먼트 자리 하이드레이션 — DOM 요소 바로 안에 {children}을 두지 않는다 (HYDRATION-SLOT-001)', () => {
  it('검사기 자체: host 바로 안은 잡고, 함수 부품 · 화살표 속성 · fragment는 통과', () => {
    expect(childrenParents('return <div className={x}>{children}</div>;')).toEqual(['div']);
    expect(childrenParents("return <div style={{ display: 'contents' }}><SegmentSlot>{children}</SegmentSlot></div>;")).toEqual(['SegmentSlot']);
    expect(childrenParents('<AuthProvider onLeft={() => router.refresh()}>{children}</AuthProvider>')).toEqual(['AuthProvider']);
    expect(childrenParents('<main>{a && (<div>x</div>)}\n{children}</main>')).toEqual(['main']);
    expect(childrenParents('<main>{/* 주석 */}<Slot>{children}</Slot><br /></main>')).toEqual(['Slot']);
    expect(childrenParents('return children;')).toEqual([]);
  });

  it('SegmentSlot은 클라이언트 함수 부품이고 children만 돌려준다(DOM 무변경)', () => {
    const slot = read(path.join(SRC, 'components/SegmentSlot.jsx'));
    expect(slot.trimStart().startsWith("'use client'")).toBe(true);
    expect(stripComments(slot)).toMatch(/export default function SegmentSlot\(\{ children \}\) \{\s*return children;\s*\}/);
  });

  it('레이아웃 · 그 부품에서 {children}의 바로 위가 DOM 요소가 아니다', () => {
    const layouts = walk(path.join(SRC, 'app'));
    expect(layouts.length).toBeGreaterThan(15); // 공허 통과 방지
    const files = new Set(layouts);
    for (const f of layouts) for (const c of carriers(f)) files.add(c);
    // 자동 추적이 실제 사고 자리와 셸을 포함한다(경로가 바뀌면 여기서 알린다).
    for (const known of ['src/components/fonts/TcFontScope.jsx', 'src/components/fonts/ScFontScope.jsx', 'src/components/Layout.jsx']) {
      expect([...files].map(rel), known).toContain(known);
    }
    const bad = [...files].flatMap((f) => childrenParents(read(f)).filter(isHost).map((tag) => `${rel(f)}: <${tag}>{children}`));
    expect(bad, '세그먼트 자리를 DOM 요소 바로 안에 두면 하이드레이션 #418 간헐 — <SegmentSlot>{children}</SegmentSlot>로 감싼다').toEqual([]);
  });
});
