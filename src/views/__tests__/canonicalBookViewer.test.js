import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// 정본 책은 네 출처 모두 같은 뷰어 규칙(감사 2026-10-17 — 아오조라 대조표만 보던 자리에서 위키문헌 · 전자책 사이트 · SE 책이
// 교재처럼 「다음 과 적기」 · 제목 고치기를 받았다). 판정은 metadata만 보는 isCanonicalLiteratureMaterial(canonicalLiteratureLocked).
const src = readFileSync('src/views/ViewerPage.jsx', 'utf8');

describe('정본 책 뷰어 — 이어 적기 · 제목 고치기 없음, 「과」 대신 「장」', () => {
  it('이어 적기와 제목 고치기는 네 출처 판정으로 막는다', () => {
    expect(src).toMatch(/canAppend: [^\n]*!canonicalLiteratureLocked/u);
    expect(src).toMatch(/!composerOf\(material\) && !canonicalLiteratureLocked/u);
  });
  it('아오조라 밖 정본 책의 형제 내비는 「이전 장 · 다음 장」, 다음 카드는 「이어 읽기」', () => {
    expect(src).toContain("canonicalLiteratureLocked\n            ? { prevLabel: bookNav.prev ? `이전 장: ");
    expect(src).toContain('literatureBook || canonicalLiteratureLocked ? vt("이어 읽기 ·")');
  });
});
