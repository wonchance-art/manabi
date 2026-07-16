import { describe, expect, it } from 'vitest';
import { parseArgs, run } from './ai-relay.mjs';

describe('AI Relay CLI', () => {
  it('parses commands without swallowing option values', () => {
    expect(parseArgs(['send', '--to', 'claude', '--kind', 'CODEX_DONE'])).toEqual({
      command: 'send',
      options: { to: 'claude', kind: 'CODEX_DONE' },
    });
  });

  it('rejects missing option values and missing configuration', async () => {
    expect(() => parseArgs(['send', '--to'])).toThrow(/Missing value/);
    await expect(run(['health'], {})).rejects.toThrow(/MANABI_AI_RELAY_URL/);
  });

  it('returns usage without requiring secrets', async () => {
    await expect(run(['help'], {})).resolves.toEqual(expect.objectContaining({ usage: expect.stringContaining('Manabi AI Relay CLI') }));
  });
});
