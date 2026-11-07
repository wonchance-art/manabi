import { preload } from 'react-dom';
// 복습실(/vocab) 손님 첫 화면 한글 하위 집합(VOCAB-SUBSET-SMALL-001) — 셸 + 손님 블록 글자만(약 17KB). 목록 밖 글자는 원래 조각으로 넘어간다.
import './krVocabSubset.css';
import subset from './subset-vocab.json';

/**
 * 복습실 레이아웃이 부른다. 손님 안내 문단이 첫 그림에선 시스템 글꼴로 4줄, 조각이 온 뒤 3줄로 줄며 단추 줄이 25px 올라갔다(CLS 0.07,
 * VOCAB-GUEST-CLS-001) — 첫 그림 전에 같은 글꼴이 오게 미리 받는다. 미리 받는 바이트는 렌더 차단 CSS와 대역을 나눠 FCP를 그만큼 늦추므로
 * (뷰어 하위 집합 52KB를 실었을 때 1.6Mbps에서 +0.26s) 첫 화면 글자만 담는다.
 */
export function preloadKrVocabSubset() {
  preload(subset.woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
}
