import AuthPage from '@/views/AuthPage';

// 메일 링크 · 로그인 실패로 오는 /auth?mode=reset · ?error=… 의 판(ROUTE-AUDIT-2 P1). middleware가 질의를 둔 채 이 경로로
// 고쳐 쓴다 — 주소창은 /auth 그대로다. 첫 그림을 마운트 뒤로 미뤄 정적 로그인 폼이 재설정 · 오류 화면으로 바뀌며 깜빡이지 않게 한다.
export const metadata = {
  title: '로그인',
  robots: { index: false },
};

export default function Page() {
  return <AuthPage deferred />;
}
