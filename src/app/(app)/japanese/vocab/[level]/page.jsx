// 레벨별 단어 목록(LEVEL-LIST-AJ-001) — 예전 레퍼런스 본문은 관리자 보관함(src/views/legacy/LegacyReferenceRoutes.jsx)으로 옮겼다.
// JLPT 단어는 HSK와 같은 새 단어 페이지(네 칸 채점 · 한 단어 모드 · 전 레벨 찾기 — 오너 확정 2026-10-19 KST).
import { levelListRoute } from '@/views/levelListRoute';
import JlptWordPage from '@/views/JlptWordPage';

const route = levelListRoute('japanese', 'vocab', JlptWordPage);
export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
