import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { rubyWidthStep } from '../rubyLayout.js';

// 계약(오너 요청 2026-08-19): 병음을 켜고 꺼도 한자 간격이 변하지 않는다.
// rt를 절대배치로 빼 base 폭에서 제외하고(변화 0), 넘쳐 겹치는 구간만 폭을 예약한다.

describe('rubyWidthStep — 긴 병음 축소 단계', () => {
  it('1~3자는 한자 폭 안에 들어와 축소하지 않는다(전체의 70%)', () => {
    for (const py of ['à', 'wǒ', 'nǐ', 'qùn', 'guǎ', 'xué', 'shū']) {
      expect(rubyWidthStep(py)).toBeUndefined();
    }
  });

  it('4·5·6자는 실측 폭 초과분에 맞춰 축소 단계를 올린다', () => {
    expect(rubyWidthStep('guǎn')).toBe('4');   // 4자 21px > base 20px
    expect(rubyWidthStep('xiǎng')).toBe('5');  // 5자 22.4px
    expect(rubyWidthStep('shuāng')).toBe('6'); // 6자 31px
    expect(rubyWidthStep('chuāng')).toBe('6');
  });

  it('7자 이상도 최상위 단계로 수렴한다', () => {
    expect(rubyWidthStep('zhuāngr')).toBe('6');
  });

  it('대문자는 한 단계 올린다 — 고유명사가 같은 글자 수에도 넘친다(실측)', () => {
    expect(rubyWidthStep('Guǎng')).toBe('6');  // 5자 + 대문자 → 6
    expect(rubyWidthStep('guǎng')).toBe('5');  // 같은 글자 수, 소문자
    expect(rubyWidthStep('Wǒ')).toBeUndefined(); // 2자 + 대문자 = 3 → 보정 불요
  });

  it('빈 값은 보정하지 않는다', () => {
    expect(rubyWidthStep('')).toBeUndefined();
    expect(rubyWidthStep(null)).toBeUndefined();
    expect(rubyWidthStep(undefined)).toBeUndefined();
  });
});

describe('병음 조판 배선 계약', () => {
  const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
  const css = read('src/index.css');
  const viewer = read('src/views/ViewerPage.jsx');

  it('정사각 그리드 — 병음 글자는 길이와 무관하게 1em 고정(오너 피드백: 세로 정렬 유지)', () => {
    // 글자마다 폭을 다르게 예약했더니 정렬이 깨지고 성겨 보였다 → 폭은 균일, 겹침은 축소로
    expect(css).toMatch(/\.word-token ruby\[data-pinyin\] \{[^}]*width: 1em;/s);
    expect(css).not.toMatch(/ruby\[data-syl="\d"\] \{ min-width/);
  });

  it('rt 절대배치와 축소는 병음 전용이다 — 일본어 요미가나는 기존 동작 유지', () => {
    // 요미는 base보다 긴 경우가 5.7%로 흔해(실측) 같은 방식을 적용하면 겹침이 생긴다
    expect(css).toContain('.word-token ruby[data-pinyin] > rt {');
    expect(css).toContain('.word-token ruby[data-pinyin] { position: relative; }');
    expect(css).toMatch(/\.word-token ruby\[data-syl="6"\] rt \{ font-size: 0\.\d+em/);
    expect(viewer).toContain("data-pinyin={seg.pinyin ? '1' : undefined}");
    expect(viewer).toContain('seg.pinyin ? rubyWidthStep(seg.reading) : undefined');
  });

  it('병음을 꺼도 ruby 마크업과 폭 예약이 남는다(켤 때 밀리지 않게)', () => {
    // 끌 때 글자만 렌더하면 예약 폭이 사라져 토글 시프트가 되살아난다
    expect(viewer).toMatch(/const rubySegments = token\.furigana/);
    expect(viewer).toContain("surface--furi-off");
    expect(css).toContain('.surface--furi-off rt { visibility: hidden; }');
  });

  it('splitRuby가 중국어 병음 경로에만 표식을 남긴다', () => {
    expect(viewer).toMatch(/reading: syllables\[i\], pinyin: true/);
  });
});
