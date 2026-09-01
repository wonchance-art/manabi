import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: 화면에 닿지 못하는 CSS가 0이다 (2026-09-01, 오너 「할 수 있는거 ㄱㄱ」).
 *
 * ── 왜 생겼나
 *
 * 스크림 통합(#1238) 중에 `.overlay`·`.celebration-overlay`가 **사용처 0**인 걸 발견했고,
 * 「약 150줄쯤 되겠다」고 적어 뒀다. 전수로 재니 **1,543클래스 중 310이 죽어 있었다**
 * — 스타일시트의 20%다. 눈으로 세면 두 자리를 틀린다.
 *
 * ── 판정 규칙 (여기가 이 계약의 본체다)
 *
 * 클래스가 **죽었다** = 리포 어디에도(코드·문서·픽스처) 그 이름이 문자열로 없고,
 * 동적으로 조립될 수도 없다. 조립 여지는 두 겹으로 막는다:
 *   ⑴ **동적 접두사** — 백틱 안 `${` 직전 토막이 경계(`-`·`_`)로 끝나고 3자 이상인 것.
 *      실측으로 `is-`(`is-${VERDICT_CLASS[…]}`)·`btn--`·`toast--`·`badge--stage-` 등이 잡힌다.
 *      ⚠ 경계 요구가 없으면 한 글자 접두사(`h`·`m`·`p`)가 딸려 들어와 `home-*`·`mypage-*`를
 *      통째로 살아 있는 것으로 오판한다(초안에서 실제로 그랬다).
 *   ⑵ **가문 어간** — `__`·`--` 앞부분이 살아 있으면 그 가문 전체를 살린다.
 *
 * 서드파티가 런타임에 붙이는 클래스는 우리 소스에 없으므로 **명시 목록**으로 지킨다.
 * 지금은 pdf.js 텍스트 레이어뿐이다(`pdfjs-dist`). 목록이 늘면 그 자체가 신호다.
 *
 * ── 실측이 규칙의 값을 증명했다
 *
 * 규칙 없이 「이름이 없으면 죽음」으로만 잘랐다면 `is-easy`·`is-late`·`is-ontrack`(동적)과
 * `markedContent`(pdf.js)를 **살아 있는데 지웠을 것**이다.
 */

const ROOT = process.cwd();
const CSS = path.join(ROOT, 'src/index.css');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'public', 'dist', 'coverage']);
// ⚠ 마크다운은 **뺀다**. 문서는 사용이 아니다 — 실측으로 드러난 구멍이다: 이 계약의
// 주석과 보드가 `.celebration-overlay`·`.overlay`를 이름으로 적고 있어서, 그 둘이
// **죽었다고 적어 둔 문장 덕분에 살아 있는 것으로 판정**되고 있었다(자기 참조 순환).
// 같은 이유로 코드 파일도 **주석을 걷어낸 뒤** 토큰을 센다.
const CODE_EXT = /\.(jsx?|tsx?|mjs|cjs|html|json)$/;
const COMMENTS = /\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g;

/** 서드파티가 런타임에 붙이는 클래스 — 우리 소스에 이름이 없는 게 정상이다. */
const THIRD_PARTY = {
  markedContent: 'pdf.js 텍스트 레이어가 붙인다(pdfjs-dist)',
  textLayer: 'pdf.js 텍스트 레이어',
  endOfContent: 'pdf.js 텍스트 레이어',
};

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 리포 전체를 **토큰 집합**으로 읽는다. 부분문자열 검색(1,500 × 수십 MB)은 CI에서 2분이
 * 넘어 못 쓴다. 그리고 토큰이 **더 정확하다** — `.foo`는 `class="foo-bar"`에 걸리지 않는데
 * 부분문자열 검색은 걸린다고 답한다(죽은 클래스를 살아 있다고 오판).
 */
function repoTokens() {
  const tokens = new Set();
  const eat = (text) => {
    for (const m of text.replace(COMMENTS, ' ').matchAll(/[a-zA-Z][\w-]*/g)) tokens.add(m[0]);
  };
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (CODE_EXT.test(name)) eat(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(ROOT);
  return tokens;
}

/** 동적 접두사 추출은 원문이 필요하다(백틱) — 코드 파일만, 마크다운·JSON은 제외. */
function codeText() {
  const parts = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(jsx?|tsx?|mjs|cjs)$/.test(name)) parts.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(path.join(ROOT, 'src'));
  return parts.join('\n');
}

