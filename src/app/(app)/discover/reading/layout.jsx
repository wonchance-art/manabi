import { preloadKrReadingSubset } from '@/components/fonts/kr-viewer/KrReadingSubset';

// 「함께 읽는 글」 손님 첫 화면 UI 한글은 하위 집합 한 파일로 미리 받는다(READING-CHIP-CLS-001) — 언어 칩이 첫 그림에선 시스템 글꼴로 두 줄,
// Noto Sans KR 조각이 온 뒤 한 줄로 줄며 칩이 움직였다(운영 폰 CLS 0.035). 산책 본 화면(ISR)은 이 레이아웃 밖이라 그대로다.
export default function Layout({ children }) {
  preloadKrReadingSubset();
  return children;
}
