// 서버 전용 — Supabase 비밀 키 정본(SUPA-KEYS-001, 오너 승인 — 새 API 키 이전 기간).
// 새 이름(SUPABASE_SECRET_KEY = sb_secret_…)을 먼저, 없으면 옛 이름(SUPABASE_SERVICE_ROLE_KEY = service_role JWT).
// 두 키 모두 RLS를 우회한다. 브라우저 번들에 들어가면 안 된다 — 이 모듈은 src/lib/server/ · src/app/api/ · route
// handler 같은 서버 경로만 가져올 수 있다(계약 supabaseKeys.test.js). NEXT_PUBLIC_ 접두가 없어 Next가 번들에 값을
// 넣지도 않지만, 가져오는 경로 자체를 서버로 묶어 둔다.
//
// 원시 HTTP(fetch)로 보낼 때: 새 키는 JWT가 아니다 — `apikey` 헤더에만 싣고 `Authorization: Bearer <키>`로 보내지 않는다
// (Supabase 이전 문서 — Bearer는 JWT로 해석돼 거절될 수 있다). supabase-js 클라이언트는 알아서 처리한다.
// 직접 읽기는 이 파일만 — 다른 곳의 process.env 직접 접근은 계약이 막는다.

/** 서버 비밀 키 — 새 secret 키 우선, 없으면 legacy service_role 키. 둘 다 없으면 undefined. env는 테스트 주입용. */
export function supabaseSecretKey(env = process.env) {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}
