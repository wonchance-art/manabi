// 앱 전체 QueryClient 기본값(src/app/providers.jsx가 쓴다).
//
// 쓰기(mutation)는 networkMode 'always' — 연결이 끊겨도 바로 시도한다(OFFLINE-SWEEP-001, 2026-10-23 KST 390 실측).
// 라이브러리 기본값 'online'은 브라우저 offline 이벤트 뒤 쓰기를 「멈춤」으로 두고 mutationFn을 부르지 않는다. 이 앱의 쓰기는
// 끊김을 스스로 다룬다 — 복습은 정본(recordReviewCompleted)이 기기 보관함(reviewOutbox)에 채점 시각과 함께 담고, 나머지는 실패를
// 알리고 낙관 반영을 되돌린다. 멈춤이 그 처리를 건너뛰었다:
//   · 뷰어 안 복습: 「저장 중…」이 끊긴 동안 그대로, 보관함 0건 → 다시 연결되면 연결된 시각으로 기록(채점 시각 유실),
//     연결 전에 탭을 닫으면 채점이 사라졌다.
//   · 아는 단어: 화면은 「✓ 아는 단어」(낙관)인데 요청은 나가지 않았고 네 등급 버튼이 잠겼다 → 탭을 닫으면 알림 없이 사라졌다.
// 조회(query)는 기본값 그대로 둔다 — 끊긴 채 화면을 옮기면 Next가 문서 이동으로 바꿔 새 문서에서 조회가 다시 시작된다(같은 실측).
export const QUERY_CLIENT_DEFAULTS = Object.freeze({
  queries: Object.freeze({ staleTime: 1000 * 60 * 2, retry: 1 }),
  mutations: Object.freeze({ networkMode: 'always' }),
});
