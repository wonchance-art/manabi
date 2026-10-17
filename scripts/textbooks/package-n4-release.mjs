// Register reviewed N4 artifacts without changing a previously packaged edition.
// This command changes local files only; it never writes the publication database.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, sha256 } from './build-n4-web.mjs';
import { validateArtifact } from './validate-n4-web.mjs';

const BOOK_ID = 'japanese-n4';
const EDITION_ID = /^[a-f0-9]{24}$/;
const HASH = /^[a-f0-9]{64}$/;
const SCOPES = ['structure', 'language', 'browser'];
const jsonBytes = value => `${JSON.stringify(value, null, 2)}\n`;
const safeFile = value => typeof value === 'string' && /^[-a-zA-Z0-9_./]+$/.test(value) && !path.isAbsolute(value) && value.split('/').every(part => part && part !== '.' && part !== '..');
async function absent(file) { try { await fs.lstat(file); return false; } catch (error) { if (error.code === 'ENOENT') return true; throw error; } }
async function regularFile(file) { const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Regular file required: ${file}`); return fs.readFile(file); }
async function directory(root) { const stat = await fs.lstat(root); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Regular directory required: ${root}`); }
async function containedFile(root, file) {
  if (!safeFile(file)) throw new Error(`Unsafe evidence path: ${file}`);
  let current = root;
  for (const part of file.split('/')) { current = path.join(current, part); const stat = await fs.lstat(current); if (stat.isSymbolicLink()) throw new Error(`Symlink rejected: ${file}`); }
  return regularFile(current);
}
async function tree(root, prefix = '') {
  const result = {};
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const file = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!safeFile(file) || entry.isSymbolicLink()) throw new Error(`Unsafe packaged entry: ${file}`);
    if (entry.isDirectory()) Object.assign(result, await tree(root, file));
    else if (entry.isFile()) result[file] = sha256(await regularFile(path.join(root, file)));
    else throw new Error(`Regular entry required: ${file}`);
  }
  return canonical(result);
}
function requireIdentity(value, bundle, label) {
  for (const [key, expected] of Object.entries({ bookId: BOOK_ID, editionId: bundle.editionId, contentHash: bundle.contentHash, bundleHash: bundle.artifactManifest.bundleHash })) if (value[key] !== expected) throw new Error(`${label}: ${key} does not match the artifact`);
}
export async function packageN4Release({ artifactDir, verificationFile, outRoot = path.resolve('src/content/textbookEditions'), check = false }) {
  artifactDir = path.resolve(artifactDir); outRoot = path.resolve(outRoot); verificationFile = path.resolve(verificationFile);
  await directory(artifactDir);
  if (!await absent(outRoot)) await directory(outRoot);
  const structure = await validateArtifact(artifactDir, 42);
  if (!structure.passed) throw new Error(`Artifact validation failed: ${structure.errors.join('; ')}`);
  const bundle = JSON.parse(await regularFile(path.join(artifactDir, 'bundle.json')));
  if (!EDITION_ID.test(bundle.editionId) || !HASH.test(bundle.contentHash) || !HASH.test(bundle.artifactManifest.bundleHash)) throw new Error('Invalid artifact identity');
  if (bundle.manuscript.bookId !== BOOK_ID) throw new Error('N4 manuscript identity required');
  const verificationBytes = await regularFile(verificationFile), verification = JSON.parse(verificationBytes);
  requireIdentity(verification, bundle, 'verification');
  if (verification.schemaVersion !== 1 || verification.passed !== true) throw new Error('Passed version-1 verification required');
  const checks = {};
  for (const scope of SCOPES) {
    const receipt = verification.checks?.[scope];
    if (!receipt || receipt.passed !== true || !Array.isArray(receipt.evidence) || !receipt.evidence.length) throw new Error(`Passed ${scope} review and evidence required`);
    requireIdentity(receipt, bundle, scope);
    const evidence = [];
    for (const item of receipt.evidence) {
      if (!HASH.test(item.sha256 || '') || !/\.(json|log|md|txt)$/.test(item.path || '')) throw new Error(`Invalid ${scope} evidence declaration`);
      const bytes = await containedFile(path.dirname(verificationFile), item.path);
      if (sha256(bytes) !== item.sha256) throw new Error(`${scope} evidence hash mismatch: ${item.path}`);
      evidence.push({ path: item.path, sha256: item.sha256 });
    }
    checks[scope] = { passed: true, evidence };
  }
  const packed = { ...bundle, qa: { passed: true, status: 'reviewed-candidate', scope: 'Artifact integrity, independent language review and browser review; operating account verification and publication are separate.', verificationSha256: sha256(verificationBytes), checks } };
  const bundleBytes = Buffer.from(jsonBytes(packed));
  const expectedFiles = { ...await tree(artifactDir), 'bundle.json': sha256(bundleBytes) };
  const destination = path.join(outRoot, bundle.editionId);
  const indexDir = path.join(outRoot, BOOK_ID), indexFile = path.join(indexDir, 'index.json');
  if (!await absent(indexDir)) await directory(indexDir);
  let oldIndex = null;
  if (!await absent(indexFile)) { oldIndex = JSON.parse(await regularFile(indexFile)); if (oldIndex.bookId && oldIndex.bookId !== BOOK_ID) throw new Error('N4 index identity mismatch'); }
  const previous = oldIndex?.reviewCandidates || (oldIndex?.current ? [oldIndex.current] : []);
  if (!Array.isArray(previous) || previous.some(id => !EDITION_ID.test(id))) throw new Error('Invalid existing N4 candidate index');
  const index = { ...(oldIndex || {}), bookId: BOOK_ID, current: bundle.editionId, reviewCandidates: [...new Set([bundle.editionId, ...previous])] };
  const destinationExists = !await absent(destination);
  if (destinationExists) await directory(destination);
  if (destinationExists && JSON.stringify(await tree(destination)) !== JSON.stringify(canonical(expectedFiles))) throw new Error(`Immutable edition already exists with different bytes: ${bundle.editionId}`);
  if (check) {
    if (!destinationExists || !oldIndex || JSON.stringify(canonical(oldIndex)) !== JSON.stringify(canonical(index))) throw new Error('Reviewed N4 candidate has not been packaged');
  } else {
    await fs.mkdir(outRoot, { recursive: true });
    if (!destinationExists) {
      const temporary = await fs.mkdtemp(path.join(outRoot, '.n4-package-'));
      try {
        for (const file of Object.keys(bundle.assets).sort()) { const target = path.join(temporary, file); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, await regularFile(path.join(artifactDir, file)), { flag: 'wx' }); }
        await fs.writeFile(path.join(temporary, 'bundle.json'), bundleBytes, { flag: 'wx' });
        if (JSON.stringify(await tree(temporary)) !== JSON.stringify(canonical(expectedFiles))) throw new Error('Artifact changed while packaging');
        await fs.rename(temporary, destination);
      } finally { await fs.rm(temporary, { recursive: true, force: true }); }
    }
    await fs.mkdir(indexDir, { recursive: true });
    const temporary = path.join(indexDir, `.index-${process.pid}.json`);
    try { await fs.writeFile(temporary, jsonBytes(index), { flag: 'wx' }); await fs.rename(temporary, indexFile); } finally { await fs.rm(temporary, { force: true }); }
  }
  return { bookId: BOOK_ID, editionId: bundle.editionId, contentHash: bundle.contentHash, bundleHash: bundle.artifactManifest.bundleHash, verificationSha256: sha256(verificationBytes), packagedBundleSha256: sha256(bundleBytes), files: Object.keys(expectedFiles).length, registry: `${BOOK_ID}/index.json`, mode: check ? 'check' : destinationExists ? 'unchanged' : 'created', publication: 'not-performed' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  if (!value('--artifact') || !value('--verification')) { console.error('Usage: node scripts/textbooks/package-n4-release.mjs --artifact <reviewed-build> --verification <exact-review.json> [--out-root <edition-root>] [--check]'); process.exitCode = 1; }
  else packageN4Release({ artifactDir: value('--artifact'), verificationFile: value('--verification'), ...(value('--out-root') ? { outRoot: value('--out-root') } : {}), check: args.includes('--check') }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
