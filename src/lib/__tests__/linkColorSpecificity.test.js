import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 읽기 화면 링크의 글자색 상속(reading-shell.css): .btn 링크는 빼되 우선순위는 (0,1,1)로 둔다.
// :not(.btn) 단독은 (0,2,1)이 되어 .manabi-button(흰 글자) · .manabi-link(로즈)를 덮었다 — 로즈 바탕 어두운 글자 2.5:1(2026-10-17 리뷰).
const css = fs.readFileSync(path.resolve(__dirname, '../../components/books/reading-shell.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const inheritRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, selector, body]) => /\ba\b/.test(selector) && /color:\s*inherit/.test(body) && selector.includes('.manabi-page'));

describe('.manabi-page 링크 글자색 상속', () => {
  it('규칙이 있고 .btn 링크는 뺀다', () => {
    expect(inheritRules).toHaveLength(1);
    expect(inheritRules[0][1]).toContain(':not(.btn)');
  });
  it(':not()은 :where() 안에만 — 우선순위를 올려 버튼 · 강조 링크 색을 빼앗지 않는다', () => {
    const bare = inheritRules[0][1].replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
    expect(bare).not.toContain(':not(');
  });
});
