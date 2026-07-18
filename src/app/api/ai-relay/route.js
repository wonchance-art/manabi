import {
  RelayHttpError,
  createRelaySupabase,
  identifyRelayAgent,
  normalizeOutgoingMessage,
  toRelayMessage,
} from '../../../lib/server/aiRelay.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function failure(error) {
  if (error instanceof RelayHttpError) {
    return json({ error: error.code, message: error.message }, error.status);
  }
  return json({ error: 'relay_unavailable', message: 'AI Relay is temporarily unavailable.' }, 503);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new RelayHttpError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
}

export async function HEAD(request) {
  try {
    identifyRelayAgent(request);
    createRelaySupabase();
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

// GET은 단순 조회가 아니라 수신 메시지를 5분 동안 원자적으로 claim한다.
export async function GET(request) {
  try {
    const agent = identifyRelayAgent(request);
    const requestedLimit = Number(new URL(request.url).searchParams.get('limit') || 20);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
    const supabase = createRelaySupabase();
    const { data, error } = await supabase.rpc('claim_ai_relay_messages', {
      p_recipient: agent,
      p_limit: limit,
    });
    if (error) throw error;
    return json({ agent, messages: (data || []).map(toRelayMessage) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request) {
  try {
    const agent = identifyRelayAgent(request);
    const message = normalizeOutgoingMessage(await readJson(request), agent);
    const supabase = createRelaySupabase();
    const { data, error } = await supabase
      .from('ai_relay_messages')
      .insert(message)
      .select('id, dedupe_key, status, created_at')
      .single();

    if (error?.code === '23505') {
      return json({ deduplicated: true, dedupeKey: message.dedupe_key });
    }
    if (error) throw error;
    return json({
      id: data.id,
      dedupeKey: data.dedupe_key,
      status: data.status,
      createdAt: data.created_at,
    }, 201);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request) {
  try {
    const agent = identifyRelayAgent(request);
    const body = await readJson(request);
    const id = typeof body.id === 'string' ? body.id : '';
    const action = body.action;
    if (!UUID.test(id) || !['ack', 'release'].includes(action)) {
      throw new RelayHttpError(400, 'invalid_ack', 'id and action(ack|release) are required.');
    }

    const update = action === 'ack'
      ? { status: 'acked', acked_at: new Date().toISOString(), last_error: null }
      : {
          status: 'pending',
          claimed_by: null,
          claimed_at: null,
          last_error: typeof body.error === 'string' ? body.error.slice(0, 1000) : null,
        };

    const supabase = createRelaySupabase();
    const { data, error } = await supabase
      .from('ai_relay_messages')
      .update(update)
      .eq('id', id)
      .eq('recipient_agent', agent)
      .eq('claimed_by', agent)
      .eq('status', 'claimed')
      .select('id, status')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new RelayHttpError(409, 'claim_not_owned', 'Message is not claimed by this agent.');
    return json({ id: data.id, status: data.status });
  } catch (error) {
    return failure(error);
  }
}
