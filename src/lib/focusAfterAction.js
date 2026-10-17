/**
 * 동작 뒤 초점 이어받기(FOCUS-AFTER-ACTION-001). 누른 버튼이 사라지거나 잠긴 자리에서 다음에 누를 컨트롤로 초점을 옮긴다.
 * 이 모듈은 화면을 바꾸지 않는다. 초점 고리는 :focus-visible 규칙이 그린다.
 *
 * 뺏지 않기: 초점이 body(누른 버튼이 사라져 떨어진 자리)에 있거나 같은 영역(scope) 안에 있을 때만 옮긴다.
 * 사용자가 이미 다른 곳(검색창 · 다른 패널)으로 옮겼다면 그대로 둔다.
 * 스크롤: preventScroll로 옮긴다. 고정 채점 막대나 카드 아래쪽으로 화면이 튀지 않게 한다.
 * 「초점을 잃었나」 판정은 화면 이동 뒤 되찾기(routeFocus.focusIsLost)와 같은 것을 쓴다.
 */
import { focusIsLost } from './routeFocus';

export function canTakeFocus(scope, doc = scope?.ownerDocument || globalThis.document) {
  if (focusIsLost(doc)) return true;
  return !!scope && scope.contains(doc.activeElement);
}

/** target에 초점을 옮긴다. 옮겼으면 true. 잠긴 · 떨어진 · 남의 초점이 있는 경우는 false(아무것도 하지 않음). */
export function focusIfFree(target, scope) {
  if (!target || target.disabled || !target.isConnected) return false;
  if (!canTakeFocus(scope, target.ownerDocument)) return false;
  target.focus({ preventScroll: true });
  return target.ownerDocument.activeElement === target;
}

/**
 * 누르고 있는 키의 자동 반복으로 옮겨 온 버튼이 바로 눌리지 않게 막는다.
 * Enter로 답한 뒤 계속 누르고 있으면, 반복 keydown이 새로 초점을 받은 「계속 →」을 누르게 된다.
 * 새로 누른 키(repeat=false)는 그대로 둔다. 키보드로 「Enter 답 → Enter 계속」을 이어 가는 흐름은 남긴다.
 */
export function ignoreHeldKey(event) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
}

/**
 * 어순 배열 — 누른 낱말 칩이 사라진 뒤 초점을 받을 자리(FOCUS-WORD-ORDER-001).
 * root = 그 문항([data-order-root]). zone = 누른 칩이 있던 곳('bank' 남은 칩 줄 · 'line' 놓인 칩 줄), index = 그 줄에서의 순서.
 * 남은 칩을 골랐으면: 같은 자리로 밀려 온 다음 남은 칩(마지막이었으면 그 앞) → 없으면 첫 놓인 칩 → 없으면 「확인」([data-order-confirm]).
 * 놓인 칩을 되돌렸으면: 같은 자리의 다음 놓인 칩 → 없으면 첫 남은 칩 → 없으면 「확인」. 잠긴(disabled) 칩은 건너뛴다.
 * 모두 없으면 null — 답이 끝난 화면은 부모(오늘 학습 「계속 →」)가 초점을 정한다.
 */
export function orderChipTarget(root, zone, index) {
  if (!root) return null;
  const enabled = selector => [...root.querySelectorAll(selector)].filter(el => !el.disabled);
  const bank = enabled('.fr-quiz__tokens .fr-quiz__token'), line = enabled('.fr-quiz__line .fr-quiz__token');
  const [same, other] = zone === 'line' ? [line, bank] : [bank, line];
  return same[Math.min(Math.max(index, 0), same.length - 1)] || other[0] || enabled('[data-order-confirm]')[0] || null;
}

/** 칩을 누른 그 순간의 자리 — 상태가 바뀌어 칩이 사라지기 전에 적는다. root가 없으면(어순 문항 밖) null. */
export function orderChipSpot(chip) {
  const root = chip?.closest?.('[data-order-root]');
  if (!root) return null;
  const row = chip.closest('.fr-quiz__line') ? 'line' : 'bank';
  const siblings = [...chip.parentElement.querySelectorAll('.fr-quiz__token')];
  return { root, zone: row, index: siblings.indexOf(chip) };
}

/**
 * 새 문항의 첫 답 컨트롤(STUDY-FOCUS-001). 「계속 →」이 사라지면 초점이 body로 떨어져, 키보드로는 머리글 메뉴부터 다시
 * 2~12번 Tab을 눌러야 보기에 닿았다(합성 로그인 /study 실측 2026-10-17 KST). 보기 → 어순 칩 → 입력칸 → 그 밖의 버튼 순으로
 * 고르고, 발음 듣기(.fr-speak)처럼 답이 아닌 보조 단추는 건너뛴다. 잠긴(disabled) 것은 고르지 않는다. 없으면 null.
 */
const ANSWER_CONTROLS = ['.fr-quiz__opt', '.fr-quiz__token', 'input[type="text"]', 'textarea', 'button:not(.fr-speak)'];
export function firstAnswerControl(root) {
  if (!root?.querySelectorAll) return null;
  for (const selector of ANSWER_CONTROLS) {
    const found = [...root.querySelectorAll(selector)].find(el => !el.disabled);
    if (found) return found;
  }
  return null;
}
