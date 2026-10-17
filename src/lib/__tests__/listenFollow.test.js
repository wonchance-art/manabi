import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliceBetween } from './helpers/sliceBetween.js';
import { listenSentenceLines, listenSentenceRanges, listenSentenceTokens, splitListenSentences } from '../listenFollow';

// 듣기 따라가기(뷰어 기능 감사 목업 6 · 1단계, 2026-10-17 KST) + 리뷰(a775) 차단 2 · 비차단 3 반영.
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const viewer = () => read('src/views/ViewerPage.jsx');
const handler = () => sliceBetween(viewer(), 'const handleListenSentence = useCallback((index) => {', '}, [listenRanges, listenLineTokens, listenFollowable, tokenRefs]);');

describe('듣기 문장 → 원문 자리 → 토큰(문장 단위)', () => {
  it('나누기 규칙은 듣기와 같다 — 줄바꿈 묶음은 공백 하나, 문장부호 뒤에서', () => {
    expect(splitListenSentences('私は学生です。田中さんは先生です。\n\nこれは本です。')).toEqual(['私は学生です。', '田中さんは先生です。', 'これは本です。']);
    expect(splitListenSentences('')).toEqual([]);
  });
  it('한 줄에 문장이 여럿이면 줄 안 글자 구간(공백 제외)으로 나눈다 · 줄을 넘는 문장은 두 조각', () => {
    const raw = '私は学生です。田中さんは 先生です。\n\nこれは本です。\n見出し\nあれは時計です。';
    expect(listenSentenceRanges(raw)).toEqual([
      [{ line: 0, from: 0, to: 7 }],
      [{ line: 0, from: 7, to: 17 }],
      [{ line: 2, from: 0, to: 7 }],
      [{ line: 3, from: 0, to: 3 }, { line: 4, from: 0, to: 8 }],
    ]);
    expect(listenSentenceLines(raw)).toEqual([0, 0, 2, 3]);
    expect(listenSentenceLines('はい。\nはい。\nいいえ。')).toEqual([0, 1, 2]);
  });
  it('문장 구간과 겹치는 토큰만 — 같은 줄의 다른 문장 토큰은 고르지 않는다', () => {
    const line0 = [['a', '私'], ['b', 'は'], ['c', '学生'], ['d', 'です'], ['e', '。'], ['f', '田中'], ['g', 'さん'], ['h', 'は'], ['i', '先生'], ['j', 'です'], ['k', '。']]
      .map(([id, text]) => ({ id, text }));
    const ranges = listenSentenceRanges('私は学生です。田中さんは 先生です。');
    const of = line => (line === 0 ? line0 : []);
    expect(listenSentenceTokens(ranges[0], of)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(listenSentenceTokens(ranges[1], of)).toEqual(['f', 'g', 'h', 'i', 'j', 'k']);
    expect(listenSentenceTokens(null, of)).toEqual([]);
  });
});

describe('뷰어 배선', () => {
  it('제외 판정 — 쪽 넘김 · 분석 안 된 줄 0 · 낡은 분석 아님일 때만', () => {
    expect(viewer()).toContain('const listenFollowable = pagedActive && !isStaleAnalysis && missingLineCount === 0 && sentences.length > 0;');
    expect(handler()).toContain('if (!listenFollowable || listenFollowOff.current) { setListenTokens(null); return; }');
  });
  it('문장 단위 — 줄 토큰 표에서 그 문장 토큰만 골라 강조하고, 첫 토큰의 쪽으로', () => {
    const h = handler();
    expect(h).toContain('const ids = listenSentenceTokens(listenRanges[index], line => listenLineTokens.get(line));');
    expect(h).toContain('const el = ids.length ? tokenRefs.current[ids[0]] : null;');
    expect(h).toContain('if (paged.reveal(el, { auto: true })) setListenTokens(new Set(ids));');
    expect(h).not.toContain('user: true');
  });
  it('시트 · 범위 지정 · 키 차단 · 누르는 중에는 옮기지 않고 따라가기를 멈춘다 — 판정은 pager(reveal auto · canAutoReveal, pagedReader.test)', () => {
    const h = handler();
    expect(h).toContain('else { listenFollowOff.current = true; setListenTokens(null); }');
    expect(viewer()).not.toContain('listenPressing'); // 누르는 중은 pager 안 상태만 쓴다
  });
  it('손으로 넘기면 멈춤 — 문장을 못 이은 동안(listenActive)에도 걸린다', () => {
    expect(sliceBetween(viewer(), 'onUserPage: anchor => {', 'saveScrollPosition(index);'))
      .toContain('if (listenActive.current) { listenFollowOff.current = true; setListenTokens(null); }');
    expect(handler()).toContain('listenActive.current = true;');
  });
  it('강조는 고른 문장 띠와 다른 밑줄(.word-token--listening) — 문장 지정(isPicked)에 섞지 않는다', () => {
    expect(viewer()).toContain("${listenTokens?.has(tokenId) ? ' word-token--listening' : ''}");
    expect(viewer()).toContain('const isPicked = pickedLineIdx === rawIdx;');
    const css = read('src/index.css');
    expect(sliceBetween(css, '.word-token--listening::after {', '}')).toContain('background: var(--pace-line);');
    expect(css).not.toMatch(/word-token--listening[^{]*\.line-pick/);
  });
  it('ListenControls — 같은 나누기, 문장 시작 때 번호 · 멈추면 null, 음성 오류면 정리', () => {
    const listen = read('src/components/ListenControls.jsx');
    expect(listen).toContain('const sentences = splitListenSentences(text);');
    expect(sliceBetween(listen, 'function speakNext(sessionId) {', 'const utter =')).toContain('onSentenceRef.current?.(i);');
    expect(sliceBetween(listen, 'function stop() {', 'setPlaying(false);')).toContain('onSentenceRef.current?.(null);');
    expect(listen).toContain('utter.onerror = () => { if (sessionRef.current === sessionId) stop(); };');
    expect(viewer()).toContain('onSentence={handleListenSentence}');
  });
});

describe('좁은 폭 듣기 막대 한 줄(390)', () => {
  const css = () => read('src/components/viewer/reader-controls.css');
  const block = () => sliceBetween(css(), '/* 좁은 폭 듣기 막대 한 줄', '\n}\n');
  it('좁은 폭(container reader ≤460px)에서만 — 진행 수 · 속도 칩을 숨기고 막대는 한 줄', () => {
    const b = block();
    expect(b).toContain('@container reader (max-width:460px){');
    expect(b).toContain('.manabi-app .viewer-layout .viewer-topbar .listen-controls__panel{flex-wrap:nowrap;gap:0;padding:0 2px}');
    expect(b).toMatch(/\.listen-controls__progress,\s*\.manabi-app \.viewer-layout \.viewer-topbar \.listen-controls__rate\{display:none\}/);
  });
  it('지금 문장 줄은 따라가기 중(쪽 넘김 · 본문 강조)에만 숨긴다 — 스크롤 보기는 그대로', () => {
    expect(block()).toContain('.manabi-app .viewer-layout .viewer-topbar .listen-controls--follow .listen-controls__current{display:none}');
    expect(read('src/components/ListenControls.jsx')).toContain("<div className={followActive ? 'listen-controls listen-controls--follow' : 'listen-controls'}>");
    expect(viewer()).toContain('followActive={listenFollowable}');
  });
  it('아이콘 버튼은 접근 이름을 그대로 가진다(재생 · 일시정지 · 정지)', () => {
    const panel = sliceBetween(read('src/components/ListenControls.jsx'), '<div className="listen-controls__panel">', '<span className="listen-controls__progress">');
    for (const name of ["aria-label={label('재생')}", "aria-label={label('일시정지')}", "aria-label={label('정지')}"]) expect(panel).toContain(name);
  });
});
