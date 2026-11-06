// 서버 오류 기록(ERROR-OBSERVE-001) — Next 15 onRequestError. Vercel Hobby 런타임 로그는 1시간만 남아 오류 화면의 「오류 ID」(digest)를
// 다음 날 찾을 길이 없었다. 렌더 · 라우트 · 서버 액션 오류를 정리된 칸만(errorEvent.js — 쿼리 없는 라우트 틀 · 잘린 메시지 · 스택 앞부분 ·
// digest · 배포 판 · 브라우저 계열) observe.error_events에 30일 남긴다.
// 계약: 요청을 절대 깨뜨리지 않는다 — Node 런타임에서만, 빌드(정적 생성) 중에는 건너뛰고, DB가 느리거나 죽어도 시간 초과 뒤 조용히 끝난다.
// Edge(middleware)는 건너뛴다 — 서비스 키 · supabase-js를 Edge 번들에 싣지 않는다.

export function register() {}

export async function onRequestError(error, request, context) {
  try {
    // Next 문서의 모양 그대로(if 안의 동적 import) — Edge 빌드는 NEXT_RUNTIME이 'edge'로 굳어 이 가지째 빠진다(조기 return 모양은 남았다, 빌드 실측).
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
      const { recordErrorEvent, serverErrorEvent } = await import('./lib/server/errorEvents');
      const event = serverErrorEvent(error, request, context);
      if (event) await recordErrorEvent(event);
    }
  } catch {
    // 기록 실패는 버린다 — 원래 오류 처리(오류 화면 · 500)는 Next가 그대로 한다.
  }
}
