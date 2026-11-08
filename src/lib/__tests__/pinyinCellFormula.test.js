// 병음 칸 식(ZH-SSR-001, 2026-11-08 KST) — 서버가 재지 않고 낸 칸이 하이드레이션 뒤와 같은지(1px 이하)의 순수 부분.
// 실제 글꼴 대조(설정 전 범위 138조합)는 e2e/pinyin-cell-formula.e2e.mjs가 vendor/google-fonts의 Noto Sans로 한다.
import { describe, expect, it } from 'vitest';
import { PINYIN_EM_WIDTH, PINYIN_ROOT_PX, pinyinCellFormula, pinyinCellWidth, pinyinFontReady, settlePinyinCell } from '../pinyinLayout';

describe('pinyinCellFormula — pinyinCellWidth와 같은 식, 가장 넓은 음절 폭만 글꼴 상수로', () => {
  it('기본 설정(글자 1.6rem · 병음 0.75rem · 뿌리 16px) = 운영 실측 47px', () => {
    expect(PINYIN_ROOT_PX).toBe(16);
    expect(pinyinCellFormula(1.6, 0.75)).toBe(47);
  });
  it('가장 넓은 음절 폭이 k·병음px이면 pinyinCellWidth와 같은 값', () => {
    for (const [f, p] of [[0.8, 0.75], [1.6, 0.75], [2.2, 0.9], [3, 1]]) {
      const widest = PINYIN_EM_WIDTH * p * 16;
      expect(pinyinCellFormula(f, p)).toBe(pinyinCellWidth(() => widest, f * 16));
    }
  });
  it('본문 글자가 더 넓으면 글자 + 2px, 뿌리 크기를 따른다', () => {
    expect(pinyinCellFormula(3, 0.75)).toBe(Math.ceil(3 * 16 + 2));
    expect(pinyinCellFormula(1.6, 0.75, 20)).toBe(Math.ceil(Math.max(1.6 * 20 + 2, PINYIN_EM_WIDTH * 0.75 * 20 + 4)));
  });
});

describe('settlePinyinCell — 식이 정본, 잰 값은 안전망', () => {
  it('글꼴이 아직이면 잰 값(대체 글꼴 폭)을 쓰지 않는다', () => {
    expect(settlePinyinCell(40, 47, false)).toBe(47);
  });
  it('글꼴이 온 뒤 1px 이하 차이는 식 그대로 — 하이드레이션 뒤 칸이 서버 그림과 같다', () => {
    expect(settlePinyinCell(47, 47, true)).toBe(47);
    expect(settlePinyinCell(48, 47, true)).toBe(47);
    expect(settlePinyinCell(46, 47, true)).toBe(47);
  });
  it('글꼴이 온 뒤 1px 넘게 다르면(다른 글꼴로 그려진 기기) 잰 값', () => {
    expect(settlePinyinCell(52, 47, true)).toBe(52);
    expect(settlePinyinCell(null, 47, true)).toBe(47);
  });
});

describe('pinyinFontReady — document.fonts.check로 잴 음절 조각까지', () => {
  const win = { getComputedStyle: () => ({ fontSize: '16px', getPropertyValue: () => "'Noto Sans'" }) };
  it('check가 없으면 준비된 것으로 본다(옛 브라우저 · 지금 동작)', () => {
    expect(pinyinFontReady({ win, doc: { documentElement: {}, body: {} }, root: () => null, pinyinRem: 0.75 })).toBe(true);
  });
  it('check 결과를 그대로 — 잴 음절 전부를 글꼴 크기와 함께 묻는다', () => {
    const asked = [];
    const doc = { documentElement: {}, body: {}, fonts: { check(font, text) { asked.push([font, text]); return false; } } };
    expect(pinyinFontReady({ win, doc, root: () => null, pinyinRem: 0.75 })).toBe(false);
    expect(asked[0][0]).toBe("12px 'Noto Sans'");
    expect(asked[0][1]).toContain('chuāng');
  });
});
