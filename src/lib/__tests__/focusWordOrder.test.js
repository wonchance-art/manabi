// 어순 배열 칩 초점(FOCUS-WORD-ORDER-001, 2026-10-17 KST). 누른 낱말 칩이 사라지면 초점이 body로 떨어졌다(e2e 빌드 실측:
// 고르기 · 되돌리기 모두 BODY). 다음 칩 → 첫 놓인 칩 → 「확인」 순서로 잇는다. 화면 변화 없음, 문항 밖 초점은 뺏지 않는다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';
import { orderChipSpot, orderChipTarget } from '../focusAfterAction';

const read = (f) => fs.readFileSync(f, 'utf8');
const chip = (name, disabled = false) => ({ name, disabled });
// 대역 문항 — 선택자별 목록만 돌려준다.
function root({ bank = [], line = [], confirm = [] } = {}) {
  const lists = { '.fr-quiz__tokens .fr-quiz__token': bank, '.fr-quiz__line .fr-quiz__token': line, '[data-order-confirm]': confirm };
  return { querySelectorAll: (selector) => lists[selector] || [] };
}
const name = (el) => el?.name ?? null;

describe('칩이 사라진 뒤 초점 자리(orderChipTarget)', () => {
  it('남은 칩을 골랐으면 같은 자리로 밀려 온 다음 남은 칩 — 마지막이었으면 그 앞', () => {
    const r = root({ bank: [chip('A'), chip('B')], line: [chip('X')] });
    expect(name(orderChipTarget(r, 'bank', 0))).toBe('A'); // 0번을 골라 A가 0번 자리로 왔다
    expect(name(orderChipTarget(r, 'bank', 1))).toBe('B');
    expect(name(orderChipTarget(r, 'bank', 2))).toBe('B'); // 마지막을 골랐다 → 그 앞
  });
  it('남은 칩이 없으면 첫 놓인 칩, 그것도 없으면 「확인」', () => {
    expect(name(orderChipTarget(root({ line: [chip('X'), chip('Y')], confirm: [chip('확인')] }), 'bank', 0))).toBe('X');
    expect(name(orderChipTarget(root({ confirm: [chip('확인')] }), 'bank', 0))).toBe('확인');
  });
  it('놓인 칩을 되돌렸으면 같은 자리의 다음 놓인 칩 → 첫 남은 칩 → 「확인」', () => {
    expect(name(orderChipTarget(root({ bank: [chip('A')], line: [chip('X'), chip('Y')] }), 'line', 1))).toBe('Y');
    expect(name(orderChipTarget(root({ bank: [chip('A')], line: [] }), 'line', 0))).toBe('A');
    expect(name(orderChipTarget(root({ confirm: [chip('확인')] }), 'line', 0))).toBe('확인');
  });
  it('잠긴 칩 · 잠긴 「확인」은 건너뛰고, 갈 곳이 없으면 null(답이 끝난 화면은 부모가 「계속 →」)', () => {
    expect(name(orderChipTarget(root({ bank: [chip('A', true)], line: [chip('X', true)], confirm: [chip('확인', true)] }), 'bank', 0))).toBeNull();
    expect(name(orderChipTarget(root({ bank: [chip('A', true), chip('B')] }), 'bank', 0))).toBe('B');
    expect(orderChipTarget(null, 'bank', 0)).toBeNull();
  });
});

describe('누른 순간의 자리(orderChipSpot)', () => {
  const make = (inLine) => {
    const siblings = [];
    const parent = { querySelectorAll: () => siblings };
    const r = { id: 'root' };
    const el = { parentElement: parent, closest: (sel) => (sel === '[data-order-root]' ? r : sel === '.fr-quiz__line' ? (inLine ? {} : null) : null) };
    siblings.push({}, el, {});
    return { el, r };
  };
  it('줄(남은 칩 · 놓인 칩)과 그 줄 안 순서를 적는다', () => {
    const bank = make(false);
    expect(orderChipSpot(bank.el)).toEqual({ root: bank.r, zone: 'bank', index: 1 });
    const line = make(true);
    expect(orderChipSpot(line.el)).toEqual({ root: line.r, zone: 'line', index: 1 });
  });
  it('어순 문항 밖이면 null', () => {
    expect(orderChipSpot({ closest: () => null })).toBeNull();
    expect(orderChipSpot(null)).toBeNull();
  });
});

describe('배선 — 오늘 학습 어순 문항 · 연습 엔진 어순 문항', () => {
  const src = read('src/components/ExerciseEnginePrototype.jsx');
  it('공통 훅: 다시 그린 뒤 orderChipTarget으로, 문항 영역 밖 초점은 뺏지 않는다(focusIfFree)', () => {
    const hook = sliceBetween(src, 'function useOrderChipFocus() {', '\n}\n');
    expect(hook).toContain('if (at.root.isConnected) focusIfFree(orderChipTarget(at.root, at.zone, at.index), at.root);');
    expect(hook).toContain('return event => { spot.current = orderChipSpot(event.currentTarget); };');
  });
  it('오늘 학습(StudySessionExercise): 훅은 이른 return보다 앞, 문항 = data-order-root, 고르기 · 되돌리기 모두 자리를 적는다', () => {
    const study = sliceBetween(src, 'function StudySessionExercise({', 'function StandaloneExerciseEngine({');
    expect(study.indexOf('const markChip = useOrderChipFocus();')).toBeGreaterThan(-1);
    expect(study.indexOf('const markChip = useOrderChipFocus();')).toBeLessThan(study.indexOf('if (!question) return null;'));
    expect(study).toContain('<div className="fr-quiz__q" data-order-root="">');
    expect(study).toContain('onClick={event => { markChip(event); onOrderPicksChange?.(current => current.filter((_, index) => index !== position)); }}');
    expect(sliceBetween(study, 'className="fr-quiz__tokens"', '</div>')).toMatch(/if \(isTapLocked\?\.\(\)\) return;\s*markChip\(event\);/);
  });
  it('연습 엔진(StandaloneExerciseEngine): 훅은 이른 return보다 앞, 「확인」 = data-order-confirm', () => {
    const standalone = sliceBetween(src, 'function StandaloneExerciseEngine({', 'export default function ExerciseEnginePrototype');
    expect(standalone.indexOf('const markChip = useOrderChipFocus();')).toBeLessThan(standalone.indexOf('if (normalizedQuestions.length === 0) return null;'));
    expect(standalone).toContain('<div style={{ marginTop: 10 }} data-order-root="">');
    expect((standalone.match(/onClick=\{event => \{ markChip\(event\); setInputs\(/g) || []).length).toBe(2);
    expect(standalone).toMatch(/data-order-confirm=""\s*disabled=\{\(inputs\[question\.id\] \|\| \[\]\)\.length !== question\.tokens\.length\}/);
  });
  it('화면 변화 없음 — 새 클래스 · 문구 · 스타일 없이 data 속성과 초점만', () => {
    const lib = sliceBetween(read('src/lib/focusAfterAction.js'), 'export function orderChipTarget(', '\n}\n');
    expect(lib).not.toMatch(/className|style|classList/);
  });
});
