import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export function requireNode24(version = process.versions.node) {
  if (Number(version.split('.')[0]) !== 24) {
    throw new Error(`Node 24 required (current: ${version}). Select Node 24 or run nvm install && nvm use at the repository root.`);
  }
}

// Fixture builds must never inherit live API credentials or live public endpoints.
// Empty values also take precedence over Next's optional .env.local loading.
export function fixtureEnv(env = process.env) {
  return {
    ...env,
    // Let Next/Vitest select their own mode even on a production-configured host.
    NODE_ENV: undefined,
    CLAUDE_SCRATCH: '',
    NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
    NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fileURLToPath(new URL('../../e2e/fixtures/google-fonts-mock.cjs', import.meta.url)),
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: '', NEXT_PUBLIC_PLAUSIBLE_SRC: '',
    NEXT_PUBLIC_SENTRY_DSN: '', NEXT_PUBLIC_VAPID_PUBLIC_KEY: '',
    NEXT_PUBLIC_WORLD_DEV_GUEST: '',
    GEMINI_API_KEY: '', GROQ_API_KEY: '', SUPADATA_API_KEY: '', QIITA_TOKEN: '',
    SUPABASE_SERVICE_ROLE_KEY: '', CRON_SECRET: '',
    VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '', LLM_LOG: '',
    MANABI_AI_RELAY_CLAUDE_TOKEN: '', MANABI_AI_RELAY_CODEX_TOKEN: '',
    MANABI_AI_RELAY_TOKEN: '', MANABI_AI_RELAY_URL: '',
  };
}

export function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed (${signal || code})`)));
  });
}

// The compiler exceeded Node's ~2 GiB default on an 8 GiB host. This is build-only;
// respect an explicit operator limit and keep production runtime settings unchanged.
export function buildEnv(env = process.env) {
  const fixture = fixtureEnv(env);
  const options = env.NODE_OPTIONS || '';
  fixture.NODE_OPTIONS = /--max[-_]old[-_]space[-_]size(?:=|\s)/.test(options)
    ? options : `${options} --max-old-space-size=4096`.trim();
  return fixture;
}
