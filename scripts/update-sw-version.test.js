import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeContentHash, updateServiceWorkerVersion } from './update-sw-version.mjs';

async function makeRepo() {
  const root = await mkdtemp(path.join(tmpdir(), 'manabi-sw-version-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'public'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), '{"name":"fixture"}\n');
  await writeFile(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  await writeFile(path.join(root, 'next.config.mjs'), 'export default {};\n');
  await writeFile(path.join(root, 'src', 'app.js'), 'export const value = 1;\n');
  await writeFile(path.join(root, 'public', 'sw.js'), [
    "const CACHE_NAME = 'anatomy-studio-v202001010000';",
    "self.addEventListener('fetch', () => {});",
    '',
  ].join('\n'));
  return root;
}

describe('service worker content-hash version', () => {
  it('동일 콘텐츠는 이전 wall-clock 버전과 무관하게 같은 버전과 byte를 만든다', async () => {
    const root = await makeRepo();
    try {
      const first = await updateServiceWorkerVersion(root);
      const firstBytes = await readFile(path.join(root, 'public', 'sw.js'));
      const second = await updateServiceWorkerVersion(root);
      const secondBytes = await readFile(path.join(root, 'public', 'sw.js'));

      expect(first.version).toMatch(/^anatomy-studio-v[0-9a-f]{16}$/);
      expect(second).toMatchObject({ changed: false, contentHash: first.contentHash, version: first.version });
      expect(secondBytes).toEqual(firstBytes);
      expect(await computeContentHash(root)).toBe(first.contentHash);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('배포 콘텐츠가 바뀌면 캐시 버전도 바뀐다', async () => {
    const root = await makeRepo();
    try {
      const first = await updateServiceWorkerVersion(root);
      await writeFile(path.join(root, 'src', 'app.js'), 'export const value = 2;\n');
      const second = await updateServiceWorkerVersion(root);
      expect(second.version).not.toBe(first.version);
      expect(second.contentHash).not.toBe(first.contentHash);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
