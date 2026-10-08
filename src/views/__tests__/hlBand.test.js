import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

/**
 * 계약: 하이라이트 글자 밴드 (오너 확정 2026-08-29 — 시연 아티팩트 3라운드).
 * ① 상태·저장·복습·지정의 모든 면 칠은 .surface 직접 배경이 아니라 ::before 밴드가 진다.
 *    밴드 세로 범위(0.58~1.62em)는 잉크 실측값 — 병음 잉크(0.32~0.50em)와 안 겹치고
 *    한자 잉크(0.58~1.54em)를 온전히 덮는다. .surface line-height(2.2)를 바꾸면
 *    rt-an bottom 비율(pinyinRuby 계약)과 함께 이 값도 다시 재야 한다.
 * ② 지정 중 상태는 혼색(T1) — 상태가 끝까지 '배경'이라는 한 언어로 살아야
 *    지정 전이에서 눈이 놓치지 않는다(색 크로스페이드). 형태는 안 A(2026-09-02) 이후
 *    낱개 지정에서 불변 — 알약 문법이 공통이라 색만 넘어간다(08-29 원래 계약 성립).
 * ②b 알약(오너 확정 2026-08-30 — 모서리 5px·좌우 확장 없음)은 기반 ::before의 공통
 *    문법이다(안 A). --hl 전용 오버라이드는 죽은 규칙이라 없다. 상태를 밴드(±1px·각형)로
 *    올리는 반대 방향은 배제 — 인접 하이라이트 단어가 이어져 보인다(밴드 트랙 회귀 실측).
 *    연속 지정 구간의 안쪽 모서리·이음매 계약은 pickedBandGrammar.test.js.
 * ③ 문장 막대(line-pick) 시각도 같은 변수(--hl-band-*)를 공유한다(히트 영역은 불변).
 */
