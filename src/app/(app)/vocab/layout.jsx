import ScFontScope from '@/components/fonts/ScFontScope';
import { PRIVATE_METADATA } from '@/lib/seo';
import { preloadKrVocabSubset } from '@/components/fonts/kr-viewer/KrVocabSubset';

// 계정 · 학습 기록 화면 — 검색에 싣지 않는다(LAUNCH-META-001 · robots.txt도 막는다).
export const metadata = PRIVATE_METADATA;

// 중국어(자료 · 단어 · 표지 글자)를 그릴 수 있는 화면 — Noto Sans SC는 이런 세그먼트에서만 싣는다(src/components/fonts/ScFontScope.jsx).
// 손님 첫 화면 UI 한글은 복습실 하위 집합 한 파일(약 17KB)로 미리 받는다(VOCAB-GUEST-CLS-001 · VOCAB-SUBSET-SMALL-001) — 손님 안내 문단이
// 첫 그림에선 시스템 글꼴로 4줄, Noto Sans KR 조각이 온 뒤 3줄로 줄며 단추 줄이 25px 올라갔다(운영 실측 CLS 0.07). 하이드레이션 뒤 그림(3줄)이
// 정답이고, 첫 그림이 같은 글꼴로 그려지게 한다. 뷰어 하위 집합(52KB)을 쓰면 FCP가 +0.26s 늦었다(1.6Mbps 교대 실측).
export default function Layout({ children }) {
  preloadKrVocabSubset();
  return <ScFontScope>{children}</ScFontScope>;
}
