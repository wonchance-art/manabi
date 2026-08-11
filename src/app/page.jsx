import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// 랜딩 철거(#957) — 사설 도구에 현관 페이지가 하던 일이 없다:
// 트랙 카드는 교재의 언어 필터, 로그인 안내는 auth·자료실, 푸터는 프로필과 전부 같은 문이었다.
// '/'는 상태에 따라 제 화면으로 보내는 리다이렉트만 남긴다. 세션 판별은 sb-* 쿠키 존재로 충분
// (실검증은 목적지 페이지가 한다 — 위조 쿠키면 /home이 게스트 처리).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const jar = await cookies();
  const hasSession = jar.getAll().some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
  redirect(hasSession ? '/home' : '/lessons');
}
