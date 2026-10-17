import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadManuscript, renderBook, canonical, sha256 } from '../../../scripts/textbooks/build-n4-web.mjs';
import { packageN4Release } from '../../../scripts/textbooks/package-n4-release.mjs';

let temporary, source, bundle, verification;
const saveJson = (file, value) => fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
async function fixture() {
  const root = await fs.mkdtemp(path.join(temporary, 'case-'));
  const artifactDir = path.join(root, 'artifact'), outRoot = path.join(root, 'editions'), verificationFile = path.join(root, 'verification.json');
  await fs.cp(source, artifactDir, { recursive: true });
  await saveJson(path.join(root, 'evidence.json'), { fixture: true, passed: true });
  await saveJson(verificationFile, verification);
  return { root, artifactDir, outRoot, verificationFile };
}

beforeAll(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'n4-package-test-'));
  source = path.join(temporary, 'source'); await fs.mkdir(source);
  const manuscript = await loadManuscript(path.resolve('src/content/textbookManuscripts/japanese-n4'));
  const contentHash = sha256(JSON.stringify(canonical(manuscript))), editionId = contentHash.slice(0, 24);
  const { html, pages, sourceIndex } = renderBook(manuscript, editionId), assets = {};
  async function put(file, text, type) { const bytes = Buffer.from(text); await fs.mkdir(path.dirname(path.join(source, file)), { recursive: true }); await fs.writeFile(path.join(source, file), bytes); assets[file] = { sha256: sha256(bytes), bytes: bytes.length, type }; }
  await put('index.html', html, 'text/html; charset=utf-8');
  await put('style.css', '/* Test fixture: no actual font/browser certification. */', 'text/css');
  await put('app.js', '// Test fixture', 'text/javascript');
  const fonts = {};
  for (const name of ['JP', 'JPS', 'KR', 'KRB', 'KRS']) { const file = `fonts/${name}.woff`; await put(file, `synthetic-font-${name}`, 'font/woff'); fonts[name] = { output: file, outputSha256: assets[file].sha256, missingCodepoints: [], subsetLostCodepoints: [] }; }
  await put('font-audit.json', JSON.stringify({ passed: true, fonts }), 'application/json');
  const bundleHash = sha256(JSON.stringify(canonical(assets)));
  bundle = { bookId: 'japanese-n4', editionId, contentHash, status: 'draft', manuscript, pages, sourceIndex, assets, artifactManifest: { bundleHash, pages: pages.length, media: { web: true, pdf: false, audio: false } }, qa: { passed: false } };
  await saveJson(path.join(source, 'bundle.json'), bundle);
  const identity = { bookId: bundle.bookId, editionId, contentHash, bundleHash };
  const evidenceSha = sha256(`${JSON.stringify({ fixture: true, passed: true }, null, 2)}\n`);
  verification = { schemaVersion: 1, ...identity, passed: true, checks: Object.fromEntries(['structure', 'language', 'browser'].map(scope => [scope, { ...identity, passed: true, evidence: [{ path: 'evidence.json', sha256: evidenceSha }] }])) };
});
afterAll(async () => { if (temporary) await fs.rm(temporary, { recursive: true, force: true }); });

describe('reviewed N4 release packaging', () => {
  it('registers only the N4 index, preserves all payload bytes and repeats deterministically', async () => {
    const input = await fixture(); await fs.mkdir(input.outRoot);
    const n5Bytes = '{"current":"legacy-N5-must-survive"}\n'; await fs.writeFile(path.join(input.outRoot, 'index.json'), n5Bytes);
    const created = await packageN4Release(input), repeated = await packageN4Release(input), checked = await packageN4Release({ ...input, check: true });
    expect([created.mode, repeated.mode, checked.mode]).toEqual(['created', 'unchanged', 'check']);
    expect(repeated.packagedBundleSha256).toBe(created.packagedBundleSha256);
    expect(await fs.readFile(path.join(input.outRoot, 'index.json'), 'utf8')).toBe(n5Bytes);
    expect(JSON.parse(await fs.readFile(path.join(input.outRoot, 'japanese-n4/index.json'), 'utf8')).current).toBe(bundle.editionId);
    const packed = JSON.parse(await fs.readFile(path.join(input.outRoot, bundle.editionId, 'bundle.json'), 'utf8'));
    expect(packed.qa.passed).toBe(true); expect(packed.artifactManifest).toEqual(bundle.artifactManifest); expect(packed.manuscript).toEqual(bundle.manuscript);
    expect(created.publication).toBe('not-performed');
  });
  it('rejects a missing review, stale edition stamp and changed evidence', async () => {
    const input = await fixture();
    const missing = structuredClone(verification); missing.checks.language.passed = false; await saveJson(input.verificationFile, missing);
    await expect(packageN4Release(input)).rejects.toThrow('language review');
    const stale = structuredClone(verification); stale.checks.browser.bundleHash = 'a'.repeat(64); await saveJson(input.verificationFile, stale);
    await expect(packageN4Release(input)).rejects.toThrow('browser: bundleHash');
    await saveJson(input.verificationFile, verification); await fs.appendFile(path.join(input.root, 'evidence.json'), 'changed');
    await expect(packageN4Release(input)).rejects.toThrow('evidence hash mismatch');
    await expect(fs.stat(input.outRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects changed source assets before any edition registration', async () => {
    const input = await fixture(); await fs.appendFile(path.join(input.artifactDir, 'app.js'), '// modified');
    await expect(packageN4Release(input)).rejects.toThrow('Asset mismatch: app.js');
    await expect(fs.stat(input.outRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('refuses to replace an immutable edition or its review receipt', async () => {
    const input = await fixture(); await packageN4Release(input);
    await fs.appendFile(path.join(input.outRoot, bundle.editionId, 'index.html'), 'changed');
    await expect(packageN4Release(input)).rejects.toThrow('Immutable edition');
    expect((await fs.readFile(path.join(input.outRoot, bundle.editionId, 'index.html'), 'utf8')).endsWith('changed')).toBe(true);
  });
  it('rejects traversal evidence and symlink evidence directories', async () => {
    const input = await fixture(), altered = structuredClone(verification);
    altered.checks.browser.evidence[0].path = '../evidence.json'; await saveJson(input.verificationFile, altered);
    await expect(packageN4Release(input)).rejects.toThrow('Unsafe evidence path');
    await fs.symlink(input.root, path.join(input.root, 'linked'), 'dir');
    altered.checks.browser.evidence[0].path = 'linked/evidence.json'; await saveJson(input.verificationFile, altered);
    await expect(packageN4Release(input)).rejects.toThrow('Symlink rejected');
  });
  it('checks registration without creating output and rejects an N5 index namespace', async () => {
    const input = await fixture(); await expect(packageN4Release({ ...input, check: true })).rejects.toThrow('has not been packaged');
    await expect(fs.stat(input.outRoot)).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.mkdir(path.join(input.outRoot, 'japanese-n4'), { recursive: true }); await saveJson(path.join(input.outRoot, 'japanese-n4/index.json'), { bookId: 'japanese-n5', current: 'a'.repeat(24) });
    await expect(packageN4Release(input)).rejects.toThrow('N4 index identity');
  });
});
