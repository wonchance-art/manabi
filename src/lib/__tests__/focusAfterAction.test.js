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
  it('C1 읽기 화면: 등급(저장 · 본문 안 복습)이 저장 줄로 바뀌면 그 줄의 첫 활성 버튼으로 — 같은 단어 · 시한 안 · 카드 영역', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("import { focusIfFree, ignoreHeldKey } from '../lib/focusAfterAction';");
    expect(viewer).toMatch(/const SAVED_ROW_FOCUS_MS = 10000;/);
    const hook = sliceBetween(viewer, 'const savedRowFocus = useRef(null);', '// W R3㉮ 인라인 복습');
    expect(hook).toContain("pending.key !== savedRowFocusKey(selectedToken) || Date.now() - pending.at > SAVED_ROW_FOCUS_MS");
    expect(hook).toContain("'#inspector-word .save-grade__saved button:not(:disabled)'");
    expect(hook).toContain("focusIfFree(target, target.closest('#inspector-word'))");
    // 훅은 이른 return(불러오는 중 화면)보다 앞이다 — 훅 순서가 바뀌지 않는다.
    expect(viewer.indexOf('const savedRowFocus = useRef(null);')).toBeLessThan(viewer.indexOf('if (isLoading) return <div className="page-container">'));
    // 두 등급 경로가 모두 표식을 남긴다.
    expect(sliceBetween(viewer, 'const gradeInline = (rating) => {', 'const handlers = {')).toContain('armSavedRowFocus(selectedToken);');
    expect(sliceBetween(viewer, 'const addToVocab = async (grade) => {', 'const action = ++gradeAction.current;')).toContain('armSavedRowFocus(selectedToken);');
    expect(sliceBetween(viewer, 'word-detail-card__actrow save-grade__saved', '</div>')).toContain('onKeyDown={ignoreHeldKey}');
  });
  it('C2 복습 카드: 잠김 → 풀림(뒷면 + armed) 한 번만 첫 버튼(다시)으로 — 복습 화면 영역', () => {
    const review = read('src/views/VocabReview.jsx');
    const section = sliceBetween(review, 'function ScoreSection(', '\n}\n');
    expect(section).toContain('if (locked) { sawLocked.current = true; return; }');
    expect(section).toContain('if (!armed || !sawLocked.current) return;');
    expect(section).toContain("focusIfFree(first, first?.closest('.review-room-session'));");
    expect(section).toContain('}, [locked, armed]);');
    expect(section).toMatch(/<button ref=\{firstRef\} onClick=\{\(\) => onScore\(1\)\}/);
    expect(section).toContain('role="group" aria-label="기억 채점" onKeyDown={ignoreHeldKey}');
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
