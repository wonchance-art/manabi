import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { rubyFitScale, rubyFitStyle } from '../rubyLayout.js';

// 계약: 병음 토글 시 한자 간격 불변(폭 1em 균일 그리드) + 병음 줄의 '일자' 유지.
// 글자 크기 축소(1차 시도)는 병음마다 세로 지표가 달라져 "글자마다 병음 위치가 다르다"는
// 오너 지적을 받았다 — 크기는 전 음절 동일, 넘치는 폭만 scaleX로 압축한다.

describe('rubyFitScale — 긴 병음 가로 압축비', () => {
  it('셀 안에 들어오는 음절은 압축하지 않는다(대다수 — 원본 폭 유지)', () => {
    for (const py of ['wǒ', 'qù', 'hù', 'de', 'shí', 'kàn', 'lì', 'jǐ']) {
      expect(rubyFitScale(py), py).toBeUndefined();
    }
  });

  it('판정은 글자 수가 아니라 폭이다 — 같은 3자라도 m·w는 넘치고 s·h·í는 안 넘친다', () => {
    // 글자 수 기반(rubyWidthStep)의 잔여 겹침 0.94%가 정확히 이 부류였다(màn màn 실측)
    expect(rubyFitScale('màn')).toBeDefined();
    expect(rubyFitScale('shí')).toBeUndefined();
  });

  it('넓을수록 더 압축한다 — 단조성', () => {
    const k = (py) => Number(rubyFitScale(py) ?? 1);
    expect(k('màn')).toBeGreaterThan(k('guǎn'));
    expect(k('guǎn')).toBeGreaterThan(k('xiǎng'));
    expect(k('xiǎng')).toBeGreaterThan(k('chuāng'));
  });

  it('최장 음절도 하한(0.5) 밑으로는 내려가지 않는다', () => {
    for (const py of ['chuāng', 'shuāng', 'zhuāng', 'zhuāngr']) {
      const k = Number(rubyFitScale(py));
      expect(k).toBeGreaterThanOrEqual(0.5);
      expect(k).toBeLessThan(0.6);
    }
  });

  it('성조 부호는 폭에 영향이 없다 — NFD로 벗겨 같은 값', () => {
    expect(rubyFitScale('chuāng')).toBe(rubyFitScale('chuang'));
    expect(rubyFitScale('mǎn')).toBe(rubyFitScale('màn'));
  });

  it('대문자는 소문자보다 넓게 계산한다(고유명사 Guǎngzhōu)', () => {
    expect(Number(rubyFitScale('Guǎng'))).toBeLessThan(Number(rubyFitScale('guǎng')));
  });

  it('빈 값은 undefined', () => {
    expect(rubyFitScale('')).toBeUndefined();
    expect(rubyFitScale(null)).toBeUndefined();
    expect(rubyFitScale(undefined)).toBeUndefined();
  });

  it('rubyFitStyle — 압축이 필요할 때만 CSS 변수를 낸다', () => {
    expect(rubyFitStyle('wǒ')).toBeUndefined();
    expect(rubyFitStyle('chuāng')).toEqual({ '--rt-k': rubyFitScale('chuāng') });
  });
});

describe('병음 조판 배선 계약', () => {
  const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
  const css = read('src/index.css');
  const viewer = read('src/views/ViewerPage.jsx');

  it('정사각 그리드 — 병음 글자는 길이와 무관하게 1em 고정(오너 피드백: 세로 정렬 유지)', () => {
    expect(css).toMatch(/\.word-token ruby\[data-pinyin\] \{[^}]*width: 1em;/s);
    expect(css).not.toMatch(/ruby\[data-syl="\d"\] \{ min-width/);
  });

  it('병음 줄은 일자다 — 글자 크기는 전 음절 동일, 넘치는 폭만 scaleX 압축', () => {
    // font-size 축소는 병음마다 윗변·베이스라인이 달라져 기각(오너 지적 2026-08-19)
    expect(css).toMatch(/ruby\[data-pinyin\] > rt \{[^}]*scaleX\(var\(--rt-k, 1\)\)/s);
    expect(css).not.toMatch(/ruby\[data-syl="\d"\] rt \{ font-size/);
    expect(viewer).toContain('rubyFitStyle(seg.reading)');
  });

  it('압축 수식의 상수는 CSS 실물과 일치한다 — 어긋나면 추정 폭이 통째로 틀어진다', () => {
    const layout = read('src/lib/rubyLayout.js');
    // rt font-size 0.5em ↔ RT_EM 0.5
    expect(css).toMatch(/\.word-token rt \{[^}]*font-size: 0\.5em;/s);
    expect(layout).toMatch(/const RT_EM = 0\.5;/);
    // rt letter-spacing -0.03em ↔ TRACKING 0.03
    expect(css).toMatch(/\.word-token rt \{[^}]*letter-spacing: -0\.03em;/s);
    expect(layout).toMatch(/const TRACKING = 0\.03;/);
  });

  it('병음과 본문 간격은 네이티브 ruby와 같다(오너 요청: 원래 간격 유지)', () => {
    // bottom: 100%(ruby 상자 맨 위)로 두면 병음이 0.65em 더 떠서 본문이 성겨 보인다(오너 지적).
    // 상자 높이는 .surface의 line-height이므로 비율의 분모가 그 값과 어긋나면 간격이 틀어진다.
    expect(css).toMatch(/ruby\[data-pinyin\] > rt \{[^}]*bottom: calc\(100% - \(0\.65 \/ 2\.2\) \* 100%\);/s);
    expect(css).not.toMatch(/ruby\[data-pinyin\] > rt \{[^}]*bottom: 100%;/s);
    expect(css).toMatch(/\.word-token \.surface \{\s*line-height: 2\.2;/);
  });

  it('rt 절대배치와 압축은 병음 전용이다 — 일본어 요미가나는 기존 동작 유지', () => {
    // 요미는 base보다 긴 경우가 5.7%로 흔해(실측) 같은 방식을 적용하면 겹침이 생긴다
    expect(css).toContain('.word-token ruby[data-pinyin] > rt {');
    expect(css).toContain('.word-token ruby[data-pinyin] { position: relative; }');
    expect(viewer).toContain("data-pinyin={seg.pinyin ? '1' : undefined}");
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
