import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SQL = readFileSync(
  new URL('../../../../supabase/migrations/20260716074502_ai_relay_messages.sql', import.meta.url),
  'utf8',
);

describe('AI Relay migration security contract', () => {
  it('enables RLS without opening anon or authenticated policies', () => {
    expect(SQL).toMatch(/ALTER TABLE public\.ai_relay_messages ENABLE ROW LEVEL SECURITY/i);
    expect(SQL).toMatch(/REVOKE ALL ON TABLE public\.ai_relay_messages FROM PUBLIC, anon, authenticated/i);
    expect(SQL).not.toMatch(/CREATE POLICY/i);
  });

  it('hardens the atomic SECURITY DEFINER claim function', () => {
    expect(SQL).toMatch(/SECURITY DEFINER\s+SET search_path = ''/i);
    expect(SQL).toMatch(/FOR UPDATE SKIP LOCKED/i);
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.claim_ai_relay_messages\(text, integer\)\s+FROM PUBLIC, anon, authenticated/i);
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_ai_relay_messages\(text, integer\)\s+TO service_role/i);
  });
});
