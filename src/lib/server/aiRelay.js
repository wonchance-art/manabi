import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const RELAY_REPO = 'wonchance-art/manabi';
export const RELAY_AGENTS = Object.freeze(['claude', 'codex']);
export const RELAY_KINDS = Object.freeze([
  'PLAN',
  'WORKING',
  'FREEZE',
  'CLAUDE_DONE',
  'CLAUDE_FIXED',
  'CLAUDE_REVIEW_REQUEST',
  'CODEX_IMPL',
  'CODEX_REVIEW',
  'CODEX_DONE',
  'INFO',
]);

const HEAD_REQUIRED_KINDS = new Set([
  'CLAUDE_DONE',
  'CLAUDE_FIXED',
  'CLAUDE_REVIEW_REQUEST',
  'CODEX_REVIEW',
  'CODEX_DONE',
]);
const KINDS_BY_SOURCE = Object.freeze({
  claude: new Set([
    'PLAN', 'WORKING', 'FREEZE', 'CLAUDE_DONE', 'CLAUDE_FIXED',
    'CLAUDE_REVIEW_REQUEST', 'CODEX_IMPL', 'INFO',
  ]),
  codex: new Set(['PLAN', 'WORKING', 'FREEZE', 'CODEX_REVIEW', 'CODEX_DONE', 'INFO']),
});
const FULL_SHA = /^[0-9a-f]{40}$/;
const DEDUPE_KEY = /^[A-Za-z0-9._:/-]{1,160}$/;
const DEFAULT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const MIN_TOKEN_LENGTH = 32;

export class RelayHttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'RelayHttpError';
    this.status = status;
    this.code = code;
  }
}

function digest(value) {
  return createHash('sha256').update(value).digest();
}

function tokenMatches(candidate, expected) {
  return timingSafeEqual(digest(candidate), digest(expected));
}

function configuredTokens(env) {
  const claude = env.MANABI_AI_RELAY_CLAUDE_TOKEN || '';
  const codex = env.MANABI_AI_RELAY_CODEX_TOKEN || '';
  if (claude.length < MIN_TOKEN_LENGTH || codex.length < MIN_TOKEN_LENGTH || tokenMatches(claude, codex)) {
    throw new RelayHttpError(503, 'relay_not_configured', 'AI Relay is not configured.');
  }
  return { claude, codex };
}

export function identifyRelayAgent(request, env = process.env) {
  const tokens = configuredTokens(env);
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new RelayHttpError(401, 'unauthorized', 'Bearer token is required.');

  const candidate = match[1];
  if (tokenMatches(candidate, tokens.claude)) return 'claude';
  if (tokenMatches(candidate, tokens.codex)) return 'codex';
  throw new RelayHttpError(401, 'unauthorized', 'Invalid relay credential.');
}

export function createRelaySupabase(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new RelayHttpError(503, 'relay_storage_unavailable', 'AI Relay storage is not configured.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function parseOptionalInteger(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RelayHttpError(400, 'invalid_message', `${field} must be a positive integer.`);
  }
  return parsed;
}

function parseOptionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new RelayHttpError(400, 'invalid_message', `${field} is invalid.`);
  }
  return value;
}

function generatedDedupeKey(message) {
  const hash = createHash('sha256').update(stableStringify(message)).digest('hex');
  return `auto:${hash}`;
}

export function normalizeOutgoingMessage(input, sourceAgent, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RelayHttpError(400, 'invalid_message', 'Message body must be a JSON object.');
  }
  if (!RELAY_AGENTS.includes(sourceAgent)) {
    throw new RelayHttpError(400, 'invalid_message', 'Unknown source agent.');
  }

  const recipientAgent = input.to || input.recipientAgent;
  if (!RELAY_AGENTS.includes(recipientAgent) || recipientAgent === sourceAgent) {
    throw new RelayHttpError(400, 'invalid_message', 'Recipient must be the other relay agent.');
  }

  const kind = typeof input.kind === 'string' ? input.kind.trim().toUpperCase() : '';
  if (!RELAY_KINDS.includes(kind)) {
    throw new RelayHttpError(400, 'invalid_message', 'Unknown relay kind.');
  }
  if (!KINDS_BY_SOURCE[sourceAgent].has(kind)) {
    throw new RelayHttpError(400, 'invalid_message', `${sourceAgent} cannot send ${kind}.`);
  }

  const repo = input.repo || RELAY_REPO;
  if (repo !== RELAY_REPO) {
    throw new RelayHttpError(400, 'invalid_message', 'Relay is restricted to wonchance-art/manabi.');
  }

  const prNumber = parseOptionalInteger(input.prNumber ?? input.pr, 'prNumber');
  const headSha = input.headSha ? String(input.headSha).trim().toLowerCase() : null;
  if (headSha && !FULL_SHA.test(headSha)) {
    throw new RelayHttpError(400, 'invalid_message', 'headSha must be a full 40-character SHA.');
  }
  if (HEAD_REQUIRED_KINDS.has(kind) && !headSha) {
    throw new RelayHttpError(400, 'invalid_message', `${kind} requires a full headSha.`);
  }

  const branch = parseOptionalText(input.branch, 'branch', 255);
  const messageBody = input.body === undefined || input.body === null ? '' : String(input.body);
  if (messageBody.length > 10000) {
    throw new RelayHttpError(400, 'invalid_message', 'body exceeds 10000 characters.');
  }

  const payload = input.payload ?? {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RelayHttpError(400, 'invalid_message', 'payload must be a JSON object.');
  }
  if (Buffer.byteLength(stableStringify(payload), 'utf8') > 65536) {
    throw new RelayHttpError(400, 'invalid_message', 'payload exceeds 64 KiB.');
  }

  const expirySeconds = input.expiresInSeconds === undefined
    ? DEFAULT_EXPIRY_SECONDS
    : Number(input.expiresInSeconds);
  if (!Number.isInteger(expirySeconds) || expirySeconds < 60 || expirySeconds > DEFAULT_EXPIRY_SECONDS) {
    throw new RelayHttpError(400, 'invalid_message', 'expiresInSeconds must be between 60 and 604800.');
  }

  const canonical = {
    sourceAgent,
    recipientAgent,
    kind,
    repo,
    prNumber,
    headSha,
    branch,
    messageBody,
    payload,
  };
  const dedupeKey = input.dedupeKey || generatedDedupeKey(canonical);
  if (typeof dedupeKey !== 'string' || !DEDUPE_KEY.test(dedupeKey)) {
    throw new RelayHttpError(400, 'invalid_message', 'dedupeKey contains unsupported characters.');
  }

  return {
    source_agent: sourceAgent,
    recipient_agent: recipientAgent,
    kind,
    repo,
    pr_number: prNumber,
    head_sha: headSha,
    branch,
    message_body: messageBody,
    payload,
    dedupe_key: dedupeKey,
    expires_at: new Date(now + expirySeconds * 1000).toISOString(),
  };
}

export function toRelayMessage(row) {
  return {
    id: row.id,
    from: row.source_agent,
    to: row.recipient_agent,
    kind: row.kind,
    repo: row.repo,
    prNumber: row.pr_number,
    headSha: row.head_sha,
    branch: row.branch,
    body: row.message_body,
    payload: row.payload,
    dedupeKey: row.dedupe_key,
    status: row.status,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}