/** 백틱 템플릿이 만들 수 있는 클래스 접두사. 경계(-·_)로 끝나고 3자 이상만. */
function dynamicPrefixes(blob) {
  const out = new Set();
  for (const m of blob.matchAll(/`([^`]*)\$\{/g)) {
    const tail = m[1].split(/[\s'"]/).pop();
    if (tail && tail.length >= 3 && /^[a-zA-Z][\w-]*[-_]$/.test(tail)) out.add(tail);
  }
  return [...out];
}

let cached = null;
function analyze() {
  if (cached) return cached;                      // 한 번만 훑는다(테스트 4종이 같은 결과를 본다)
  const css = fs.readFileSync(CSS, 'utf8');
  const classes = new Set([...stripComments(css).matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  const tokens = repoTokens();
  const prefixes = dynamicPrefixes(codeText());
  const stemOf = (c) => c.split(/__|--/)[0];
  const alive = (c) => c in THIRD_PARTY || tokens.has(c)
    || prefixes.some((p) => c.startsWith(p))
    || tokens.has(stemOf(c)) || prefixes.some((p) => stemOf(c).startsWith(p));
  cached = { css, classes, prefixes, tokens, dead: [...classes].filter((c) => !alive(c)).sort() };
  return cached;
}

describe('죽은 CSS — 0', () => {
  it('화면에 닿지 못하는 클래스가 없다', () => {
    const { dead } = analyze();
    expect(dead, `리포 어디에도 없고 동적 조립도 안 되는 클래스가 남았다 — 규칙을 지우거나,\n`
      + `서드파티가 붙이는 것이면 THIRD_PARTY에 근거와 함께 적어라:\n  ${dead.join('\n  ')}`)
      .toEqual([]);
  });

  it('판정기가 실제로 일한다 — 파서가 죽으면 위 단언이 공허해진다', () => {
    const { classes, prefixes } = analyze();
    expect(classes.size, 'CSS 클래스를 못 읽었다').toBeGreaterThan(1000);
    expect(prefixes, '동적 접두사를 하나도 못 찾았다 — 그러면 조립 클래스를 죽었다고 오판한다')
      .toContain('is-');
    // 경계 요구가 살아 있는지 — 한 글자 접두사가 섞이면 판정이 통째로 무력해진다
    expect(prefixes.filter((p) => p.length < 3)).toEqual([]);
  });

  it('주석·문서는 사용이 아니다 — 죽었다고 적은 문장이 그것을 살리면 안 된다', () => {
    // `celebration-overlay`는 이 리포에서 **주석과 보드에만** 남아 있다(CSS 규칙은 죽은 CSS
    // 라운드가 걷어냈다). 주석을 세면 이 토큰이 잡히고, 그러면 그 계열이 되살아나도
    // 판정기가 「사용 중」이라 답한다 — 초안에서 실제로 그렇게 막혀 있었다.
    const { tokens } = analyze();
    // ⚠ 이름을 **조립해서** 쓴다. 여기에 그대로 적으면 이 줄이 그 토큰을 만들어,
    //    「주석은 안 센다」를 검사하려던 단언이 스스로 그 전제를 깬다(실제로 그랬다).
    const ghost = ['celebration', 'overlay'].join('-');
    expect(tokens.has(ghost),
      `주석/문서의 클래스 이름(${ghost})이 토큰으로 샜다 — 자기 참조로 판정이 무력해진다`).toBe(false);
    // 반대쪽 확인: 코드가 실제로 쓰는 이름은 잡혀야 한다(스트리퍼가 과하면 전부 죽는다)
    expect(tokens.has('word-fit'), '코드가 쓰는 클래스를 못 읽었다 — 스트리퍼가 과하다').toBe(true);
  });

  it('서드파티 목록이 도피처가 되지 않는다 — pdf.js뿐이고 근거가 적혀 있다', () => {
    expect(Object.keys(THIRD_PARTY).sort()).toEqual(['endOfContent', 'markedContent', 'textLayer']);
    for (const [k, why] of Object.entries(THIRD_PARTY)) {
      expect(why.length, `${k}에 근거가 없다`).toBeGreaterThan(5);
    }
  });

  it('아무도 부르지 않는 @keyframes가 없다', () => {
    const { css } = analyze();
    const names = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
    // 키프레임 본문을 걷어낸 나머지에서 이름을 찾는다(자기 선언에 걸리지 않게)
    const rest = stripComments(css).replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
    const orphan = [...names].filter((n) => !new RegExp(`\\b${n}\\b`).test(rest)).sort();
    expect(orphan, `부르는 곳 없는 @keyframes: ${orphan.join(', ')}`).toEqual([]);
  });
});
