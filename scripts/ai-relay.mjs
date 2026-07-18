#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const USAGE = `Manabi AI Relay CLI

Usage:
  node scripts/ai-relay.mjs health
  node scripts/ai-relay.mjs pull [--limit 20]
  node scripts/ai-relay.mjs send --to claude|codex --kind KIND [options]
  node scripts/ai-relay.mjs ack --id UUID
  node scripts/ai-relay.mjs release --id UUID [--error TEXT]

Send options:
  --pr NUMBER                 Pull request number
  --head FULL_40_CHAR_SHA     Current head SHA
  --branch NAME               Head branch
  --body TEXT                 Short body (prefer --body-file for multiline text)
  --body-file PATH            Read body from a UTF-8 file
  --payload JSON              Structured JSON object
  --dedupe-key KEY            Stable idempotency key
  --expires-in SECONDS        60..604800

Environment:
  MANABI_AI_RELAY_URL         e.g. https://manabi.example/api/ai-relay
  MANABI_AI_RELAY_TOKEN       per-agent bearer token
`;

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const part = rest[index];
    if (!part.startsWith('--')) throw new Error(`Unexpected argument: ${part}`);
    const key = part.slice(2);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

function config(env = process.env) {
  const url = (env.MANABI_AI_RELAY_URL || '').replace(/\/$/, '');
  const token = env.MANABI_AI_RELAY_TOKEN || '';
  if (!url || !token) throw new Error('MANABI_AI_RELAY_URL and MANABI_AI_RELAY_TOKEN are required.');
  return { url, token };
}

async function relayRequest(path, { method = 'GET', body, env } = {}) {
  const relay = config(env);
  const response = await fetch(`${relay.url}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${relay.token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'HEAD' && response.ok) return { ok: true };

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || `HTTP ${response.status}` };
  }
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}

function asPositiveInteger(value, name) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer.`);
  return number;
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const { command, options } = parseArgs(argv);
  if (!command || command === 'help' || command === '--help') return { usage: USAGE };

  if (command === 'health') return relayRequest('', { method: 'HEAD', env });
  if (command === 'pull') {
    const limit = asPositiveInteger(options.limit, 'limit') || 20;
    return relayRequest(`?limit=${Math.min(limit, 100)}`, { env });
  }
  if (command === 'ack' || command === 'release') {
    if (!options.id) throw new Error('--id is required.');
    return relayRequest('', {
      method: 'PATCH',
      env,
      body: { id: options.id, action: command, ...(options.error ? { error: options.error } : {}) },
    });
  }
  if (command === 'send') {
    if (!options.to || !options.kind) throw new Error('--to and --kind are required.');
    if (options.body && options['body-file']) throw new Error('Use only one of --body or --body-file.');
    const body = options['body-file'] ? await readFile(options['body-file'], 'utf8') : (options.body || '');
    let payload = {};
    if (options.payload) {
      payload = JSON.parse(options.payload);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('--payload must be a JSON object.');
      }
    }
    return relayRequest('', {
      method: 'POST',
      env,
      body: {
        to: options.to,
        kind: options.kind,
        prNumber: asPositiveInteger(options.pr, 'pr'),
        headSha: options.head,
        branch: options.branch,
        body,
        payload,
        dedupeKey: options['dedupe-key'],
        expiresInSeconds: asPositiveInteger(options['expires-in'], 'expires-in'),
      },
    });
  }
  throw new Error(`Unknown command: ${command}`);
}

async function main() {
  try {
    const result = await run();
    if (result.usage) process.stdout.write(result.usage);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`AI Relay: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
