import { describe, expect, it } from 'vitest';
import { buildEnv, fixtureEnv, requireNode24 } from './runtime.mjs';

describe('Cloud fixture isolation', () => {
  it('overrides service endpoints and credentials without mutating the caller', () => {
    const live = { NODE_ENV: 'production', CLAUDE_SCRATCH: '/nonexistent-local-path', NEXT_PUBLIC_SUPABASE_URL: 'https://live.example', GEMINI_API_KEY: 'test-only-sentinel', SUPABASE_SERVICE_ROLE_KEY: 'test-only-sentinel', PATH: 'kept' };
    const fixture = fixtureEnv(live);
    expect(fixture.NEXT_PUBLIC_SUPABASE_URL).toBe('https://e2e.supabase.co');
    expect(fixture.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('e2e-anon-key');
    expect(fixture.GEMINI_API_KEY).toBe('');
    expect(fixture.SUPABASE_SERVICE_ROLE_KEY).toBe('');
    expect(fixture.PATH).toBe('kept');
    expect(fixture.NODE_ENV).toBeUndefined();
    expect(fixture.CLAUDE_SCRATCH).toBe('');
    expect(live.GEMINI_API_KEY).toBe('test-only-sentinel');
  });
  it('rejects an incompatible application runtime before installation', () => {
    expect(() => requireNode24('24.19.0')).not.toThrow();
    expect(() => requireNode24('22.19.0')).toThrow('Node 24 required');
  });
  it('sets a build-only heap budget without replacing explicit operator limits', () => {
    expect(buildEnv({}).NODE_OPTIONS).toBe('--max-old-space-size=4096');
    expect(buildEnv({ NODE_OPTIONS: '--enable-source-maps' }).NODE_OPTIONS).toBe('--enable-source-maps --max-old-space-size=4096');
    expect(buildEnv({ NODE_OPTIONS: '--max_old_space_size=5120' }).NODE_OPTIONS).toBe('--max_old_space_size=5120');
    expect(fixtureEnv({}).NODE_OPTIONS).toBeUndefined();
  });
});
