import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

import { GET, HEAD, PATCH, POST } from './route';

const CLAUDE_TOKEN = 'claude-token-0123456789-0123456789-ab';
const CODEX_TOKEN = 'codex-token-0123456789-0123456789-abc';
const HEAD_SHA = '0123456789abcdef0123456789abcdef01234567';
const MESSAGE_ID = '00000000-0000-4000-8000-000000000001';

function request(method, token, body, suffix = '') {
  return new Request(`https://example.test/api/ai-relay${suffix}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function updateChain(result) {
  const chain = {
    eq: vi.fn(() => chain),
    select: vi.fn(() => ({ maybeSingle: vi.fn(async () => result) })),
  };
  return chain;
}

describe('/api/ai-relay', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    process.env.MANABI_AI_RELAY_CLAUDE_TOKEN = CLAUDE_TOKEN;
    process.env.MANABI_AI_RELAY_CODEX_TOKEN = CODEX_TOKEN;
  });

  it('fails closed before touching storage when the credential is invalid', async () => {
    const response = await HEAD(request('HEAD', 'wrong-token'));
    expect(response.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('reports health only when authentication and server storage are configured', async () => {
    createClientMock.mockReturnValue({});
    const response = await HEAD(request('HEAD', CODEX_TOKEN));
    expect(response.status).toBe(204);
    expect(createClientMock).toHaveBeenCalledOnce();
  });

  it('stores the authenticated sender instead of trusting a body sender field', async () => {
    const single = vi.fn(async () => ({
      data: { id: MESSAGE_ID, dedupe_key: 'codex-done:151', status: 'pending', created_at: '2026-07-16T00:00:00Z' },
      error: null,
    }));
    const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
    createClientMock.mockReturnValue({ from: vi.fn(() => ({ insert })) });

    const response = await POST(request('POST', CODEX_TOKEN, {
      from: 'claude',
      to: 'claude',
      kind: 'CODEX_DONE',
      pr: 151,
      headSha: HEAD_SHA,
      dedupeKey: 'codex-done:151',
    }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      source_agent: 'codex',
      recipient_agent: 'claude',
      head_sha: HEAD_SHA,
    }));
  });

  it('claims only the token owner inbox and maps storage rows to the wire format', async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        id: MESSAGE_ID,
        source_agent: 'claude',
        recipient_agent: 'codex',
        kind: 'CLAUDE_DONE',
        repo: 'wonchance-art/manabi',
        pr_number: 151,
        head_sha: HEAD_SHA,
        branch: 'claude/example',
        message_body: 'ready',
        payload: {},
        dedupe_key: 'claude-done:151',
        status: 'claimed',
        attempt_count: 1,
        created_at: '2026-07-16T00:00:00Z',
        expires_at: '2026-07-23T00:00:00Z',
      }],
      error: null,
    }));
    createClientMock.mockReturnValue({ rpc });

    const response = await GET(request('GET', CODEX_TOKEN, null, '?limit=500'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      agent: 'codex',
      messages: [expect.objectContaining({ from: 'claude', to: 'codex', headSha: HEAD_SHA })],
    }));
    expect(rpc).toHaveBeenCalledWith('claim_ai_relay_messages', { p_recipient: 'codex', p_limit: 100 });
  });

  it('ACKs only a message currently claimed by the token owner', async () => {
    const chain = updateChain({ data: { id: MESSAGE_ID, status: 'acked' }, error: null });
    const update = vi.fn(() => chain);
    createClientMock.mockReturnValue({ from: vi.fn(() => ({ update })) });

    const response = await PATCH(request('PATCH', CODEX_TOKEN, { id: MESSAGE_ID, action: 'ack' }));
    expect(response.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith('recipient_agent', 'codex');
    expect(chain.eq).toHaveBeenCalledWith('claimed_by', 'codex');
    await expect(response.json()).resolves.toEqual({ id: MESSAGE_ID, status: 'acked' });
  });
});
