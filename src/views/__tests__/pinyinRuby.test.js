import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약: 병음 조판 — 토글 시 한자 간격 불변(폭 1em 균일 그리드) + 병음 줄의 '일자'.
// 오너 확정(2026-08-19): 병음은 **전 음절 단일 크기**로 조판한다. 크기가 음절마다
// 다르면(#1056~#1058의 길이별 축소) 윗변·베이스라인·글자 키가 달라져 "글자마다 병음
// 위치가 다르다"는 지적을 받았다. 크기는 최장 병음(chuāng — 자기 글자 폭의 3.55배)이
// 1em 셀에 들어가는 값으로 고정하고, 작아지는 만큼은 뷰어의 글자 크기 조절로 보완한다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const css = read('src/index.css');
const viewer = read('src/views/ViewerPage.jsx');

describe('병음 조판 계약', () => {
  it('정사각 그리드 — 병음 글자는 길이와 무관하게 1em 고정(오너 피드백: 세로 정렬 유지)', () => {
    expect(css).toMatch(/\.word-token ruby\[data-pinyin\] \{[^}]*width: 1em;/s);
  });

  it('병음 줄은 일자다 — 전 음절 단일 크기, 글자별 크기·압축 없음', () => {
    // 최장 병음이 셀에 들어가는 크기(0.94 / 3.55 ≈ 0.26em)라 어떤 인접쌍도 겹칠 수 없다
    expect(css).toMatch(/ruby\[data-pinyin\] > rt \{[^}]*font-size: 0\.26em;/s);
    // 글자별 차등 기제가 되살아나면 일자가 다시 깨진다 — 축소 단계·압축 변수 금지
    expect(css).not.toMatch(/data-syl/);
    expect(css).not.toMatch(/--rt-k/);
    expect(viewer).not.toMatch(/data-syl|rubyFit|rubyWidthStep/);
  });

  it('병음과 본문 간격은 네이티브 ruby와 같다(오너 요청: 원래 간격 유지)', () => {
    // bottom: 100%(ruby 상자 맨 위)로 두면 병음이 0.65em 더 떠서 본문이 성겨 보인다(오너 지적).
    // 상자 높이는 .surface의 line-height이므로 비율의 분모가 그 값과 어긋나면 간격이 틀어진다.
    expect(css).toMatch(/ruby\[data-pinyin\] > rt \{[^}]*bottom: calc\(100% - \(0\.65 \/ 2\.2\) \* 100%\);/s);
    expect(css).not.toMatch(/ruby\[data-pinyin\] > rt \{[^}]*bottom: 100%;/s);
    expect(css).toMatch(/\.word-token \.surface \{\s*line-height: 2\.2;/);
  });

  it('rt 절대배치·소형 크기는 병음 전용이다 — 일본어 요미가나는 기존 0.5em 유지', () => {
    // 요미는 base보다 긴 경우가 5.7%로 흔해(실측) 같은 방식을 적용하면 겹침이 생긴다
    expect(css).toMatch(/\.word-token rt \{[^}]*font-size: 0\.5em;/s);
    expect(css).toContain('.word-token ruby[data-pinyin] > rt {');
    expect(css).toContain('.word-token ruby[data-pinyin] { position: relative; }');
    expect(viewer).toContain("data-pinyin={seg.pinyin ? '1' : undefined}");
  });

  it('병음을 꺼도 ruby 마크업과 폭 예약이 남는다(켤 때 밀리지 않게)', () => {
    // 끌 때 글자만 렌더하면 예약 폭이 사라져 토글 시프트가 되살아난다
    expect(viewer).toMatch(/const rubySegments = token\.furigana/);
    expect(viewer).toContain('surface--furi-off');
    expect(css).toContain('.surface--furi-off rt { visibility: hidden; }');
  });

  it('splitRuby가 중국어 병음 경로에만 표식을 남긴다', () => {
    expect(viewer).toMatch(/reading: syllables\[i\], pinyin: true/);
  });
});
