// 뷰어 낱말 탭 성능(VIEWER-TAP-PERF-001, 2026-10-17 KST). 낱말을 누를 때마다 뷰어 전체가 다시 그려지며 본문 낱말 360개 ·
// host 약 1,330개를 모두 다시 만들었다(합성 자료 40줄, React 커밋 실측). 본문 낱말을 memo 칸(ReaderToken)으로 옮기고,
// 칸에 넘기는 함수를 고정해 바뀐 낱말만 다시 그린다. 마크업은 그대로다 — 아래는 그 구조 보장.
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import ReaderToken, { readerTokenPropsEqual, sameStyle } from '../../components/viewer/ReaderToken';

const read = (f) => fs.readFileSync(f, 'utf8');
const base = () => ({
  tokenId: 'id_0_2', token: { text: '駅', furigana: 'えき', base_form: '駅', meaning: '역', pos: '명사' }, className: 'word-token  ', selected: false,
  paceStyle: undefined, tokenRefs: { current: {} }, lineHeadText: null, lineHeadRawIdx: null, linePickLabel: '문장 전체 분석',
  onLinePick: () => {}, onTokenClick: () => {}, pronDisplay: 'all', isKnown: false, isSaved: false, patternMark: false, zhGrid: false, showToneColors: false,
});

describe('memo 비교(readerTokenPropsEqual)', () => {
  it('기본 내보내기는 이 비교를 쓰는 memo 칸이다', () => {
    expect(ReaderToken.$$typeof).toBe(Symbol.for('react.memo'));
    expect(ReaderToken.compare).toBe(readerTokenPropsEqual);
  });
  it('같은 props면 다시 그리지 않는다 — 진행 선 스타일은 값이 같으면 새 객체여도 같다', () => {
    const a = base();
    expect(readerTokenPropsEqual(a, { ...a })).toBe(true);
    expect(readerTokenPropsEqual({ ...a, paceStyle: { '--pace-from': 0.2, '--pace-to': 0.5 } }, { ...a, paceStyle: { '--pace-from': 0.2, '--pace-to': 0.5 } })).toBe(true);
  });
  it('보이는 것이 바뀌면 다시 그린다 — 고름 · 클래스 · 진행 구간 · 발음 가림 입력 · 막대', () => {
    const a = base();
    for (const change of [{ selected: true }, { className: 'word-token word-token--saved ' }, { paceStyle: { '--pace-from': 0.1 } },
      { isKnown: true }, { pronDisplay: 'none' }, { lineHeadText: '駅で待つ' }, { patternMark: true }, { token: { ...a.token } }, { onTokenClick: () => {} }]) {
      expect(readerTokenPropsEqual(a, { ...a, ...change })).toBe(false);
    }
    expect(sameStyle(undefined, undefined)).toBe(true);
    expect(sameStyle({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('마크업 — 뷰어가 직접 그리던 것과 같다', () => {
  it('루비 낱말: 바깥 틀(data-* · 고름) · 단어 조작은 .surface · 요미 칸', () => {
    const html = renderToStaticMarkup(createElement(ReaderToken, { ...base(), selected: true, className: 'word-token word-token--saved ' }));
    expect(html).toBe('<div data-tid="id_0_2" data-source-token="id_0_2" data-source-text="駅" data-text="駅" data-selected="true" class="word-token word-token--saved ">'
      + '<span class="surface" role="button" tabindex="0"><ruby data-yomi="1">駅<span class="rt-an">えき</span></ruby></span></div>');
  });
  it('줄 머리 막대 · 발음 가림 · 문형 밑줄', () => {
    const html = renderToStaticMarkup(createElement(ReaderToken, { ...base(), lineHeadText: '駅で待つ', lineHeadRawIdx: 0, pronDisplay: 'unknown', isKnown: true, patternMark: true }));
    expect(html).toContain('<button class="line-pick" aria-label="문장 전체 분석" title="문장 전체 분석"></button><span class="surface surface--furi-off" role="button" tabindex="0">');
    expect(html).toContain('<span class="pattern-mark" aria-hidden="true"></span></span></div>');
  });
  it('来 | ない — 바로 뒤 토큰 표기(nextText)로 こ를 고른다(뷰어 본문과 같은 splitRuby 인자)', () => {
    const html = renderToStaticMarkup(createElement(ReaderToken, { ...base(), token: { text: '来', furigana: 'くる', base_form: '来る', pos: '동사' }, nextText: 'ない' }));
    expect(html).toContain('<ruby data-yomi="1">来<span class="rt-an">こ</span></ruby>');
  });
  it('읽기 없는 낱말은 루비 없이 글자 그대로', () => {
    const html = renderToStaticMarkup(createElement(ReaderToken, { ...base(), token: { text: 'で', furigana: '', base_form: 'で', pos: '조사' } }));
    expect(html).toContain('<span class="surface" role="button" tabindex="0">で</span>');
  });
});

describe('배선 — 뷰어가 낱말 칸에 고정 함수만 넘긴다', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  it('고정 함수는 ref로 이번 렌더의 동작을 부른다(useCallback 의존 0)', () => {
    expect(viewer).toContain('const onReaderTokenClick = useCallback((token, tokenId) => tokenClickRef.current?.(token, tokenId), []);');
    expect(viewer).toContain('const onReaderLinePick = useCallback((lineHead) => linePickRef.current?.(lineHead), []);');
    expect(viewer).toContain('tokenClickRef.current = handleTokenClick;');
    expect(viewer).toContain('linePickRef.current = (lineHead) => {');
    // 훅은 이른 return(불러오는 중 화면)보다 앞이다.
    expect(viewer.indexOf('const onReaderTokenClick = useCallback(')).toBeLessThan(viewer.indexOf('if (isLoading) return <div className="page-container">'));
  });
  it('<ReaderToken>에 그 자리에서 만든 함수 · JSX를 넘기지 않는다(memo가 깨지지 않게)', () => {
    const tag = sliceBetween(viewer, '<ReaderToken key={tokenId}', '/>');
    expect(tag).toContain('onLinePick={onReaderLinePick} onTokenClick={onReaderTokenClick}');
    expect(tag).not.toMatch(/=>|=\{\(|=\{</);
  });
});
