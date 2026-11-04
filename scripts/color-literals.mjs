// 색 직접 값(토큰 밖 #hex · rgb() · hsl() · 이름색) 세기 — 색 체계 단계 1 라쳇의 정본 셈법.
// CSS: 사용자 정의 속성(--x) 정의 밖 선언의 색 리터럴. JS/JSX: 스타일 속성 키(color · background … ) 뒤 문자열 안의 색 리터럴
// (한 줄 style={{}}만이 아니라 스타일 객체 · 여러 줄 · 삼항까지). 흰색 · 검정 · transparent · currentColor는 센다(이름색 포함) — 예외는 계약이 정한다.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '__tests__', '.next']);
export const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const NAMED = 'white|black|red|green|blue|yellow|orange|gray|grey|silver|gold|pink|purple|navy|teal|maroon|olive|lime|aqua|fuchsia|brown|crimson|tomato|coral|salmon|ivory|beige|khaki|indigo|violet';
export const LITERAL = new RegExp(`#[0-9a-fA-F]{3,8}\\b|(?:rgba?|hsla?)\\([^)]*\\)|\\b(?:${NAMED})\\b`, 'g');
const STYLE_KEYS = 'color|background|backgroundColor|borderColor|border|borderTop|borderBottom|borderLeft|borderRight|fill|stroke|outline|boxShadow|textShadow|textDecorationColor|caretColor|accentColor';
const SKIP_PROPS = new Set(['font-family', 'content', 'grid-template-areas', 'animation', 'animation-name', 'transition', 'will-change', 'src']);

function walk(dir, ext, root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(p, ext, root);
    return ext.test(e.name) ? [relative(root, p)] : [];
  });
}

export function cssLiterals(text) {
  const t = text.replace(/\/\*[\s\S]*?\*\//g, '');
  let n = 0;
  for (const m of t.matchAll(/\{([^{}]*)\}/g)) {
    for (const decl of m[1].split(';')) {
      const i = decl.indexOf(':'); if (i < 0) continue;
      const prop = decl.slice(0, i).trim(), val = decl.slice(i + 1);
      if (prop.startsWith('--') || SKIP_PROPS.has(prop) || /url\(/.test(val)) continue;
      n += (val.match(LITERAL) || []).length;
    }
  }
  return n;
}

export function jsLiterals(text) {
  const t = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  // 줄마다 스타일 키의 값 구간(키 뒤 ~ 같은 줄 다음 키 앞)에 든 문자열 리터럴만 센다 — rgba(0,0,0) 안의 쉼표에서 끊기지 않게.
  const key = new RegExp(`\\b(?:${STYLE_KEYS})\\s*:`, 'g');
  let n = 0;
  for (const line of t.split('\n')) {
    const hits = [...line.matchAll(key)];
    hits.forEach((m, i) => {
      const seg = line.slice(m.index + m[0].length, i + 1 < hits.length ? hits[i + 1].index : line.length);
      for (const s of seg.matchAll(/(['"`])((?:(?!\1).)*)\1/g)) n += (s[2].match(LITERAL) || []).length;
    });
  }
  return n;
}

/** {file: count} — 0인 파일은 뺀다. */
export function literalCounts(root = process.cwd()) {
  const out = {};
  for (const f of walk(join(root, 'src'), /\.css$/, root)) { const n = cssLiterals(readFileSync(join(root, f), 'utf8')); if (n) out[f] = n; }
  for (const f of walk(join(root, 'src'), /\.(jsx?|tsx?)$/, root)) { const n = jsLiterals(readFileSync(join(root, f), 'utf8')); if (n) out[f] = n; }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const c = literalCounts();
  console.log(JSON.stringify(Object.fromEntries(Object.entries(c).sort()), null, 2));
  console.error('files', Object.keys(c).length, 'total', Object.values(c).reduce((a, b) => a + b, 0));
}
