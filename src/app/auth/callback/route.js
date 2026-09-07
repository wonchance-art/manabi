import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { authReturnPath } from '@/lib/authRedirect';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = authReturnPath(searchParams.get('next'), '/materials');
  const failure = new URL('/auth', origin);
  failure.searchParams.set('error', 'auth_callback_failed');
  failure.searchParams.set('from', next);
  const pendingCookies = [];
  let authenticated = false;

  if (code) {
    try {
      const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      });
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      authenticated = !error;
    } catch {
      // Expired codes and transport failures return to sign-in without exposing
      // a provider error or leaving the user on an unhandled server error page.
    }
  }

  const response = NextResponse.redirect(authenticated ? new URL(next, origin) : failure);
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
