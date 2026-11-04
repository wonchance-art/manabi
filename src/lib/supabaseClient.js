// Supabase browser client implementation.
// Keep this module behind src/lib/supabase.js so the SDK is not part of the
// synchronous app shell. The first auth/data/realtime operation loads it once.
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_PUBLIC_KEY_NAMES, supabasePublicKey } from './supabaseKeys';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = supabasePublicKey();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(`Missing NEXT_PUBLIC_SUPABASE_URL or ${SUPABASE_PUBLIC_KEY_NAMES} environment variables. Copy .env.example to .env.local and fill in the values.`);
}

// db.retry: false — postgrest-js 2.102부터 GET은 네트워크 오류 · 503 · 520에 1 · 2 · 4초 백오프로 3번 더 묻는다(기본 켜짐).
// 이 앱의 오프라인 폴백(뷰어 · 서재 · 복습의 기기 캐시 읽기)은 조회 실패를 바로 받아야 해서, 판 올림 전(2.100)처럼 끈다(SUPA-SSR-0127 —
// 끊긴 Supabase에서 뷰어 오류 화면이 15초 안에 나오지 않던 account-boundary ⑥ 실측). 재시도를 켜는 것은 별도 결정.
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, { db: { retry: false } });
