// 동작 뒤 초점 이어받기(FOCUS-AFTER-ACTION-001, 2026-10-17 KST). 화면 변화는 없다. 누른 버튼이 사라지거나 잠긴 뒤 초점을 다음 컨트롤로
// 옮긴다. 사용자가 이미 다른 곳으로 옮긴 초점은 뺏지 않는다. 판정은 대역(가짜 문서)으로, 배선은 소스 계약으로 검사한다.
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';
import { canTakeFocus, focusIfFree, ignoreHeldKey } from '../focusAfterAction';

const read = (f) => fs.readFileSync(f, 'utf8');

// 대역 — 문서 · 영역(scope) · 버튼. contains는 children 목록으로 흉내 낸다.
function world(active = 'body') {
  const doc = { body: { isConnected: true } };
  const inside = { isConnected: true };
  const outside = { isConnected: true };
  const scope = { contains: (el) => el === inside || el === button };
  const button = { isConnected: true, disabled: false, ownerDocument: doc, focus: vi.fn(() => { doc.activeElement = button; }) };
  doc.activeElement = { body: doc.body, inside, outside, gone: { isConnected: false }, none: null }[active];
  return { doc, scope, button };
}

describe('뺏지 않기 판정(canTakeFocus · focusIfFree)', () => {
  it('body · 없음 · 사라진 요소 · 같은 영역 안이면 옮긴다 — 스크롤 없이', () => {
    for (const active of ['body', 'none', 'gone', 'inside']) {
      const { scope, button } = world(active);
      expect(focusIfFree(button, scope)).toBe(true);
      expect(button.focus).toHaveBeenCalledWith({ preventScroll: true });
    }
  });
  it('영역 밖(검색창 · 다른 패널 · 본문 낱말)에 초점이 있으면 그대로 둔다', () => {
    const { doc, scope, button } = world('outside');
    expect(canTakeFocus(scope, doc)).toBe(false);
    expect(focusIfFree(button, scope)).toBe(false);
    expect(button.focus).not.toHaveBeenCalled();
    // 영역을 모르면 body일 때만 옮긴다.
    expect(focusIfFree(world('inside').button, null)).toBe(false);
    expect(focusIfFree(world('body').button, null)).toBe(true);
  });
  it('대상이 없거나 · 잠겼거나 · 떨어져 나갔으면 아무것도 하지 않는다', () => {
    const { scope, button } = world('body');
    expect(focusIfFree(null, scope)).toBe(false);
    expect(focusIfFree({ ...button, disabled: true }, scope)).toBe(false);
    expect(focusIfFree({ ...button, isConnected: false }, scope)).toBe(false);
    expect(button.focus).not.toHaveBeenCalled();
  });
});

describe('누르고 있는 키(ignoreHeldKey)', () => {
  const key = (k, repeat) => ({ key: k, repeat, preventDefault: vi.fn() });
  it('자동 반복 Enter · Space만 막는다 — 새로 누른 키는 그대로(Enter 답 → Enter 계속)', () => {
    for (const k of ['Enter', ' ']) {
      const held = key(k, true); ignoreHeldKey(held); expect(held.preventDefault).toHaveBeenCalled();
      const fresh = key(k, false); ignoreHeldKey(fresh); expect(fresh.preventDefault).not.toHaveBeenCalled();
    }
    const digit = key('3', true); ignoreHeldKey(digit); expect(digit.preventDefault).not.toHaveBeenCalled();
  });
});

