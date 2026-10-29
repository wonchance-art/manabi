import Link from 'next/link';
import { cookies } from 'next/headers';
import ScFontCookieHint from '@/components/fonts/ScFontCookieHint';
import LazyMaterialsPage from '@/components/web/LazyMaterialsPage';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';

// 「함께 읽는 글」 — 주소는 /discover?view=reading 그대로이고 middleware가 여기로 넘긴다(GUEST-STATIC-001 2단계: 산책 본 화면을 ISR로 굽기 위해
// 쿼리 갈래를 떼었다). 이 화면은 동적이다 — 세션 쿠키(이름만)를 넘겨 로그인 사람의 고르기 줄을 서버 HTML부터 그린다(DISCOVER-CHIP-CLS-001).
// 바로 열어도(/discover/reading) 같은 화면이다.
export const dynamic = 'force-dynamic';
export { metadata } from '../page';
export default async function Page() {
  return <><ScFontCookieHint /><div className="manabi-page"><header className="manabi-page-heading"><div><Link className="manabi-link" href="/discover">← 산책</Link><h1>함께 읽는 글</h1></div><Link className="manabi-link" href="/materials">내 서재</Link></header><LazyMaterialsPage libraryView="public" sessionHint={hasSupabaseSessionInJar(await cookies())}/></div></>;
}
