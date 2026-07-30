import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scanDialogueIpaSource } from './lint-dialogue-ipa.mjs';

const FIXTURE_DIRECTORY = fileURLToPath(
  new URL('./__fixtures__/lint-dialogue-ipa/', import.meta.url),
);

async function scanFixture(name) {
  const fixturePath = path.join(FIXTURE_DIRECTORY, name);
  return scanDialogueIpaSource(await fs.readFile(fixturePath, 'utf8'), name);
}

describe('dialogue IPA coverage lint', () => {
  it('single-line objects are counted independently', async () => {
    const result = await scanFixture('single-line.js');

    expect(result.speakerObjects).toBe(2);
    expect(result.missing).toEqual([{ file: 'single-line.js', line: 3 }]);
    expect(result.issues).toEqual([]);
  });

  it('multi-line objects require a top-level ipa field', async () => {
    const result = await scanFixture('multi-line.js');

    expect(result.speakerObjects).toBe(3);
    expect(result.missing).toEqual([
      { file: 'multi-line.js', line: 9 },
      { file: 'multi-line.js', line: 14 },
    ]);
    expect(result.issues).toEqual([]);
  });
});
