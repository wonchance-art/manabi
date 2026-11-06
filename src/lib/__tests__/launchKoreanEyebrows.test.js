import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 발매 점검 #4 · #9(오너 승인 목업 Ez2VCekG8Nub5dTT5wBamA ①, 2026-11-06 KST).
const read = (p) => readFileSync(p, 'utf8');

describe('#9 영어 머리 줄 → 한국어', () => {
  it('복습실 · 01 / 떠올리기 · 02 / 문형 · manabi 교재 · manabi 읽을거리', () => {
    const vocab = read('src/views/VocabPage.jsx');
    expect(vocab.match(/<p className="manabi-eyebrow">복습실<\/p>/g)).toHaveLength(3);
    expect(vocab).toContain('<span className="manabi-eyebrow">01 / 떠올리기</span>');
    expect(vocab).toContain('<p className="manabi-eyebrow">02 / 문형</p>');
    expect(vocab).not.toMatch(/THE REVIEW ROOM|01 \/ RECALL|02 \/ PATTERNS/);
    expect(read('src/components/books/BookCover.jsx')).toContain('<span>manabi 교재</span>');
    expect(read('src/components/materials/SuggestionReader.jsx')).toContain('<p className="manabi-eyebrow">manabi 읽을거리</p>');
  });
});

describe('#4 단어 카드 — 저장 전 단어엔 네 칸이 곧 저장', () => {
  it('저장 전에만 「· 고르면 단어장에 저장돼요」, 간체 · 번체 사전', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('{vt("얼마나 알겠어요?")}{!isWordSaved && <span className="save-grade__hint"> · {vt("고르면 단어장에 저장돼요")}</span>}');
    expect(read('src/lib/viewerMessages.js')).toContain("['고르면 단어장에 저장돼요','选择后会存入单词本','選擇後會存入單字本']");
  });
});
