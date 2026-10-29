import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

// 계약(#1323 이식): 뷰어 단어 토큰 안에서 버튼이 role=button 요소에 중첩되지 않는다.
// 문장 지정 막대(.line-pick <button>)가 role=button인 .word-token 안에 있으면 버튼 안의
// 버튼이 되어 키보드·보조기기에서 제 의미를 잃고, 막대의 Enter가 바깥으로 새어 단어
// 카드를 열었다. 단어 조작은 .surface가 맡고 막대는 그 형제로 둔다.
// ViewerPage는 실렌더가 무거워(전역 데이터·라우터) 원문 구조로 지킨다 — 실클릭·초점 동작은 e2e(viewer-focus-move 등)가 담당한다.
// 분석된 낱말 마크업은 ReaderToken(memo, VIEWER-TAP-PERF-001)으로 옮겼고, 분석 실패 칸은 뷰어 renderToken에 남는다.
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('뷰어 단어 토큰 — 중첩 대화형 요소 금지', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  const renderToken = sliceBetween(viewer, 'const renderToken = (', 'if (showRaw) {');
  const token = read('src/components/viewer/ReaderToken.jsx');
  const body = sliceBetween(token, 'function ReaderToken({', '\n}\n');
  const linePick = sliceBetween(body, 'const linePick = lineHeadText != null ? (', ') : null;');
  const wordAction = sliceBetween(body, 'const wordAction = !opensWordCard(token) ? {} : {', '};') // 문장부호는 버튼 역할 없음(뷰어 점검 2026-10-23);
  // 정상 토큰의 바깥 틀 = 여는 <div ref=부터 첫 자식 {linePick} 직전까지(속성 전부).
  const normal = sliceBetween(body, 'return (', '\n  );');
  const outerTag = sliceBetween(normal, '<div ref=', '{linePick}');
  // 막대 자리 뒤 ~ 바깥 틀 닫힘 = 단어 조작(.surface) 두 갈래.
  const afterPick = sliceBetween(normal, '{linePick}', '</div>').slice('{linePick}'.length);

  it('문장 지정 막대는 <button>이고 스스로 role을 덮지 않는다(낱말 칸 · 실패 칸 둘 다)', () => {
    for (const pick of [linePick, sliceBetween(renderToken, 'const linePick = lineHead ? (', ') : null;')]) {
      expect(pick).toContain('<button');
      expect(pick).toContain('className="line-pick"');
      expect(pick).not.toMatch(/role=/);
    }
  });

  it('바깥 .word-token 틀은 role·tabIndex·키 처리를 갖지 않는다(막대를 감싸는 대화형 요소 금지)', () => {
    expect(outerTag).toContain('className={className}');
    expect(renderToken).toContain('className={`word-token ');
    expect(outerTag).not.toMatch(/\brole\b|tabIndex|onKeyDown|wordAction/);
    // 마우스 탭은 루비 여백까지 받도록 바깥에 남는다 — 키보드 경로만 .surface로 옮겼다.
    expect(outerTag).toContain('onClick={() => onTokenClick(token, tokenId)}');
  });

  it('단어 조작(role=button)은 .surface에만 있고 막대는 그 형제다', () => {
    expect(wordAction).toContain("role: 'button'");
    expect(wordAction).toContain('tabIndex: 0');
    expect(wordAction).toContain('onTokenClick(token, tokenId)');
    // 키 처리가 바깥 onClick으로 한 번 더 번지지 않게 막는다.
    expect(wordAction).toContain('e.stopPropagation()');
    // 루비 유무 두 갈래 모두 .surface가 조작을 받는다.
    const surfaces = afterPick.match(/<span className=\{?[`"]surface[^>]*>/g) ?? [];
    expect(surfaces).toHaveLength(2);
    for (const tag of surfaces) expect(tag).toContain('{...wordAction}');
    // .surface 안쪽(막대 뒤)에는 버튼·막대가 다시 들어오지 않는다.
    expect(afterPick).not.toMatch(/<button|linePick|role=/);
  });

  it('어디에도 role="button" 리터럴로 막대를 감싸는 요소가 없다', () => {
    expect(renderToken).not.toContain('role="button"');
    expect(token).not.toContain('role="button"');
    expect(body.match(/role: 'button'/g)).toHaveLength(1);
    expect(renderToken).not.toMatch(/role: 'button'/);
  });

  it('분석 실패 토큰은 단어 조작 없이 막대만 둔다', () => {
    const failed = sliceBetween(renderToken, 'if (token.failed) {', 'const {isSaved');
    expect(failed).toContain('{linePick}');
    expect(failed).not.toMatch(/\brole\b|tabIndex|wordAction/);
  });

  it('카드·문장 막대를 닫으면 초점은 단어 조작(.surface[role=button])으로 돌아간다', () => {
    const target = sliceBetween(viewer, 'const tokenFocusTarget = ', ';\n');
    expect(target).toContain(`'.surface[role="button"]'`);
    expect(target).toContain(`'.line-pick'`); // 실패 토큰(조작 없음)은 줄 머리 막대로
    const close = sliceBetween(viewer, 'const closeWordCard = () => {', '\n  };');
    expect(close).toMatch(/tokenFocusTarget\(selectedToken\?\.id\?tokenRefs\.current\[selectedToken\.id\]:null\)/);
    expect(close).toContain('trigger?.focus({preventScroll:true})');
    const closeBar = sliceBetween(viewer, 'const closeMoveBar = () => {', '\n  };');
    expect(closeBar).toContain('tokenFocusTarget(');
  });
});
