// 미리 받아 둔 조각은 기다림 없이 그린다(BUNDLE-AUTH-001, 2026-11-08 KST).
// next/dynamic(React.lazy)은 모듈을 이미 받았어도 처음 그릴 때 한 번 멈춘다(약속을 푸는 한 틱). 「복습 시작」 · 다음 문항처럼
// 누른 순간 그리는 화면이 그 한 틱 동안 비고(loading 없으면 가장 가까운 Suspense — 화면 전체 대기 골격까지 올라간다),
// 화면 이동 초점(제목 · 첫 단추)이 빈 자리에서 길을 잃는다. 그래서:
//   warm()이 모듈을 받아 두면 → 그 뒤 처음 그릴 때 실제 컴포넌트를 바로 그린다(멈춤 없음).
//   아직 못 받았으면 → dynamic(로컬 Suspense, loading = 그 자리 대체)으로 그린다 — 유휴 시간 전에 누른 드문 경우만.
// 한 번 그린 자리는 끝까지 같은 컴포넌트 종류를 쓴다(중간에 바꾸면 그 아래 상태가 처음부터 다시 선다).
import { createElement, useState } from 'react';

/**
 * @param {import('react').ComponentType<any>} Lazy  next/dynamic(() => import('…'), { loading })로 만든 컴포넌트(호출부에 import 글자 그대로 — SSR 미리 받기 표)
 * @param {() => Promise<any>} load  같은 모듈의 import()
 * @returns {[import('react').ComponentType<any>, () => Promise<unknown>]} [그릴 컴포넌트, 미리 받기(실패해도 throw 안 함)]
 */
export function warmable(Lazy, load) {
  let Ready = null;
  const warm = () => load().then((m) => { Ready = m?.default || m; return Ready; }, () => null);
  function Warmable(props) {
    const [Component] = useState(() => Ready || Lazy);
    return createElement(Component, props);
  }
  Warmable.displayName = 'Warmable';
  return [Warmable, warm];
}
