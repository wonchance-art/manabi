import { preload } from 'react-dom';
// 뷰어 첫 화면 UI 한글 하위 집합(KR-VIEWER-SUBSET-001) — Noto Sans KR 조각 대신 한 파일(약 50KB). 목록 밖 글자는 원래 조각으로 넘어간다.
import './krViewerSubset.css';
import subset from './subset.json';

/**
 * 뷰어 레이아웃이 부른다. CSS는 이 모듈을 불러오는 것만으로 실리고, 글꼴은 첫 그림 전에 오게 미리 받는다.
 * 미리 받지 않으면 첫 그림의 한글이 시스템 글꼴(대체 「Noto Sans KR Fallback」 = Arial에는 한글이 없다)로 그려졌다가 바뀌며 줄이 다시 흘렀다
 * — 뷰어 상단 막대 4px(CLS 0.0002, #1723). 복습실은 더 작은 제 하위 집합을 쓴다(KrVocabSubset.js).
 */
export function preloadKrUiSubset() {
  preload(subset.woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
}
