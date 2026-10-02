import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { buildEnv, fixtureEnv, npm, requireNode24, root, run } from './runtime.mjs';

try {
  requireNode24();
  const [command, ...args] = process.argv.slice(2);
  if (!['build', 'dev', 'start'].includes(command)) throw new Error('Expected build, dev or start.');
  const env = fixtureEnv();
  const marker = join(root, '.next/manabi-cloud-fixture.json');
  if (command === 'build') {
    await run(npm, ['run', 'build', ...args], buildEnv());
    await writeFile(marker, JSON.stringify({ fixture: true, deployable: false }) + '\n');
  } else {
    if (command === 'start') {
      try { await access(marker); } catch { throw new Error('Run npm run build:cloud first. start:cloud only serves a fixture build.'); }
    }
    await run(npm, ['run', command, '--', '--hostname', '0.0.0.0', '--port', '3100', ...args], env);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
