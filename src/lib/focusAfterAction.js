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