describe('하이라이트 글자 밴드 (index.css)', () => {
  it('밴드 변수 — 잉크 실측 확정값(0.58em/1.04em)이 reader-area에 정의된다', () => {
    expect(css).toMatch(/\.reader-area \{[^}]*--hl-band-top: 0\.58em;\s*--hl-band-h: 1\.04em;/s);
  });

  it('surface는 inline-block 기준 상자 + 스택 문맥 — 밴드 절대배치가 2.2em 상자 기준이 된다', () => {
    const block = css.match(/\.word-token \.surface \{[^}]*\}/s)?.[0] || '';
    expect(block).toMatch(/line-height: 2\.2;/); // pinyinRuby 계약과 같은 값 공유
    expect(block).toContain('display: inline-block');
    expect(block).toContain('position: relative');
    expect(block).toContain('z-index: 0');
  });

  it('기반 밴드 ::before — 변수 기하·글자 뒤(z:-1)·색 전이 0.18s', () => {
    const block = css.match(/\.word-token \.surface::before \{[^}]*\}/s)?.[0] || '';
    expect(block).toContain('z-index: -1');
    expect(block).toContain('top: var(--hl-band-top)');
    expect(block).toContain('height: var(--hl-band-h)');
    expect(block).toContain('transition: background-color 0.18s ease');
    expect(css).toMatch(/prefers-reduced-motion[^}]*\{\s*\.word-token \.surface::before \{ transition: none; \}/s);
  });

  it('surface 직접 면 칠 소멸 — 상태·지정 계열 .surface 블록에 background가 없다', () => {
    const surfaceBlocks = [...css.matchAll(/\.(?:word-token--|reader-area--hl )[^{]*\.surface \{[^}]*\}/g)].map((m) => m[0]);
    expect(surfaceBlocks.length).toBeGreaterThan(0);
    for (const b of surfaceBlocks) {
      expect(b).not.toMatch(/background/);
      expect(b).not.toMatch(/border-bottom/); // 밑줄도 밴드(::before)가 진다
    }
  });

  it('상태 하이라이트(B안)·저장 밑줄·복습 펄스가 전부 ::before를 칠한다', () => {
    // 「만난 말」은 새 단어와 같은 표시(VIEWER-R0 버그 11 — 오너 확정 2026-10-07): 옅은 파랑
    // --ws-met(바탕 대비 1.10:1)이 사실상 안 보였다. 클래스·만남 기록은 그대로, 표시만 합친다.
    // AD-R2(VIEWER-V2-ROUNDS-001 §5 — 오너 확정, 08-27 B안 수정): 새 단어·만난 말은 면 칠이 아니라
    // 얇은 파란 밑줄이다. 면 칠(띠)은 학습 중·복습에만 — 첫 자료에서 화면이 파랗게 덮이던 문제.
    expect(css).not.toMatch(/--ws-new:/);
    expect(css).not.toMatch(/:is\(\.word-token--new, \.word-token--met\)[^{]*\.surface::before \{[^}]*background(?:-color)?:/);
    expect(css).toMatch(/\.reader-area--hl \.word-token:is\(\.word-token--new, \.word-token--met\):not\(\[data-selected="true"\]\) \.surface::before \{[^}]*border-bottom: 1\.5px solid var\(--ws-new-ln\);/s);
    expect(css).not.toMatch(/--ws-met/);
    expect(css).toMatch(/\.word-token--saved \.surface::before \{\s*border-bottom: 2px solid var\(--primary-light\);/);
    expect(css).toMatch(/\.word-token--due \.surface::before \{[^}]*animation: due-pulse/s);
  });

  it('새 단어 밑줄은 #1354 「밑줄 자리」를 탄다 — 띠 아래 --hl-mark-gap, 문형이 있으면 둘째 칸, 좌표 신설 0, 선택 중엔 숨김·지정 중엔 유지', () => {
    // AD-R2: 좌표를 새로 만들지 않는다. 저장·복습 밑줄과 같은 content-box·여백·clip 문법이고,
    // 문형 밑줄과 겹치면 저장·복습과 같은 식으로 한 칸 더 내린다(설계서 §4).
    const rule = css.match(/\.reader-area--hl \.word-token:is\(\.word-token--new, \.word-token--met\):not\(\[data-selected="true"\]\) \.surface::before \{[^}]*\}/s)?.[0] || '';
    expect(rule).toContain('box-sizing: content-box;');
    expect(rule).toContain('padding-bottom: var(--hl-mark-gap);');
    expect(rule).toContain('background-clip: content-box;');
    expect(rule).not.toMatch(/background(?:-color)?:/); // 지정 띠(--picked-bg)를 덮지 않는다
    expect(css).toMatch(/\.reader-area--hl \.word-token--pattern:is\(\.word-token--new, \.word-token--met\):not\(\[data-selected="true"\]\) \.surface::before \{\s*padding-bottom: calc\(var\(--hl-mark-gap\) \* 2 \+ 1\.5px\);/);
    // 파일 순서: 상태·지정 규칙 뒤(같은 「밑줄 자리」 블록) — 위로 옮기면 상태 규칙이 이긴다
    expect(css.indexOf('.reader-area--hl .word-token:is(.word-token--new, .word-token--met):not([data-selected="true"]) .surface::before {'))
      .toBeGreaterThan(css.indexOf('.reader-area--hl .word-token--picked.word-token--due .surface::before'));
    // 선택(data-selected — 단어창 열림)에서는 밑줄을 숨긴다: 파란 밑줄 + 파란 테두리 아랫선이 2px 간격으로
    // 붙어 이중 밑줄로 읽혔다(검수 2026-10-07). 상태는 단어창이, 자리는 테두리가 보여 준다. 지정(picked)은
    // 유지 — 밑줄 규칙의 제외는 data-selected 하나뿐이다. 선택 중엔 밑줄이 없으니 테두리를 문형+새 단어
    // 밑줄 아래로 늘리는 규칙도 없다(#1354 기하 그대로 — 문형만 있는 토큰과 같은 테두리).
    expect(css).not.toMatch(/:is\(\.word-token--new, \.word-token--met\)[^{]*:not\(\.word-token--picked\)[^{]*\.surface::before/);
    expect(css).not.toMatch(/\[data-selected="true"\]:is\(\.word-token--new, \.word-token--met\)/);
    const reader = fs.readFileSync(path.join(process.cwd(), 'src/components/viewer/reader-controls.css'), 'utf8');
    expect(reader).not.toMatch(/:is\(\.word-token--new,\.word-token--met\) \{--hl-frame-bottom/);
  });

  it('상태 알약(②b) — 알약 문법(5px·확장 0)은 기반 ::before 공통, --hl 전용 기하 오버라이드 없음', () => {
    const base = css.match(/\.word-token \.surface::before \{[^}]*\}/s)?.[0] || '';
    expect(base).toContain('left: 0;');
    expect(base).toContain('right: 0;');
    expect(base).toContain('border-radius: 5px;');
    // 옛 그룹 오버라이드(4상태 :not(picked)에 left/right/radius) 부활 금지 — 죽은 규칙
    expect(css).not.toMatch(
      /\.reader-area--hl \.word-token--new:not\(\.word-token--picked\) \.surface::before,[\s\S]*?\{[^}]*border-radius/
    );
  });

  it('T1 혼색 — 지정 중 학습 중·복습 밴드가 지정색×상태색 color-mix로 칠해진다(새 단어는 밑줄 유지)', () => {
    for (const [cls, src] of [
      ['saved', '--ws-learn-ln'],
      ['due', '--warning'],
    ]) {
      const re = new RegExp(
        `\\.reader-area--hl \\.word-token--picked\\.word-token--${cls} \\.surface::before \\{[^}]*color-mix\\(in srgb, var\\(${src}\\) \\d+%, var\\(--picked-bg`, 's'
      );
      expect(css).toMatch(re);
    }
    // 새 단어·만난 말(VIEWER-R0 버그 11 한 묶음)은 AD-R2부터 밑줄이라 혼색이 없다 — 지정 중에는
    // 중립 지정 띠 위에 같은 밑줄이 남는다(밑줄 규칙에 :not(picked) 가드 없음).
    expect(css).not.toMatch(/color-mix\(in srgb, var\(--ws-new-ln\)/);
    expect(css).not.toMatch(/\.reader-area--hl \.word-token:is\(\.word-token--new, \.word-token--met\)[^{]*:not\(\.word-token--picked\)[^{]*\.surface::before/);
    // 밑줄 강등 문법(2px dotted)은 폐기 — 부활 금지
    expect(css).not.toMatch(/2px dotted var\(--ws-/);
  });

  it('문장 막대는 글자 잉크 키(--hl-glyph-h) — 버튼 2.2em·top 정렬 기준 절대배치', () => {
    // 막대 세로 = 글자 최대 높이(오너 지시 2026-08-29): 밴드 높이로 두면 글자 아래
    // 여유만큼 단어보다 길쭉해 보인다. 값은 전각 정방 1em(0.58~1.58em) — 잉크 실측
    // 0.96em은 베이스라인 아래로 깊은 글꼴(PingFang)에서 바닥이 짧았다(오너 실기 보고).
    expect(css).toMatch(/\.reader-area \{[^}]*--hl-glyph-h: 1em;/s);
    const bar = css.match(/\.line-pick::before \{[^}]*\}/s)?.[0] || '';
    expect(bar).toContain('top: var(--hl-band-top)');
    expect(bar).toContain('height: var(--hl-glyph-h)');
    // 보정값(transform) 부활 금지 — middle 정렬+실측 보정은 x-height(글꼴) 의존이라
    // 실기(PingFang)에서 어긋났다(오너 보고 2026-08-29). 2.2em·top 버튼 기준 절대배치가 정답.
    expect(bar).not.toContain('transform');
    const btn = css.match(/\.line-pick \{[^}]*\}/s)?.[0] || '';
    expect(btn).toContain('height: 2.2em');
    expect(btn).toContain('vertical-align: top');
    expect(btn).not.toContain('transform');
  });

  it('밴드 좌우 확장 0 — 비지정 인접 간격은 자간 4px 전체(±1px 밴드 문법 부활 금지)', () => {
    const base = css.match(/\.word-token \.surface::before \{[^}]*\}/s)?.[0] || '';
    expect(base).toContain('left: 0;');
    expect(base).toContain('right: 0;');
    expect(base).not.toMatch(/left: -1px|right: -1px/);
  });
});
