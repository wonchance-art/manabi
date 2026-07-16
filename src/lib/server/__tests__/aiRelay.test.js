import { describe, expect, it } from 'vitest';
import {
  RelayHttpError,
  identifyRelayAgent,
  normalizeOutgoingMessage,
  stableStringify,
} from '../aiRelay';

const TOKENS = Object.freeze({
  MANABI_AI_RELAY_CLAUDE_TOKEN: 'claude-token-0123456789-0123456789-ab',
  MANABI_AI_RELAY_CODEX_TOKEN: 'codex-token-0123456789-0123456789-abc',
});
const HEAD = '0123456789abcdef0123456789abcdef01234567';

function request(token) {
  return new Request('https://example.test/api/ai-relay', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('AI Relay authentication', () => {
  it('derives the agent from separate server-side bearer tokens', () => {
    expect(identifyRelayAgent(request(TOKENS.MANABI_AI_RELAY_CLAUDE_TOKEN), TOKENS)).toBe('claude');
    expect(identifyRelayAgent(request(TOKENS.MANABI_AI_RELAY_CODEX_TOKEN), TOKENS)).toBe('codex');
  });

  it('fails closed for missing, short, shared, or invalid credentials', () => {
    expect(() => identifyRelayAgent(request('wrong'), TOKENS)).toThrowError(RelayHttpError);
    expect(() => identifyRelayAgent(request(), TOKENS)).toThrowError(RelayHttpError);
    expect(() => identifyRelayAgent(request('same-token-that-is-long-enough-0000'), {
      MANABI_AI_RELAY_CLAUDE_TOKEN: 'same-token-that-is-long-enough-0000',
      MANABI_AI_RELAY_CODEX_TOKEN: 'same-token-that-is-long-enough-0000',
    })).toThrowError(expect.objectContaining({ status: 503 }));
  });
});

describe('AI Relay message contract', () => {
  it('normalizes a current-head handoff into the database contract', () => {
    const message = normalizeOutgoingMessage({
      to: 'codex',
      kind: 'claude_done',
      pr: 151,
      headSha: HEAD.toUpperCase(),
      branch: 'claude/example',
      body: 'ready',
      payload: { tests: ['unit'] },
    }, 'claude', 0);

    expect(message).toMatchObject({
      source_agent: 'claude',
      recipient_agent: 'codex',
      kind: 'CLAUDE_DONE',
      repo: 'wonchance-art/manabi',
      pr_number: 151,
      head_sha: HEAD,
      branch: 'claude/example',
      message_body: 'ready',
      payload: { tests: ['unit'] },
    });
    expect(message.dedupe_key).toMatch(/^auto:[0-9a-f]{64}$/);
    expect(message.expires_at).toBe('1970-01-08T00:00:00.000Z');
  });

  it('requires a full SHA for completion and review result kinds', () => {
    expect(() => normalizeOutgoingMessage({
      to: 'codex', kind: 'CLAUDE_DONE', headSha: 'abcdef0',
    }, 'claude')).toThrowError(/40-character/);
    expect(() => normalizeOutgoingMessage({
      to: 'claude', kind: 'CODEX_REVIEW',
    }, 'codex')).toThrowError(/requires a full headSha/);
  });

  it('rejects self-delivery, other repositories, arrays, and oversized data', () => {
    expect(() => normalizeOutgoingMessage({ to: 'codex', kind: 'INFO' }, 'codex')).toThrowError(/other relay agent/);
    expect(() => normalizeOutgoingMessage({ to: 'claude', kind: 'INFO', repo: 'other/repo' }, 'codex')).toThrowError(/restricted/);
    expect(() => normalizeOutgoingMessage({ to: 'claude', kind: 'INFO', payload: [] }, 'codex')).toThrowError(/JSON object/);
    expect(() => normalizeOutgoingMessage({ to: 'claude', kind: 'INFO', body: 'x'.repeat(10001) }, 'codex')).toThrowError(/10000/);
  });

  it('prevents either agent from forging the other agent result kind', () => {
    expect(() => normalizeOutgoingMessage({
      to: 'claude', kind: 'CLAUDE_DONE', headSha: HEAD,
    }, 'codex')).toThrowError(/codex cannot send CLAUDE_DONE/);
    expect(() => normalizeOutgoingMessage({
      to: 'codex', kind: 'CODEX_DONE', headSha: HEAD,
    }, 'claude')).toThrowError(/claude cannot send CODEX_DONE/);
  });

  it('generates the same idempotency key regardless of payload key order', () => {
    const first = normalizeOutgoingMessage({ to: 'claude', kind: 'INFO', payload: { b: 2, a: { y: 1, x: 0 } } }, 'codex');
    const second = normalizeOutgoingMessage({ to: 'claude', kind: 'INFO', payload: { a: { x: 0, y: 1 }, b: 2 } }, 'codex');
    expect(first.dedupe_key).toBe(second.dedupe_key);
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });
});
