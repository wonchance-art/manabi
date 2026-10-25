'use client';
// 단어 묶음 preload(LEVEL-LIST-RSC-001) — 문서로 연 첫 그림에만 건다. 서버 그림의 <link rel=preload>가 문서 머리에서 JS와 나란히 받게 하고,
// 앱 안에서 옮겨 올 때(책장 타일 · 다음 레벨)는 걸지 않는다 — 그때는 누르는 순간 시작한 받기(warmLevelWords)나 화면의 받기가 이미 있어,
// 머리에 새로 꽂힌 preload가 같은 묶음을 한 번 더 받았다(합성 계정 실측: 탭 한 번에 198.8 KB × 2).
// 붙는 동안(hydration)은 서버가 그린 같은 link가 머리에 있으므로 그대로 그려 맞춘다. 없으면 = 문서가 아니라 앱 안 이동이다.
// 낮은 우선순위 — 앱 JS(async 스크립트 = 낮음)보다 먼저 대역을 차지하지 않게(높음이면 모바일 붙는 시각이 늦었다). 묶음은 붙은 뒤에야 쓴다.
const ATTRS = { rel: 'preload', as: 'fetch', crossOrigin: 'anonymous', fetchPriority: 'low' };

export default function LevelWordsPreload({ href }) {
  if (typeof document !== 'undefined' && !document.head.querySelector(`link[rel="preload"][href="${CSS.escape(href)}"]`)) return null;
  return <link {...ATTRS} href={href} />;
}
