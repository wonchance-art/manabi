// Supabase 공개 키 정본(SUPA-KEYS-001, 오너 승인 — 새 API 키 이전 기간). 브라우저 · 서버 · 미들웨어가 같이 쓴다.
// 새 이름(NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_…)을 먼저, 없으면 옛 이름(NEXT_PUBLIC_SUPABASE_ANON_KEY = anon JWT).
// 두 키는 권한이 같다(anon 역할 · RLS 동일) — 이전 기간에는 어느 쪽이 들어와도 같은 동작이다.
//
// 반드시 `process.env.NEXT_PUBLIC_…` 리터럴 멤버 접근으로 읽는다: Next는 빌드 때 그 글자 그대로의 표현만
// 클라이언트 번들에 값으로 바꿔 넣는다(구조 분해 · process.env[name] · env 인자 주입은 브라우저에서 undefined).
// 서버 비밀 키는 여기 두지 않는다 — src/lib/server/supabaseKeys.js(서버 전용, 계약 supabaseKeys.test.js).
// 직접 읽기는 이 파일만 — 다른 곳의 process.env 직접 접근은 계약이 막는다.

/** 공개(브라우저용) 키 — 새 publishable 키 우선, 없으면 legacy anon 키. 둘 다 없으면 undefined. */
export function supabasePublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}

/** 공개 키 안내 문구용 이름 — 설정 누락 메시지가 두 이름을 함께 말하게. */
export const SUPABASE_PUBLIC_KEY_NAMES = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)';
