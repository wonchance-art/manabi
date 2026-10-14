// 대화 턴 경로(v2-Z Z-R1 ①, CONVERSATION-V2Z-001 §4) — 대화 모드의 유일한 새 서버 이음새.
// 이 라우트는 인증(로그인 필수)·분당 한도만 맡는다. 하루 한도·교정 상태 머신·분석·낙관 잠금은 runConversationTurn.
// 화면 진입점은 Z-R1 ③에서 붙는다(이 PR은 서버만).
import { requireUser } from '@/lib/server/auth';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';
import { callLLM } from '@/lib/server/llm';
import { analyzeLines, getServerSupabase } from '@/lib/server/analyzeCore';
import { runConversationTurn } from '@/lib/server/conversationTurn';
import { CONVERSATION_RATE } from '@/lib/conversation/turnModel';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const { user } = auth;

  // 분당 20회 — 분석 경로와 다른 통(대화 한 턴이 분석 한도를 깎지 않게).
  const rl = rateLimit(`conv:${getClientKey(request, user.id)}`, CONVERSATION_RATE);
  if (!rl.ok) {
    return Response.json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 });
  }

  try {
    const { status, body: out } = await runConversationTurn({
      userId: user.id,
      body,
      deps: { supabase: getServerSupabase(), callLLM, analyzeLines },
      signal: request.signal,
    });
    return Response.json(out, { status });
  } catch (err) {
    console.error('[api/conversation/turn] error:', err?.message);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
