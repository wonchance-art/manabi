'use client';

// 서버 레이아웃이 세그먼트 자리({children})를 DOM 요소(div 등) 바로 안에 둘 때 그 사이에 끼우는 함수 부품(HYDRATION-SLOT-001, 2026-10-26 KST).
// 화면 · DOM은 그대로다(children만 돌려준다).
//
// 왜: 세그먼트 자리는 RSC에서 OuterLayoutRouter 요소이고, 그 요소는 그 세그먼트의 error.jsx 같은 클라이언트 조각을 가리킨다
// (뷰어: `error: "$10"` → app/(app)/viewer/error-*.js). 하이드레이션이 그 요소에 닿았을 때 조각이 아직 안 받아졌으면 요소가
// lazy로 남아 부모 DOM 요소(div)의 자식 맞추기가 멈춘다(suspend). 조각이 곧 도착하면 React는 그 div를 다시 그리는데(replay),
// Next 15.5 동봉 React(19.2.0-canary-0bdb9206)는 이때 하이드레이션 커서를 div 앞으로 되돌리지 않는다 — div를 그 div의
// 첫 자식(<!--$-->)에 맞추려다 #418(HTML)을 낸다. React 19.3.0이 고쳤다(replaySuspendedUnitOfWork HostComponent의
// popHydrationStateOnInterruptedWork) — Next 15.5.28도 아직 옛 React를 싣는다.
// 함수 부품이 사이에 있으면 멈추고 다시 그리는 단위가 이 부품이 되어(replayFunctionComponent) 커서를 건드리지 않는다.
// 실측(로컬 프로덕션 빌드, korean-learning e2e 반복): 뷰어 TcFontScope div 다시 그리기가 일어난 3회 모두 #418, React 19.3 수정을
// 덧댄 빌드에서는 같은 다시 그리기 2회에 #418 0회.
// 계약: src/app/__tests__/segmentSlotHydration.test.js.
export default function SegmentSlot({ children }) {
  return children;
}
