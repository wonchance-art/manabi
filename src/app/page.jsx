import { redirect } from 'next/navigation';
import { authCallbackUrl } from '@/lib/authRedirect';

// 랜딩 철거(#957) — 사설 도구에 현관 페이지가 하던 일이 없다:
// 트랙 카드는 교재의 언어 필터, 로그인 안내는 auth·자료실, 푸터는 프로필과 전부 같은 문이었다.
//
// 로그인 여부로 갈리던 분기를 걷어냈다(오너 지시 2026-08-31 "둘 다 /home으로 통일").
// 갈래가 있던 동안 비로그인은 /lessons(교재+피치 카드), 로그인은 /home(대시보드)로 **아예
// 다른 화면**을 봤고, 그것이 "비로그인이면 옛 버전이 뜬다"는 오래된 보고의 정체였다
// (캐시가 아니었다 — 실측: /lessons는 `no-store`라 항상 최신, 판정 근거는 #1077).
// 이제 '/'는 상태와 무관하게 한 곳으로 보내고, 게스트가 볼 내용은 /home이 갖는다.
//
// 단, Supabase는 redirectTo가 허용 목록에 없으면 로그인 결과(?code=…)를 Site URL(`/`)로 보낸다.
// 그대로 /home으로 넘기면 code가 버려져 로그인이 끝나지 않는다(manabi.co.kr 전환 실측 2026-10-11) —
// code·오류는 서버 교환 라우트로 넘긴다. 교환·검증은 /auth/callback이 그대로 맡는다.
//
// 로그인 결과가 없는 '/'는 이 함수까지 오지 않는다 — middleware가 엣지에서 /home으로 보낸다(ROOT-EDGE-REDIRECT-001,
// 함수 호출 · 왕복 제거). 아래 마지막 redirect('/home')는 matcher 밖 경로(예: 질의 없는 직접 호출)를 위한 같은 목적지의 안전판이다.
export default async function Page({ searchParams }) {
  const params = await searchParams;
  const code = typeof params?.code === 'string' ? params.code : '';
  if (code) {
    const callback = new URL(authCallbackUrl('https://manabi.invalid', '/home'));
    callback.searchParams.set('code', code);
    redirect(callback.pathname + callback.search);
  }
  if (typeof params?.error === 'string' || typeof params?.error_description === 'string') {
    const failure = new URL('/auth', 'https://manabi.invalid');
    failure.searchParams.set('error', 'auth_callback_failed');
    failure.searchParams.set('from', '/home');
    redirect(failure.pathname + failure.search);
  }
  redirect('/home');
}
