import { describe, it, expect } from 'vitest';
import { profileSteps, validateEvidence, isRecordOnly, qaEnvironment, isLoadedEnvFile } from './qa-profiles.mjs';

describe('mandatory QA coverage and truthful evidence', () => {
  const step = profileSteps('classroom').find(row => row.browser === 'webkit');
  const report = () => ({ engine: 'webkit', groups: [...step.groups], errors: [], cleanup: { status: 'completed' } });
  it('requires teacher/cloud/reuse/history/student coverage in both engines', () => {
    expect(profileSteps('classroom').filter(s => s.browser)).toHaveLength(2);
    expect(step.groups).toContain('classroom.student');
    expect(step.groups).toContain('board.history');
    expect(profileSteps('release').map(s => s.id)).toEqual(expect.arrayContaining(['notes-webkit', 'reference-chromium', 'word-layout-webkit', 'classroom-sql']));
    expect(() => profileSteps('quick')).toThrow('unknown_profile');
  });
  it('does not report a pass after missing coverage, cleanup failure or a hung process', () => {
    expect(validateEvidence(step, report(), 0)).toBe(true);
    expect(() => validateEvidence(step, { ...report(), groups: ['board.core'] }, 0)).toThrow('missing_group');
    expect(() => validateEvidence(step, { ...report(), cleanup: null }, 0)).toThrow('cleanup');
    expect(() => validateEvidence(step, report(), null)).toThrow('process_failed');
    expect(() => validateEvidence(step, { ...report(), errors: ['unexpected'] }, 0)).toThrow('invalid_report');
    expect(() => validateEvidence(step, { ...report(), engine: 'chromium' }, 0)).toThrow('wrong_browser');
    expect(() => validateEvidence(step, { ...report(), externalAI: ['provider'] }, 0)).toThrow('unexpected_provider');
  });
  it('does not let ambient flags omit checks or connect fixtures to account credentials', () => {
    const env = qaEnvironment(step, 'http://localhost:3137', '/tmp/check', { PATH: '/bin', QA_CLASS_RELEASE: '0', QA_BOARD_CLOUD: '0', QA_PGLITE_MODULE: '/tmp/old', SUPABASE_SERVICE_ROLE_KEY: 'sensitive', NEXT_PUBLIC_SUPABASE_URL: 'remote', GEMINI_API_KEY: 'sensitive' });
    expect(env.QA_CLASS_RELEASE).toBe('1');
    expect(env.QA_BOARD_CLOUD).toBe('1');
    expect(env.QA_PGLITE_MODULE).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://e2e.supabase.co');
    expect(env.QA_TOUCH).toBe('1');
  });
  it('keeps curriculum, UI instructions, executable content and unknown changes under full CI', () => {
    expect(isRecordOnly(['docs/ai-tasks.md', 'docs/verification/release.md'])).toBe(true);
    for (const files of [[], ['docs/ui-conventions.md'], ['CLAUDE.md'], ['src/content/chapter.md'], ['.github/workflows/ci.yml'], ['package.json'], ['docs/verification/check.sql']]) expect(isRecordOnly(files)).toBe(false);
  });
  it('rejects loadable environment files without treating the tracked example as credentials', () => {
    for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development.local']) expect(isLoadedEnvFile(file)).toBe(true);
    expect(isLoadedEnvFile('.env.example')).toBe(false);
  });
});