describe('배선 — 세 자리', () => {
  it('C1 읽기 화면: 등급(저장 · 본문 안 복습)이 저장 줄로 바뀌면 줄 자체로 — 버튼(이 문맥 추가 · 아는 단어)이 아니다 · 같은 단어 · 시한 안', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("import { focusIfFree } from '../lib/focusAfterAction';");
    expect(viewer).toMatch(/const SAVED_ROW_FOCUS_MS = 10000;/);
    const hook = sliceBetween(viewer, 'const savedRowFocus = useRef(null);', '// W R3㉮ 인라인 복습');
    expect(hook).toContain('pending.key !== savedRowFocusKey(selectedToken) || Date.now() - pending.at > SAVED_ROW_FOCUS_MS');
    expect(hook).toContain(`'#inspector-word .save-grade__saved[tabindex="-1"]'`);
    expect(hook).not.toMatch(/button/); // 한 번 더 누른 Enter가 문맥 추가 · 아는 단어 표시를 쓰지 않는다
    expect(hook).toContain("focusIfFree(target, target.closest('#inspector-word'))");
    // 훅(useId 포함)은 이른 return(불러오는 중 화면)보다 앞이다 — 훅 순서가 바뀌지 않는다.
    expect(viewer.indexOf('const savedRowId = useId();')).toBeLessThan(viewer.indexOf('if (isLoading) return <div className="page-container">'));
    // 두 등급 경로가 모두 표식을 남긴다.
    expect(sliceBetween(viewer, 'const gradeInline = (rating) => {', 'const handlers = {')).toContain('armSavedRowFocus(selectedToken);');
    expect(sliceBetween(viewer, 'const addToVocab = async (grade) => {', 'const action = ++gradeAction.current;')).toContain('armSavedRowFocus(selectedToken);');
    // 줄 = 묶음(tabIndex -1 · role=group). 이름은 이미 보이는 글(✓ 담은 표현에 있음 · 다음 복습)에서 — 새 문구 없음.
    const row = sliceBetween(viewer, 'word-detail-card__actrow save-grade__saved', '{koreanSaveReady(selectedToken) && <SaveContextButton');
    expect(row).toContain('role="group" tabIndex={-1} aria-labelledby={`${savedRowId}-in${nextReview ? ` ${savedRowId}-next` : \'\'}`}>');
    expect(row).toContain("<button id={`${savedRowId}-in`} disabled className=\"btn btn--ghost btn--sm save-grade__in\">{vt('✓ 담은 표현에 있음')}</button>");
    expect(row).toContain('<span id={`${savedRowId}-next`} className="save-grade__next">');
  });
  it('C2 복습 카드(예전 · 새 일정 둘 다): 잠김 → 풀림 한 번만 채점 막대 자체로 — 「다시」 버튼이 아니다', () => {
    const parts = read('src/components/vocab/ReviewCardParts.jsx');
    const hook = sliceBetween(parts, 'export function useGradeBarFocus(locked, armed) {', '\n}\n');
    expect(hook).toContain('if (locked) { sawLocked.current = true; return; }');
    expect(hook).toContain('if (!armed || !sawLocked.current) return;');
    expect(hook).toContain("focusIfFree(bar.current, bar.current?.closest('.review-room-session'));");
    expect(hook).toContain('}, [locked, armed]);');
    const bar = '<div ref={bar} tabIndex={-1} className={`review-grade-bar';
    const review = sliceBetween(read('src/views/VocabReview.jsx'), 'function ScoreSection(', '\n}\n');
    expect(review).toContain('const bar = useGradeBarFocus(locked, armed);');
    expect(review).toContain(bar + "${locked ? ' is-locked' : ''}`} role=\"group\" aria-label=\"기억 채점\">");
    expect(review).not.toMatch(/<button ref=/); // 초점이 채점 버튼에 앉지 않는다
    const fsrs = read('src/components/vocab/FsrsReviewSession.jsx');
    expect(fsrs).toContain('const bar = useGradeBarFocus(!revealed, armed);');
    expect(fsrs).toContain(bar + "${revealed ? '' : ' is-locked'}`} role=\"group\" aria-label=\"기억 채점\">");
    expect(fsrs).not.toMatch(/<button ref=/);
  });
  it('묶음에 둔 초점은 고리를 그리지 않는다(#main-content 선례) — 안의 버튼은 각자 :focus-visible', () => {
    const css = read('src/components/web/web-shell.css');
    expect(css).toContain('#main-content:focus{outline:none}');
    expect(css).toContain('.review-grade-bar[tabindex="-1"]:focus,.save-grade__saved[tabindex="-1"]:focus{outline:none}');
  });
  it('전역 키(1~4 · Space · ⌘Z)는 묶음에 초점이 있어도 body와 같은 갈래 — 입력칸 판정만 본다', () => {
    // 복습방 두 리스너: 입력 요소(INPUT · TEXTAREA · SELECT · contentEditable)만 거른다 — div 묶음은 body와 같다.
    expect(read('src/views/VocabPage.jsx')).toContain("const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);");
    expect(read('src/components/vocab/FsrsReviewSession.jsx')).toContain("if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || busy) return;");
    // 읽기 화면: 1~4는 카드(.word-detail-card) 안에서, ⌘Z는 .viewer-3col 안(또는 body)에서 받는다 — 저장 줄은 둘 다의 안이다.
    expect(read('src/views/ViewerPage.jsx')).toContain("const inViewer = e.target?.closest?.('.viewer-3col, .toast-container')");
    expect(read('src/lib/viewerReliability.js')).toContain("const card = target?.closest?.('.word-detail-card');");
  });
  it('C3 오늘 학습: 피드백에 들어서면 「계속 →」/「결과 보기 →」로 — 산출 문항 제외 · 세션 화면 영역', () => {
    const study = read('src/views/StudySessionPage.jsx');
    const hook = sliceBetween(study, 'const continueRef = useRef(null);', '}, [phase, item?.uid, item?.type]);');
    expect(hook).toContain("if (phase !== 'feedback' || item?.type === 'produce-writing') return;");
    expect(hook).toContain("focusIfFree(button, button?.closest('.page-container'));");
    const bar = sliceBetween(study, "{phase === 'feedback' && item.type !== 'produce-writing' && (", '</Button>');
    expect(bar).toContain('onKeyDown={ignoreHeldKey}');
    expect(bar).toContain('<Button ref={continueRef} onClick={next}');
    expect(bar).toContain("'결과 보기 →' : '계속 →'");
  });
  it('화면 변화 없음 — 세 자리 모두 클래스 · 문구 · 스타일을 새로 만들지 않는다(초점 고리는 :focus-visible)', () => {
    const lib = read('src/lib/focusAfterAction.js');
    expect(lib).not.toMatch(/className|style|classList/);
    expect(lib).toContain("import { focusIsLost } from './routeFocus';"); // 「초점을 잃었나」 판정은 화면 이동 뒤 되찾기와 하나
  });
});
