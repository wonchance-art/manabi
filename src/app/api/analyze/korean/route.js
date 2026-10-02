import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';
import { analyzeKoreanLines, KoreanAnalysisError, validateKoreanRequest } from '@/lib/server/koreanAnalysis';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!/^Bearer\s+\S+$/i.test(authHeader || '')) {
    return Response.json({ error: 'authentication_required' }, { status: 401 });
  }
  try {
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );
    const { data: { user }, error } = await authClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
    if (error || !user) return Response.json({ error: 'authentication_required' }, { status: 401 });
    // 기존 분석과 동일한 사용자 버킷 — 새 endpoint로 할당량을 우회하지 않는다.
    const rl = rateLimit(getClientKey(request, user.id), { limit: 20, windowMs: 60_000 });
    if (!rl.ok) return Response.json({ error: 'rate_limited' }, {
      status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
    });
    let body;
    try { body = await request.json(); }
    catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
    validateKoreanRequest(body);
    const result = await analyzeKoreanLines(body, { signal: request.signal });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof KoreanAnalysisError) {
      return Response.json({ error: error.code }, { status: error.code === 'source_too_large' ? 413 : 400 });
    }
    return Response.json({ error: 'analysis_unavailable' }, { status: 503 });
  }
}
