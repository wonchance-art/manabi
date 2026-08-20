import { describe, expect, it } from 'vitest';
import { fitDivisor, isFitLang } from '../fitWord.js';

// 계약: 폭맞춤 분모(①) — 카드 글꼴 크기 = 100cqi ÷ 이 값(index.css .word-fit).
describe('fitDivisor', () => {
  it('기본은 글자 수 — CJK 1em 격자에서 폭 = 글자수 × 1em', () => {
    expect(fitDivisor('强调', 'qiáng diào', 'Chinese')).toBe(2);
    expect(fitDivisor('图书馆', 'tú shū guǎn', 'Chinese')).toBe(3);
    expect(fitDivisor('我', 'wǒ', 'Chinese')).toBe(1);
  });

  it('일본어는 요미 폭(글자수÷2)이 본문보다 넓으면 그쪽이 분모 — 志(1자)·こころざし(5자)', () => {
    expect(fitDivisor('志', 'こころざし', 'Japanese')).toBe(2.5);
    // 요미가 본문보다 좁으면 본문 글자 수 유지
    expect(fitDivisor('取りまとめ', 'とりまとめ', 'Japanese')).toBe(5);
  });

  it('병음은 0.26em 단일 크기 계약으로 셀을 넘지 않으므로 중국어엔 요미 보정이 없다', () => {
    // 최장 병음 chuāng(6자)도 분모는 글자 수 1
    expect(fitDivisor('窗', 'chuāng', 'Chinese')).toBe(1);
  });

  it('빈 입력은 1(0 나눗셈 방지), 독음 없는 단어는 글자 수', () => {
    expect(fitDivisor('', null, 'Chinese')).toBe(1);
    expect(fitDivisor('あそこ', null, 'Japanese')).toBe(3);
  });
});

describe('isFitLang', () => {
  it('전각 1em 격자가 성립하는 CJK만 — 라틴 자료는 기존 크기 유지', () => {
    expect(isFitLang('Chinese')).toBe(true);
    expect(isFitLang('Japanese')).toBe(true);
    expect(isFitLang('English')).toBe(false);
    expect(isFitLang('French')).toBe(false);
  });
});
