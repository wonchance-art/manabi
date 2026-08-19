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
    expect(css).toMatch(/ruby\[data-pinyin\] > \.rt-an \{\s*font-size: 0\.26em;/s);
    // 글자별 차등 기제가 되살아나면 일자가 다시 깨진다 — 축소 단계·압축 변수 금지
    expect(css).not.toMatch(/data-syl/);
    expect(css).not.toMatch(/--rt-k/);
    expect(viewer).not.toMatch(/data-syl|rubyFit|rubyWidthStep/);
  });

  it('병음과 본문 간격은 네이티브 ruby와 같다(오너 요청: 원래 간격 유지)', () => {
    // bottom: 100%(ruby 상자 맨 위)로 두면 병음이 0.65em 더 떠서 본문이 성겨 보인다(오너 지적).
    // 상자 높이는 .surface의 line-height이므로 비율의 분모가 그 값과 어긋나면 간격이 틀어진다.
    expect(css).toMatch(/ruby\[data-yomi\] > \.rt-an \{[^}]*bottom: calc\(100% - \(0\.65 \/ 2\.2\) \* 100%\);/s);
    expect(css).not.toMatch(/bottom: 100%;/);
    expect(css).toMatch(/\.word-token \.surface \{\s*line-height: 2\.2;/);
  });

  it('요미가나도 절대배치 — 한자 폭 불변(오너 요청), 단 크기는 0.5em 유지', () => {
    // 요미 최대는 한자 1자당 5자(志=こころざし)라 최장 기준 단일 축소는 0.2em(판독 불가).
    // 절대배치만으로 폭 불변을 보장하고, 넘침은 이웃 가나 위로 흘린다(실측 충돌 0/228쌍).
    expect(css).toMatch(/\.word-token :is\(rt, \.rt-an\) \{[^}]*font-size: 0\.5em;/s);
    expect(css).toMatch(/\.word-token ruby\[data-pinyin\] > \.rt-an,\s*\.word-token ruby\[data-yomi\] > \.rt-an \{/);
    // WebKit은 rt 요소의 절대배치를 무시한다(iOS 실기 결함) — rt 표적 부활 금지
    expect(css).not.toMatch(/ruby\[data-pinyin\] > rt \{/);
    expect(css).toMatch(/\.word-token ruby\[data-pinyin\],\s*\.word-token ruby\[data-yomi\] \{ position: relative; \}/);
    // 소형 단일 크기(0.26em)는 병음 전용 — 요미에 새면 후리가나가 판독 불가로 작아진다
    expect(css).toMatch(/\.word-token ruby\[data-pinyin\] > \.rt-an \{\s*font-size: 0\.26em;\s*\}/);
    expect(viewer).toContain("data-pinyin={seg.pinyin ? '1' : undefined}");
    expect(viewer).toContain("data-yomi={seg.pinyin ? undefined : '1'}");
  });

  it('병음을 꺼도 ruby 마크업과 폭 예약이 남는다(켤 때 밀리지 않게)', () => {
    // 끌 때 글자만 렌더하면 예약 폭이 사라져 토글 시프트가 되살아난다
    expect(viewer).toMatch(/const rubySegments = token\.furigana/);
    expect(viewer).toContain('surface--furi-off');
    expect(css).toContain('.surface--furi-off :is(rt, .rt-an) { visibility: hidden; }');
  });

  it('splitRuby가 중국어 병음 경로에만 표식을 남긴다(lib로 추출 — 단위 테스트는 splitRuby.test.js)', () => {
    const lib = read('src/lib/splitRuby.js');
    expect(lib).toMatch(/reading: syllables\[i\], pinyin: true/);
    // 공백 조건 부활 금지 — 한 글자 단어가 일본어 경로로 새면 병음이 요미 크기로 커진다
    expect(lib).not.toMatch(/furigana\.includes\(' '\)/);
    expect(viewer).toContain("import { splitRuby } from '../lib/splitRuby'");
  });
});

// 계약: 중국어 자형·병음 폰트 (오너 확정 2026-08-19 — 시연장 비교 후 선택)
// 중국어 = Noto Sans SC(간체 표준 자형) · 병음 = Noto Sans(성조 부호 전 범위).
describe('중국어·병음 폰트 계약', () => {
  const layout = read('src/app/layout.jsx');

  it('레이아웃이 두 폰트를 로드하고 CSS 변수로 노출한다', () => {
    expect(layout).toMatch(/Noto_Sans_SC\(\{[^}]*variable: '--font-noto-sc'/s);
    expect(layout).toMatch(/const notoSans = Noto_Sans\(\{[^}]*variable: '--font-noto-sans'/s);
    expect(layout).toContain('${notoSc.variable} ${notoSans.variable}');
  });

  it('lang="zh*" 요소는 간체 표준 자형으로 렌더된다(한글 폴백은 KR)', () => {
    expect(css).toMatch(/:lang\(zh\) \{\s*font-family: var\(--font-noto-sc, 'Noto Sans SC'\), var\(--font-noto-kr/);
  });

  it('병음 라틴은 루비·상세 예문·병음 요소 공용으로 Noto Sans를 쓴다', () => {
    expect(css).toMatch(/\.pinyin-text,\s*\.pdf-detail-pinyin,\s*\.word-token ruby\[data-pinyin\] > \.rt-an,\s*\[lang\^="zh"\] \+ \.fr-example__ipa \{\s*font-family: var\(--font-noto-sans, 'Noto Sans'\)/);
  });

  it('뷰어 본문은 중국어 자료에서 SC를 사용자 글꼴 설정 앞에 놓는다', () => {
    expect(viewer).toContain("? `var(--font-noto-sc, 'Noto Sans SC'), ${fontFamily}`");
  });

  it('단어 카드·원문 인용에 자료 언어 표식과 병음 라틴 클래스가 붙는다(팝업은 ②로 카드 단일화)', () => {
    expect(viewer).toMatch(/const contentLangTag = materialLang === 'Chinese' \? 'zh-Hans'/);
    expect(viewer.match(/lang=\{contentLangTag\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(viewer.match(/className=\{seg\.pinyin \? \['pinyin-text', showToneColors && pinyinToneClass\(seg\.reading\)\]\.filter\(Boolean\)\.join\(' '\) : undefined\}/g)?.length).toBe(1);
  });

  it('성조 색상은 병음에만·옵트인이다(오너 확정: "병음만")', () => {
    // 한자에 색이 새면 오너 결정 위반 — 클래스는 rt에만 붙는다
    // 본문(.word-token 조합)과 시트·팝업(단독) 둘 다 — 본문 조합이 빠지면 기본색
    // 규칙(.word-token rt)이 순서로 이겨 본문만 무색이 된다(오너 발견 회귀)
    expect(css).toMatch(/\.word-token :is\(rt, \.rt-an\)\.pinyin-tone--1, :is\(rt, \.rt-an\)\.pinyin-tone--1 \{ color: var\(--tone-1\); \}/);
    expect(css).toMatch(/\[data-theme="light"\] \{\s*--tone-1:/);
    expect(viewer).toContain("'rt-an', showToneColors && seg.pinyin ? pinyinToneClass(seg.reading) : ''");
    // 단어 카드도 병음 rt에만 합성(pinyin-text와 병행) — 팝업은 카드 단일화(②)로 소멸
    expect(viewer.match(/showToneColors && pinyinToneClass\(seg\.reading\)/g)?.length).toBe(1);
    // 기본 꺼짐(옵트인) — showHanjaKo 선례
    const settings = read('src/lib/useViewerSettings.js');
    expect(settings).toContain("readPref('showToneColors', false)");
  });

  it('일본어도 같은 방식 — :lang(ja)는 JP 우선, 뷰어 본문은 JP를 설정 글꼴 앞에 놓는다(오너 지적)', () => {
    expect(css).toMatch(/:lang\(ja\) \{\s*font-family: var\(--font-noto-jp, 'Noto Sans JP'\), var\(--font-noto-kr/);
    expect(viewer).toContain("? `var(--font-noto-jp, 'Noto Sans JP'), ${fontFamily}`");
    // 본문 기본 굵기 400 — 없으면 브라우저가 500으로 대체해 본문이 굵어진다
    expect(layout).toMatch(/Noto_Sans_JP\(\{[^}]*weight: \['400', '500', '700'\]/s);
  });
});
