import { describe, expect, it } from 'vitest';
import { isWordToken, opensWordCard, wordStateOf, wordStateExtraClass } from '../wordState.js';

// 단어 상태 하이라이트 캐논(B안 — 오너 확정 2026-08-27) 계약.
describe('wordStateOf — 우선순위 계약: due > saved > known > met > new', () => {
  const base = { isWord: true, isSaved: false, isDue: false, isKnown: false, isMet: false };

  it('복습(due)이 최우선 — 저장·앎이 겹쳐도 due', () => {
    expect(wordStateOf({ ...base, isSaved: true, isDue: true, isKnown: true, isMet: true })).toBe('due');
  });

  it('저장(학습 중)은 앎보다 우선 — 학습 중 표시가 살아야 한다', () => {
    expect(wordStateOf({ ...base, isSaved: true, isKnown: true })).toBe('saved');
  });

  it("'이미 앎'은 무표시 상태지만 met/new를 차단한다", () => {
    expect(wordStateOf({ ...base, isKnown: true, isMet: true })).toBe('known');
    expect(wordStateOf({ ...base, isKnown: true })).toBe('known');
  });

  it('만난 말은 신규보다 우선', () => {
    expect(wordStateOf({ ...base, isMet: true })).toBe('met');
  });

  it('아무 이력 없는 어휘 = 신규', () => {
    expect(wordStateOf(base)).toBe('new');
  });

  it('비어휘는 null — 마킹 없음', () => {
    expect(wordStateOf({ ...base, isWord: false, isSaved: true, isDue: true })).toBe(null);
  });
});

describe('isWordToken — 어휘 판정', () => {
  it('기호 pos는 비어휘', () => {
    expect(isWordToken({ text: '。', pos: '기호' })).toBe(false);
  });

  it('글자 없는 토큰(숫자만·공백)은 비어휘', () => {
    expect(isWordToken({ text: '2026', pos: '수사' })).toBe(false);
    expect(isWordToken({ text: ' ', pos: null })).toBe(false);
  });

  it('한자·가나·라틴 어휘는 어휘', () => {
    expect(isWordToken({ text: '朋友', pos: '명사' })).toBe(true);
    expect(isWordToken({ text: 'たべる', pos: '동사' })).toBe(true);
    expect(isWordToken({ text: 'bonjour', pos: null })).toBe(true);
  });

  it('분석 실패 토큰은 비어휘 — 실패 표시가 우선', () => {
    expect(isWordToken({ text: '笔在', failed: true })).toBe(false);
  });
});

describe('wordStateExtraClass — met/new만 새 클래스', () => {
  it('met/new는 전용 클래스, 나머지는 빈 문자열(saved/due는 기존 클래스·known은 무표시)', () => {
    expect(wordStateExtraClass('met')).toBe('word-token--met');
    expect(wordStateExtraClass('new')).toBe('word-token--new');
    expect(wordStateExtraClass('saved')).toBe('');
    expect(wordStateExtraClass('due')).toBe('');
    expect(wordStateExtraClass('known')).toBe('');
    expect(wordStateExtraClass(null)).toBe('');
  });
});

// 뷰어 점검 2026-10-23: 「，」·「、」를 누르면 「(뜻 없음)」 카드가 열리고 등급을 누르면 부호가 단어장 · 복습에 저장됐다.
// 카드를 여는 판정은 한 곳(opensWordCard) — 뷰어 탭 처리와 낱말 버튼 역할(Tab 정거장)이 같은 판정을 쓴다.
describe('opensWordCard — 문장부호는 단어 카드를 열지 않는다', () => {
  it('부호 · 개행 · 글자 없는 토큰은 거르고 낱말 · 숫자 · 분석 실패 토큰은 연다', () => {
    for (const token of [{ text: '，', pos: '기호' }, { text: '、', pos: '기호' }, { text: '。', pos: '기타' }, { text: '…', pos: '명사' }, { text: '\n', pos: '개행' }, { text: 'today', pos: '기호' }, null])
      expect(opensWordCard(token)).toBe(false);
    for (const token of [{ text: '图书馆', pos: '명사' }, { text: '図書館', pos: '名詞' }, { text: 'today,', pos: '명사' }, { text: '2026', pos: '수사' }, { text: '오늘은', failed: true }])
      expect(opensWordCard(token)).toBe(true);
  });
  it('뷰어 탭 처리와 낱말 버튼 역할이 같은 판정을 쓴다', async () => {
    const fs = await import('node:fs');
    const viewer = fs.readFileSync('src/views/ViewerPage.jsx', 'utf8'), token = fs.readFileSync('src/components/viewer/ReaderToken.jsx', 'utf8');
    expect(viewer).toMatch(/if \(!opensWordCard\(token\)\) return;/);
    expect(token).toMatch(/const wordAction = !opensWordCard\(token\) \? \{\} :/);
  });
});
