// 레벨별 문형 목록(LEVEL-LIST-AJ-001) — 예전 레퍼런스 본문은 관리자 보관함(src/views/legacy/LegacyReferenceRoutes.jsx)으로 옮겼다.
import { levelListRoute } from '@/views/levelListRoute';
import LevelListPage from '@/views/LevelListPage';

const route = levelListRoute('japanese', 'bunkei', LevelListPage);
export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
