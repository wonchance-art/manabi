import { preload } from 'react-dom';
// 배움(/home) 한글 하위 집합(HOME-KR-SUBSET-001) — 셸 · HomePage · 배움 부품 · 푸터 글자(213자 · 약 28KB). 교재 제목 같은 데이터 글자는 원래 조각으로 넘어간다.
import './krHomeSubset.css';
import subset from './subset-home.json';

/**
 * 배움 레이아웃이 부른다. 페이지 전체 한글이 107자뿐인데 Noto Sans KR 조각 12개 · 200KB를 받았다(운영 실측 2026-11-08 KST) — 6개 · 114KB로 준다.
 * 미리 받는다: 저속에서 조각이 첫 그림 뒤에 오면 소개 문단이 한 줄 줄며 아래가 25px 올라갔다(글꼴 2.5s 지연 실측 CLS 0.024).
 * 미리 받아도 FCP−TTFB는 운영보다 늦지 않았다(같은 출처 앞단 교대 — 폰 1.716 → 1.703s · PC 1.814 → 1.763s).
 */
export function preloadKrHomeSubset() {
  preload(subset.woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
}
