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
    expect(h).toContain('if (paged.reveal(el, { auto: true })) flushSync(() => setListenTokens(new Set(ids)));');
    expect(h).not.toContain('user: true');
  });
  it('시트 · 범위 지정 · 키 차단 · 누르는 중에는 그 문장 이동만 건너뛴다(멈추지 않음) — 판정은 pager(reveal auto · canAutoReveal, pagedReader.test)', () => {
    const h = handler();
    expect(h).toContain('if (paged.reveal(el, { auto: true })) flushSync(() => setListenTokens(new Set(ids)));\n    else setListenTokens(null);');
    expect(h).not.toContain('listenFollowOff.current = true'); // 멈춤은 사람의 쪽 넘김(onUserPage)에서만
    expect(viewer()).not.toContain('listenPressing'); // 누르는 중은 pager 안 상태만 쓴다
  });
  it('같은 틱 — 핸들러 안에서 이동을 프레임 뒤로 미루지 않는다(2fb97e82)', () => {
    expect(handler()).not.toContain('requestAnimationFrame');
  });
  it('손으로 넘기면 멈춤 — 문장을 못 이은 동안(listenActive)에도 걸린다', () => {
    expect(sliceBetween(viewer(), 'onUserPage: anchor => {', 'saveScrollPosition(index);'))
      .toContain('if (listenActive.current) { listenFollowOff.current = true; setListenTokens(null); setListenStopped(true); }');
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
    // 음성 오류 — 이 세션만 정리(취소 · 끊김은 stop, 실패는 fail = stop + 단어 발음과 같은 안내). 동작 검사는 listenControlsSpeechNotice.test.jsx.
    expect(listen).toContain("utter.onerror = (event) => { if (sessionRef.current === sessionId) { if (speechCanceled(event)) stop(); else fail('failed'); } };");
    expect(sliceBetween(listen, 'function fail(reason) {', '}')).toContain('stop();');
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
  it('지금 문장 줄은 따라가기 화면(쪽 넘김 · 본문 강조)에서 폭과 상관없이 숨긴다(B1) — 스크롤 보기 · 분석 어긋남은 그대로', () => {
    // 넓은 폭에서도 줄 높이가 문장 길이를 따라 머리줄을 71↔222px로 바꿔 문장마다 쪽이 다시 흘렀다(768 · 1024 · 1440 실측 7↔10쪽).
    // 규칙은 좁은 폭 블록 밖(전 폭)에 있어야 한다 — 블록 안으로 돌아가면 넓은 폭이 다시 흐른다.
    const rule = '.manabi-app .viewer-layout .viewer-topbar .listen-controls--follow .listen-controls__current{display:none}';
    expect(block()).not.toContain(rule);
    expect(css().split('\n')).toContain(rule);
    expect(read('src/components/ListenControls.jsx')).toContain("<div className={followActive ? 'listen-controls listen-controls--follow' : 'listen-controls'}>");
    expect(viewer()).toContain('followActive={listenFollowable}');
  });
  it('아이콘 버튼은 접근 이름을 그대로 가진다(재생 · 일시정지 · 정지)', () => {
    const panel = sliceBetween(read('src/components/ListenControls.jsx'), '<div className="listen-controls__panel">', '<span className="listen-controls__progress">');
    for (const name of ["aria-label={label('재생')}", "aria-label={label('일시정지')}", "aria-label={label('정지')}"]) expect(panel).toContain(name);
  });
});

describe('2단계 [지금 문장으로](목업 listen-resume B안)', () => {
  it('시트(옆 · 아래)가 열린 동안은 칩을 숨긴다 — 시트 단어의 쪽을 떠나지 않게; 판정은 자동 이동 가드와 같은 값', () => {
    const v = viewer();
    expect(v).toContain('const pagedSheetOpen = inspectorOpen || (!!selectedToken && isSheetOpen);');
    expect(v).toContain('pagedGuard.current = { dragging: tokenRange.dragging, sheetOpen: pagedSheetOpen, blocked: keyHandlersRef.current.blocked };');
    expect(v).toContain('extra={listenFollowable && listenStopped && !pagedSheetOpen ? (');
  });
  it('멈춘 동안에만 쪽 막대 가운데 칩 — 버튼 모양은 자동 진행 단독 버튼 재사용, 보이는 글자 = 접근 이름(aria-label 없음), 단축키 없음', () => {
    const v = viewer();
    const chip = sliceBetween(v, '{pagedActive&&<PageBar pager={pager} barRef={pageBarRef} tr={vt} extra={listenFollowable && listenStopped && !pagedSheetOpen ? (', ') : null}/>}');
    expect(chip).toContain('className="viewer-pace-float__btn reader-pagebar__resume"');
    expect(chip).toContain("<span>{vt('지금 문장으로')}</span>");
    expect(chip).toContain("title={vt('듣고 있는 문장의 쪽으로 가고 다시 따라가요')}");
    expect(chip).not.toContain('aria-label');
    expect(chip).not.toContain('aria-keyshortcuts');
    expect(read('src/components/viewer/PageBar.jsx')).toContain("{pager.ready ? label(tr, pager) : ''}</span>\n      {extra}");
  });
  it('누르면 따라가기를 다시 켜고 지금 문장 쪽으로(사람 이동 — auto 아님 · 위치 저장 없음) 밑줄', () => {
    const resume = sliceBetween(viewer(), 'const resumeListenFollow = () => {', '\n  };');
    expect(resume).toContain('listenFollowOff.current = false;');
    expect(resume).toContain('setListenStopped(false);');
    expect(resume).toContain('listenSentenceTokens(listenRanges[listenIndex.current], line => listenLineTokens.get(line));');
    expect(resume).toContain('paged.reveal(el);');
    expect(resume).not.toContain('auto: true');
    expect(resume).not.toContain('user: true');
    expect(resume).toContain('flushSync(() => setListenTokens(new Set(ids)));');
  });
  it('멈춤 알림은 막대 밖 polite 상태 한 줄 · 좁은 폭 지금 문장 줄은 멈춘 동안에도 숨김(다시 보이면 칩 · 쪽 막대가 화면 밖) · 3언어 문구', () => {
    const v = viewer();
    expect(v).toContain("{pagedActive&&<span className=\"sr-only\" role=\"status\">{listenFollowable && listenStopped ? vt('따라가기를 멈췄어요') : ''}</span>}");
    expect(v).toContain('followActive={listenFollowable}');
    expect(v).not.toContain('followActive={listenFollowable && !listenStopped}');
    const msgs = read('src/lib/viewerMessages.js');
    for (const k of ["['지금 문장으로','回到当前句','回到目前句']", "['따라가기를 멈췄어요','已停止跟随','已停止跟隨']"]) expect(msgs).toContain(k);
  });
});
