import { preload } from 'react-dom';
// 「함께 읽는 글」(/discover?view=reading) 손님 첫 화면 한글 하위 집합(READING-CHIP-CLS-001) — 셸 · 머리 · 언어 칩 · 빈 상태 · 푸터 글자만. 목록 밖 글자는 원래 조각으로 넘어간다.
import './krReadingSubset.css';
// 목록 글자 묶음(READING-LIST-FONT-001) — 카드 제목 · 꼬리표 · 정렬 · 「더 보기」 글자. 미리 받지 않는다(목록은 첫 그림 뒤에 찬다): 쓰는 글자가 보일 때 한 파일로 온다.
import './krReadingListSubset.css';
import subset from './subset-reading.json';

/**
 * 「함께 읽는 글」 레이아웃이 부른다. 언어 칩이 첫 그림에선 시스템 글꼴(한글 1.0em)로 두 줄이었다가 Noto Sans KR 조각이 4.7s에 온 뒤
 * 0.92em로 줄며 「프랑스어」가 첫 줄로 올라갔다(운영 폰 CLS 0.035) — 첫 그림 전에 같은 글꼴이 오게 미리 받는다.
 */
export function preloadKrReadingSubset() {
  preload(subset.woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
}
