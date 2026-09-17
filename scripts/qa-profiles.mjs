// Every required group must finish. Optional legacy QA_* switches are not a profile.
const browserSteps = (name, file, groups, app = false) => ['chromium', 'webkit'].map(browser => ({
  id: `${name}-${browser}`, file, browser, groups, app,
  evidence: app ? 'synthetic-auth-http+local-postgres+real-ui' : 'synthetic-http+real-component',
}));
const sql = [
  { id: 'classroom-sql', file: 'e2e/classroom-direct-sql.mjs', groups: ['classroom.sql'], evidence: 'disposable-postgres-rls' },
  { id: 'board-sql', file: 'e2e/teaching-board-cloud-sql.mjs', groups: ['board.sql'], evidence: 'disposable-postgres-rls' },
];
const classroom = browserSteps('classroom', 'e2e/teaching-word-canvas.e2e.mjs', [
  'board.core', 'board.cloud', 'board.fragments', 'board.reuse', 'board.history', 'classroom.student', 'classroom.visual',
], true);
const notes = browserSteps('notes', 'e2e/study-notes.e2e.mjs', ['notes.collection', 'notes.visual'], true);
const reader = [
  ...browserSteps('word-layout', 'e2e/teaching-word-quality.e2e.mjs', ['reader.layout', 'reader.visual']),
  ...browserSteps('reference', 'e2e/reference-scope.e2e.mjs', ['reader.reference']),
];
export const profiles = Object.freeze({ sql, classroom: [...sql, ...classroom], notes, reader,
  release: [...sql, ...classroom, ...notes, ...reader] });

export function profileSteps(name) {
  if (!Object.hasOwn(profiles, name)) throw Error(`unknown_profile:${name}`);
  return profiles[name].map(step => ({ ...step, groups: [...step.groups] }));
}

export function validateEvidence(step, report, exitCode) {
  if (exitCode !== 0) throw Error(`process_failed:${step.id}`);
  if (!report || report.failure || !Array.isArray(report.errors) || report.errors.length) throw Error(`invalid_report:${step.id}`);
  if (report.cleanup?.status !== 'completed') throw Error(`cleanup_incomplete:${step.id}`);
  for (const group of step.groups) if (!report.groups?.includes(group)) throw Error(`missing_group:${group}`);
  if (step.browser && report.engine !== step.browser) throw Error(`wrong_browser:${step.id}`);
  if (report.externalAI?.length) throw Error(`unexpected_provider_request:${step.id}`);
  return true;
}

// Each step owns a disposable database/browser. Collect other independent
// failures only after cleanup, never after infrastructure or isolation failure.
export function canCollectAfterFailure({ enabled, interrupted, evidence, exitCode, serverAlive = true, sourceUnchanged = true }) {
  return !!enabled && !interrupted && Number.isInteger(exitCode) && serverAlive && sourceUnchanged
    && evidence?.cleanup?.status === 'completed' && !evidence.cleanup.errors?.length && !evidence.externalAI?.length;
}

// Only archival verification notes and the task index are safe to classify as light.
// UI rules, curriculum prose, source Markdown, workflows and unknown paths run full CI.
export function isRecordOnly(paths) {
  return paths.length > 0 && paths.every(file => file === 'docs/ai-tasks.md' || /^docs\/verification\/[\w/-]+\.md$/.test(file));
}

export const isLoadedEnvFile = name => /^\.env(?:\.(?:local|development|production|test)(?:\.local)?)?$/.test(name);

export function qaEnvironment(step, base, out, inherited = process.env) {
  const allowed = new Set(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'CI', 'LANG', 'LC_ALL', 'DISPLAY', 'XDG_CACHE_HOME', 'PLAYWRIGHT_BROWSERS_PATH', 'SYSTEMROOT']);
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => allowed.has(key)));
  return { ...env, QA_BASE: base, QA_OUT: out, QA_BROWSER: step.browser || 'chromium',
    QA_TOUCH: step.browser === 'webkit' ? '1' : '0', QA_TRACE: '1', QA_LOGIN: '1',
    QA_BOARD_CLOUD: '1', QA_BOARD_FRAGMENTS: '1', QA_BOARD_REUSE: '1', QA_BOARD_HISTORY: '1', QA_CLASS_RELEASE: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key', NEXT_PUBLIC_SITE_URL: base,
    NODE_OPTIONS: '--max-old-space-size=6144',
  };
}
