import { describe, expect, it } from 'vitest';
import { pinyinToneNumber, pinyinToneClass } from '../pinyinTone.js';

// 계약: 성조 색상(오너 확정 — 병음에만). 성조는 병음 발음 부호에서만 파생한다.
describe('pinyinToneNumber', () => {
  it('4성 전부 + 경성', () => {
    expect(pinyinToneNumber('shāng')).toBe(1);
    expect(pinyinToneNumber('míng')).toBe(2);
    expect(pinyinToneNumber('wǒ')).toBe(3);
    expect(pinyinToneNumber('qù')).toBe(4);
    expect(pinyinToneNumber('xi')).toBe(0); // 轻声 — 부호 없음
  });

  it('ü 계열·대문자(고유명사)도 판정한다', () => {
    expect(pinyinToneNumber('lǜ')).toBe(4);
    expect(pinyinToneNumber('nǚ')).toBe(3);
    expect(pinyinToneNumber('Ā')).toBe(1);
    expect(pinyinToneNumber('Guǎng')).toBe(3);
  });

  it('병음이 아니면 null — 클래스도 무부착', () => {
    expect(pinyinToneNumber('')).toBeNull();
    expect(pinyinToneNumber(null)).toBeNull();
    expect(pinyinToneNumber('。')).toBeNull();
    expect(pinyinToneClass('。')).toBeUndefined();
  });

  it('클래스 형식', () => {
    expect(pinyinToneClass('wǒ')).toBe('pinyin-tone--3');
    expect(pinyinToneClass('ma')).toBe('pinyin-tone--0');
  });
});
