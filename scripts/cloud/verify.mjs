import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { join } from 'node:path';
import { fixtureEnv, npm, requireNode24, root, run } from './runtime.mjs';

async function libraryBrowserTests(env) {
  const url = 'http://localhost:8878';
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '8878'], {
    cwd: root, stdio: 'inherit',
    env: { ...env, E2E_PUBLISHED_EDITION: '8a8c1c1fd452773810abaf8c', NODE_OPTIONS: `--import=${new URL('../../e2e/server-fetch-mock.mjs', import.meta.url).href}` },
  });
  let startupError;
  server.on('error', error => { startupError = error; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (startupError) throw startupError;
      if (server.exitCode !== null) throw new Error(`Fixture server exited (${server.exitCode}).`);
      try { ready = (await fetch(`${url}/manifest.webmanifest`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* wait for start */ }
      if (ready) break;
      await setTimeout(500);
    }
    if (!ready) throw new Error('Fixture server was not ready after 60 seconds.');
    await run(process.execPath, ['--test', '--test-concurrency=1', ...[
      'library-book-chapters', 'library-management', 'learning-flow-clarity', 'textbook-reading-clarity',
      'viewer-response', 'viewer-hun-layout', 'viewer-exclusion',
    ].map(name => `e2e/${name}.e2e.mjs`)], { ...env, COMPOSER_BASE_URL: url, COMPOSER_TEST_MODULES: join(root, 'node_modules') });
  } finally {
    if (server.pid && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      const timeout = globalThis.setTimeout(() => server.kill('SIGKILL'), 5000);
      await exited;
      globalThis.clearTimeout(timeout);
    }
  }
}

try {
  requireNode24();
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--no-browser')) throw new Error('Usage: npm run verify:cloud -- [--no-browser]');
  const env = fixtureEnv();
  await run(npm, ['run', 'lint'], env);
  await run(npm, ['test'], env);
  await run(npm, ['run', 'test:sql'], env);
  await run(npm, ['run', 'build:cloud'], env);
  if (!args.includes('--no-browser')) {
    for (const script of ['e2e:typography', 'e2e:chrome', 'e2e', 'e2e:learning']) await run(npm, ['run', script], env);
    await libraryBrowserTests(env);
  }
  console.log(`Cloud verification passed${args.includes('--no-browser') ? ' (browser tests explicitly omitted)' : ' (including browser fixtures)'}. World generation and live-account QA are separate.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
