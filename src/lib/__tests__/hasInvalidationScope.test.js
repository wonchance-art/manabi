import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약(TAP-INP-HAS-001): :has()가 칠할 요소보다 앞(조상·형제)에 걸린 규칙은 맨 오른쪽 칸에 클래스·id·속성을 둔다.
 *
 * Blink는 「앞 칸:has(…) 뒤 칸」 규칙들의 뒤 칸 특징을 하나의 :has 무효화 묶음으로 합친다. 앱 바깥 틀(.manabi-app ·
 * body · .viewer-layout)이 그런 :has의 기준이라, 그 안에 요소가 하나 붙거나 빠질 때마다(= 거의 모든 React 렌더) 묶음에
 * 든 특징을 가진 **문서 전체의 요소**를 다시 계산한다. 뒤 칸이 태그뿐이면(`…:has(select:disabled)>span`) 그 태그 전부 —
 * 뷰어 390 실측: 요소 하나를 붙이는 데 스타일 재계산 1,176개(span 전부) → 고친 뒤 782개, 교재 192 → 7개 · 배움 58 → 7개.
 * 클래스·속성이 있으면 그 클래스를 가진 몇 개만 다시 계산한다. 칠할 요소 자신에 :has를 걸면(맨 오른쪽 칸) 그 요소만이다.
 */
const root = path.join(process.cwd(), 'src');
const cssFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); }
    else if (entry.name.endsWith('.css')) cssFiles.push(full);
  }
})(root);

/** 괄호 밖의 쉼표로 나눈 선택자 목록(규칙 머리만 — @media 등 at-규칙 머리는 뺀다). */
function selectorsOf(css) {
  const out = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of text.matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1].trim();
    if (!prelude || prelude.startsWith('@') || !prelude.includes(':has(')) continue;
    let depth = 0, cur = '';
    for (const ch of prelude) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out.filter((s) => s.includes(':has('));
}

/** 괄호 밖 결합자(공백 · > · + · ~) 기준 맨 오른쪽 칸과 그 앞부분. */
function splitRightmost(selector) {
  let depth = 0, cut = -1;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && /[\s>+~]/.test(ch)) cut = i;
  }
  return { head: cut < 0 ? '' : selector.slice(0, cut + 1), last: selector.slice(cut + 1) };
}

/** 맨 오른쪽 칸이 클래스·id·속성 없이 태그/전체(*)/의사 클래스뿐인가 — 의사 요소(::before)와 :is/:where 안쪽은 보지 않는다. */
function bareSubject(last) {
  const own = last.replace(/::?[\w-]+(\([^)]*\))?/g, (m) => (/^:(is|where)\(/.test(m) ? m : ''));
  return !/[.#[]/.test(own);
}

function wideHasRules(css) {
  return selectorsOf(css).filter((s) => {
    const { head, last } = splitRightmost(s);
    return head.includes(':has(') && bareSubject(last);
  });
}

describe(':has() 무효화 범위(TAP-INP-HAS-001)', () => {
  it('검사기 자체 — 태그만 남는 뒤 칸은 잡고, 클래스 뒤 칸 · 자기 :has는 통과', () => {
    expect(wideHasRules('.a:has(select:disabled)>span {color:red}')).toEqual(['.a:has(select:disabled)>span']);
    expect(wideHasRules('.a:has(input) label, .b:has(.x) * {x:y}')).toHaveLength(2);
    expect(wideHasRules('.a:has(.x) .b::before {x:y}')).toEqual([]);
    expect(wideHasRules('.a>span:has(~select:disabled) {x:y}')).toEqual([]);
    expect(wideHasRules('.a:has(.x)>[data-y] {x:y} @media (hover:none) {.c:has(> .d)::before {x:y}}')).toEqual([]);
  });

  it('src의 모든 CSS — :has가 앞 칸에 걸린 규칙의 맨 오른쪽 칸은 클래스·id·속성을 가진다', () => {
    const offenders = cssFiles.flatMap((file) => wideHasRules(fs.readFileSync(file, 'utf8')).map((s) => `${path.relative(root, file)}: ${s}`));
    expect(offenders).toEqual([]);
  });

  it('읽기 설정의 꺼짐 표시는 칠할 요소 자신에 :has를 건다(같은 특이도 · 같은 대상)', () => {
    const css = fs.readFileSync(path.join(root, 'components/viewer/reader-controls.css'), 'utf8');
    expect(css).toContain('.reader-settings .reader-setting-select>span:has(~select:disabled) {color:var(--reader-muted);}');
    expect(css).toContain('.reader-settings .reader-setting-toggle>label:has(input:disabled) {cursor:default;color:var(--reader-muted);}');
    expect(css).not.toContain(':has(select:disabled)>span');
    expect(css).not.toContain(':has(input:disabled)>label');
  });
});
