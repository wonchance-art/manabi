import {viewerDefaults,readerFontFamily} from '../../lib/viewerPreferences';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Phase 2: 12–16px 병음과 공통 셀 폭. 실제 겹침/공개 시 이동은 브라우저에서 검증.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const css = read('src/index.css');
const viewer = read('src/views/ViewerPage.jsx');
const readerCss = read('src/components/viewer/reader-controls.css');

describe('병음 조판 계약', () => {
  it('병음 공간 예약 모드는 모든 음절에 같은 측정 폭을 사용한다', () => {
    expect(readerCss).toContain('width:max(1em,var(--pinyin-cell))');
    expect(viewer).toContain("data-pron-spacing={materialLang==='Chinese'");
  });

  it('병음 줄은 일자다 — 전 음절 단일 크기, 글자별 크기·압축 없음', () => {
    expect(readerCss).toMatch(/ruby\[data-pinyin\] > \.rt-an \{font-size:var\(--pinyin-size\);/s);
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

  it('병음 기준점과 선택 테두리 윗변은 같은 두 값(--hl-band-top · --hl-frame-top)에서 나온다(VIEWER-R0 버그 6a)', () => {
    // 「A + 테두리 여백」(오너 확정 2026-10-07): 병음은 테두리 바깥 윗변 위에 앉는다. 병음 상자의
    // 기준(ruby = .surface 줄 상자 2.2em)에서 띠 윗변은 (0.58 / 2.2) * 100%이고, 테두리 바깥 윗변은
    // 거기서 --hl-frame-top만큼 위다. 한쪽만 바뀌면(띠 좌표·줄 높이·테두리 여백) 병음 꼬리가 다시
    // 테두리를 넘는다 — 옛 0.65 / 2.2는 병음 고정 크기(#1294) 이전 값이라 실제로 넘었다.
    const band = css.match(/\.reader-settings__preview,\s*\.reader-area \{[^}]*--hl-band-top: ([\d.]+)em;/s)?.[1];
    const lineHeight = css.match(/\.word-token \.surface \{\s*line-height: ([\d.]+);/)?.[1];
    expect(band).toBe('0.58');
    expect(css).toMatch(/\.reader-settings__preview,\s*\.reader-area \{[^}]*--hl-frame-top: \d+(\.\d+)?px;/s);
    const pinyin = readerCss.match(/\.viewer-layout :is\(\.reader-area,\.reader-settings__preview\) ruby\[data-pinyin\] > \.rt-an \{bottom:calc\(100% - \(([\d.]+) \/ ([\d.]+)\) \* 100% \+ var\(--hl-frame-top\) \+ var\(--hl-pinyin-gap\) \+ [\d.]+em\);\}/);
    expect(pinyin, 'pinyin baseline rule').not.toBeNull();
    expect(pinyin[1]).toBe(band);
    expect(pinyin[2]).toBe(lineHeight);
    // 실글꼴 여유(R0 실글꼴 검수 2026-10-07): 내림획(g·y·j)이 1.2 줄 상자 밖으로 ≈0.03em 나오고
    // 화소 맞춤이 ±0.33px라, 상자 간격 0.1em(1.2px)은 잉크 1.0px였다 — 2.5px 아래로 내리지 말 것.
    expect(parseFloat(css.match(/--hl-pinyin-gap: ([\d.]+)px;/)?.[1])).toBeGreaterThanOrEqual(2.5);
    // 灬·体 아래 획(1.60em)과 띠(1.62em)가 0.3px뿐이라 밑줄은 띠 + 2px 이상이어야 잉크 1px이 남는다.
    expect(parseFloat(css.match(/--hl-mark-gap: ([\d.]+)px;/)?.[1])).toBeGreaterThanOrEqual(2);
    // 테두리 아랫변은 밑줄 칸에서 유도 — 밑줄 간격을 바꾸면 테두리가 따라간다(선이 겹치지 않게).
    expect(css).toContain('--hl-frame-bottom: calc(var(--hl-mark-gap) + 4px);');
    expect(readerCss).toContain('.word-token--pattern:is(.word-token--saved,.word-token--due) {--hl-frame-bottom:calc(var(--hl-mark-gap) * 2 + 5.5px);}');
    // 병음을 올린 만큼 줄 사이 겹침이 생기지 않게 — 본문·Aa 미리보기 모두 줄 간격의 하한을 둔다
    // (실글꼴: 12.8px·병음 16px·간격 15px에서 다음 줄 병음이 앞줄 테두리에 3.3px 얹혔다). 저장된 줄 간격은 그대로.
    expect(readerCss).toMatch(/\.viewer-layout\[data-pron-spacing="reserved"\] :is\(\.reader-area,\.reader-settings__preview\) \{--hl-row-gap-min:calc\(var\(--pinyin-size\) \* [\d.]+ \+ var\(--hl-frame-top\) \+ var\(--hl-pinyin-gap\) \+ var\(--hl-mark-gap\) \* 2 \+ 5\.5px \+ 1px - 1\.16em\);\}/);
    expect(viewer).toContain("gap: `max(${lineGap}px, var(--hl-row-gap-min, 0px)) ${charGap}rem`");
    expect(read('src/components/viewer/ViewerPreview.jsx')).toContain("'--preview-row-gap':`max(${s.lineGap}px, var(--hl-row-gap-min, 0px))`");
    // 요미는 원래 자리(0.65 / 2.2)를 지키되, 테두리에 닿을 때만 같은 두 값으로 올라간다.
    const yomi = readerCss.match(/ruby\[data-yomi\] > \.rt-an \{bottom:max\(calc\(100% - \(0\.65 \/ 2\.2\) \* 100%\),calc\(100% - \(([\d.]+) \/ ([\d.]+)\) \* 100% \+ var\(--hl-frame-top\) \+ var\(--hl-pinyin-gap\) - [\d.]+em\)\);\}/);
    expect(yomi, 'yomi baseline rule').not.toBeNull();
    expect([yomi[1], yomi[2]]).toEqual([band, lineHeight]);
    const frame = readerCss.match(/\.viewer-layout \.word-token\[data-selected="true"\]::before \{[^}]*\}/)?.[0] || '';
    expect(frame).toContain('top:calc(var(--hl-band-top) - var(--hl-frame-top))');
    expect(frame).toContain('height:calc(var(--hl-frame-top) + var(--hl-band-h) + var(--hl-frame-bottom))');
    // 테두리는 띠(면 칠)에 그리지 않는다 — 옛 inset 그림자 부활 금지
    expect(readerCss).not.toMatch(/\[data-selected="true"\] \.surface::before \{[^}]*box-shadow:inset/);
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
    // import 줄을 통째로 박으면 **같은 모듈에서 이름 하나만 더해도** 깨진다(요미 分散配置가
    // `KANA_RE`를 같이 가져오며 실제로 걸렸다). 요구는 「splitRuby가 lib에 있고 뷰어가
    // 그걸 쓴다」이므로 그것만 고정한다.
    expect(viewer).toMatch(/import \{[^}]*\bsplitRuby\b[^}]*\} from '\.\.\/lib\/splitRuby'/);
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

  it("중국어 서체 선택이 실제 SC 고딕과 명조에 연결된다", () => {
    expect(readerFontFamily('Chinese','sans')).toContain('--font-noto-sc'); expect(readerFontFamily('Chinese','serif')).toContain('--font-reader-serif'); expect(viewer).toContain('fontFamily: readerFontFamily(materialLang,fontFamily)');
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
    // 단어창 표제어(.word-fit)도 같은 함정 — `.word-fit :is(rt, .rt-an)` 기본색(0,2,0)이 뒤에서
    // 이겨 표제어 병음만 한 색이었다(VIEWER-R0 버그 2). 다섯 성조 모두 .word-fit 조합(0,3,0)을 둔다.
    for (const n of [0, 1, 2, 3, 4]) {
      expect(css).toContain(`.word-token :is(rt, .rt-an).pinyin-tone--${n}, .word-fit :is(rt, .rt-an).pinyin-tone--${n}, :is(rt, .rt-an).pinyin-tone--${n} { color: var(--tone-${n}); }`);
    }
    expect(css).toMatch(/\.word-fit :is\(rt, \.rt-an\) \{\s*font-size: 0\.5em;\s*color: var\(--primary-light\);/);
    expect(css).toMatch(/\[data-theme="light"\] \{\s*--tone-1:/);
    expect(viewer).toContain("'rt-an', showToneColors && seg.pinyin ? pinyinToneClass(seg.reading) : ''");
    // 단어 카드도 병음 rt에만 합성(pinyin-text와 병행) — 팝업은 카드 단일화(②)로 소멸
    expect(viewer.match(/showToneColors && pinyinToneClass\(seg\.reading\)/g)?.length).toBe(1);
    // 기본 꺼짐(옵트인) — showHanjaKo 선례
    expect(viewerDefaults('Chinese').showToneColors).toBe(false);

  });

  it("일본어는 기존 JP 글꼴과 기본 굵기를 유지한다", () => {
    expect(readerFontFamily('Japanese','sans')).toContain('--font-noto-jp'); expect(layout).toMatch(/Noto_Sans_JP\(\{[^}]*weight: \['400', '500', '700'\]/s);
  });
});
