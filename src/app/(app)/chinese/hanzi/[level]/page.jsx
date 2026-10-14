// 중국어 레벨 화면 「한자」 탭(HANZI-TAB-AL-001) — HSK 1 · 2. 목록은 글자만, 답 카드 표는 화면이 따로 받는다.
import { levelListRoute } from '@/views/levelListRoute';

const route = levelListRoute('chinese', 'hanzi');
export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
