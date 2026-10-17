import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliceBetween } from './helpers/sliceBetween.js';
import { listenSentenceLines, splitListenSentences } from '../listenFollow';

// 듣기 따라가기(뷰어 기능 감사 목업 6 · 1단계, 2026-10-17 KST).
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

describe('듣기 문장 → 원문 줄', () => {
  it('나누기 규칙은 듣기와 같다 — 줄바꿈 묶음은 공백 하나, 문장부호 뒤에서', () => {
    expect(splitListenSentences('私は学生です。田中さんは先生です。\n\nこれは本です。')).toEqual(['私は学生です。', '田中さんは先生です。', 'これは本です。']);
    expect(splitListenSentences('')).toEqual([]);
  });
  it('문장마다 시작 줄 — 한 줄에 여럿 · 빈 줄 건너뜀 · 줄을 넘는 문장은 시작 줄', () => {
    const raw = '私は学生です。田中さんは先生です。\n\nこれは本です。\n見出し\nあれは時計です。';
    expect(splitListenSentences(raw)).toEqual(['私は学生です。', '田中さんは先生です。', 'これは本です。', '見出し あれは時計です。']);
    expect(listenSentenceLines(raw)).toEqual([0, 0, 2, 3]);
  });
  it('같은 문장이 되풀이돼도 앞에서부터 차례로 잇는다', () => {
    expect(listenSentenceLines('はい。\nはい。\nいいえ。')).toEqual([0, 1, 2]);
  });
});

describe('배선', () => {
  it('ListenControls — 같은 나누기를 쓰고, 문장을 시작할 때 번호 · 멈추면 null을 알린다', () => {
    const listen = read('src/components/ListenControls.jsx');
    expect(listen).toContain('const sentences = splitListenSentences(text);');
    expect(listen).not.toContain(".split(/(?<=[。.!?！？])\\s*/)");
    expect(sliceBetween(listen, 'function speakNext(sessionId) {', 'const utter =')).toContain('onSentenceRef.current?.(i);');
    expect(sliceBetween(listen, 'function stop() {', 'setPlaying(false);')).toContain('onSentenceRef.current?.(null);');
  });
  it('뷰어 — 쪽 넘김 · 원문과 분석 일치일 때만, 손으로 넘기면 멈춤, 강조는 기존 문장 띠, 이동은 위치 저장 없이', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('const listenFollowable = pagedActive && !isStaleAnalysis && missingLineCount === 0 && sentences.length > 0;');
    const handler = sliceBetween(viewer, 'const handleListenSentence = useCallback((index) => {', '}, [listenLines, listenFollowable, sentences, tokenRefs]);');
    expect(handler).toContain('listenFollowable && !listenFollowOff.current && line != null');
    expect(handler).toContain('if (el.isConnected && !listenFollowOff.current) paged.reveal(el); });');
    expect(handler).not.toContain('user: true');
    expect(sliceBetween(viewer, 'onUserPage: anchor => {', 'saveScrollPosition(index);'))
      .toContain('if (listenLineRef.current !== null) { listenFollowOff.current = true; listenLineRef.current = null; setListenLine(null); }');
    expect(viewer).toContain('const isPicked = pickedLineIdx === rawIdx || listenLine === rawIdx;');
    expect(viewer).toContain('onSentence={handleListenSentence}');
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
    expect(read('src/views/ViewerPage.jsx')).toContain('followActive={listenFollowable}');
  });
  it('아이콘 버튼은 접근 이름을 그대로 가진다(재생 · 일시정지 · 정지)', () => {
    const panel = sliceBetween(read('src/components/ListenControls.jsx'), '<div className="listen-controls__panel">', '<span className="listen-controls__progress">');
    for (const name of ["aria-label={label('재생')}", "aria-label={label('일시정지')}", "aria-label={label('정지')}"]) expect(panel).toContain(name);
  });
});

