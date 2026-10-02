import { npm, requireNode24, run } from './runtime.mjs';

try {
  requireNode24();
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--no-browser')) throw new Error('Usage: npm run setup:cloud -- [--no-browser]');
  await run(npm, ['ci', '--include=dev', '--no-audit', '--no-fund']);
  await run(process.execPath, ['scripts/copy-pdf-worker.mjs']);
  if (!args.includes('--no-browser')) {
    // Use the lockfile's Playwright CLI and browser revision, never an npx download.
    const deps = process.platform === 'linux' ? ['--with-deps'] : [];
    await run(process.execPath, ['node_modules/playwright-core/cli.js', 'install', ...deps, 'chromium']);
  }
  console.log('Setup complete. Run npm run verify:cloud' + (args.includes('--no-browser') ? ' -- --no-browser' : '') + '.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
