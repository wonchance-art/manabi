// Artifact integrity is distinct from independent language and actual browser review.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { N3_RELEASE_CONTRACT, artifactManifestFor, canonical, readTemplateProvenance, regularRead, regularTree, renderBook, renderedStyles, safeAssetPath, sha256, validateSource } from './build-n3-web.mjs';

export function verifyDerivedArtifact(bundle, html) {
  const errors = [];
  const edition = sha256(JSON.stringify(canonical(bundle.manuscript))).slice(0, 24);
  const derived = renderBook(bundle.manuscript, edition);
  const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  if (html !== derived.html) errors.push('Rendered HTML differs from the exact manuscript/template/revision');
  if (!same(bundle.pages, derived.pages)) errors.push('Derived page metadata mismatch');
  if (!same(bundle.sourceIndex, derived.sourceIndex)) errors.push('Derived source index mismatch');
  if (!same(bundle.artifactManifest, artifactManifestFor(bundle.manuscript, derived.pages, bundle.assets, edition))) errors.push('Derived artifact manifest/provenance mismatch');
  return errors;
}
export async function validateArtifact(outDir, expectedLessons) {
  const files = await regularTree(outDir);
  const bundleBytes = await regularRead(outDir, 'bundle.json');
  let bundle;
  try { bundle = JSON.parse(bundleBytes); } catch (error) { if (error instanceof SyntaxError) throw new Error('Invalid artifact bundle JSON'); throw error; }
  const expected = expectedLessons ?? N3_RELEASE_CONTRACT.lessons;
  const errors = validateSource(bundle.manuscript, expected);
  const check = (value, message) => { if (!value) errors.push(message); };
  check(bundle.bookId === 'japanese-n3' && bundle.status === 'draft', 'N3 draft bundle required');
  const contentHash = sha256(JSON.stringify(canonical(bundle.manuscript)));
  check(bundle.contentHash === contentHash && bundle.editionId === contentHash.slice(0, 24), 'Manuscript hash/edition mismatch');
  check(bundle.artifactManifest?.bundleHash === sha256(JSON.stringify(canonical(bundle.assets))), 'Asset manifest bundle hash mismatch');
  check(bundle.artifactManifest?.media?.web === true && bundle.artifactManifest.media.pdf === false && bundle.artifactManifest.media.audio === false, 'No PDF or audio output is certified');
  check(bundle.qa?.passed === false, 'New artifact must not inherit N5 QA certification');
  const expectedFiles = ['bundle.json', ...Object.keys(bundle.assets)].sort();
  check(JSON.stringify(files) === JSON.stringify(expectedFiles), 'Undeclared or missing output asset');
  for (const [file, entry] of Object.entries(bundle.assets)) {
    if (!safeAssetPath(file)) { errors.push(`Unsafe asset: ${file}`); continue; }
    try { const bytes = await regularRead(outDir, file); check(bytes.length === entry.bytes && sha256(bytes) === entry.sha256, `Asset mismatch: ${file}`); } catch { errors.push(`Missing asset: ${file}`); }
  }
  const html = (await regularRead(outDir, 'index.html')).toString('utf8');
  const css = (await regularRead(outDir, 'style.css')).toString('utf8');
  const js = (await regularRead(outDir, 'app.js')).toString('utf8');
  errors.push(...verifyDerivedArtifact(bundle, html));
  check(JSON.stringify(canonical(bundle.manuscript.templates)) === JSON.stringify(canonical(await readTemplateProvenance())), 'Current trusted tool/font/style/release-contract provenance mismatch');
  check(css === await renderedStyles(), 'Rendered CSS differs from the trusted visual source');
  check(js === await fs.readFile(new URL('./n3-runtime.js', import.meta.url), 'utf8'), 'Runtime differs from the trusted N3 source');
  let actualFontCheck;
  try {
    const result = await promisify(execFile)('python3', [fileURLToPath(new URL('./prepare-n3-fonts.py', import.meta.url)), '--out', outDir, '--check'], { maxBuffer: 1024 * 1024 });
    actualFontCheck = JSON.parse(result.stdout);
    check(actualFontCheck.passed === true, 'Actual font cmap audit failed');
  } catch (error) {
    try { actualFontCheck = JSON.parse(error.stdout); } catch { actualFontCheck = { passed: false, errors: [error.message] }; }
    check(false, 'Actual font cmap audit failed');
  }
  const fontAudit = JSON.parse(await regularRead(outDir, 'font-audit.json'));
  check(fontAudit.passed === true && Object.keys(fontAudit.fonts || {}).length === 5, 'Font glyph audit did not pass for all five families');
  for (const font of Object.values(fontAudit.fonts || {})) check(font.missingCodepoints?.length === 0 && font.subsetLostCodepoints?.length === 0 && bundle.assets[font.output]?.sha256 === font.outputSha256, `Font coverage or hash mismatch: ${font.output}`);
  check(!/\/api\/|https?:\/\/|<audio\b|<iframe\b|\.pdf["']/i.test(html + css + js), 'Unexpected network API/audio/PDF linkage');
  check(!/\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*javascript:/i.test(html), 'Unsafe event handler/link');
  check(html.includes('대화 대본 확인(음성 미제작)') && html.includes('공식 JLPT 전체 범위 미인증'), 'Draft/scope/audio limitations missing');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  check(new Set(ids).size === ids.length, 'Duplicate DOM IDs');
  const units = bundle.manuscript.lessons.map(lesson => lesson.id);
  const destinations = new Set([...ids, ...units, 'reference', ...(bundle.manuscript.frontMatter?.length ? ['guide'] : [])]);
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) check(destinations.has(target), `Broken anchor: ${target}`);
  for (const [, file] of [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g), ...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)]) {
    if (file.startsWith('data:')) continue;
    check(Object.hasOwn(bundle.assets, file), `Undeclared resource: ${file}`);
  }
  const articles = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)];
  check(articles.length === 2 + (bundle.manuscript.frontMatter?.length || 0) + expected * 4, 'Unexpected article count');
  check(bundle.pages?.length === articles.length && bundle.artifactManifest.pages === articles.length, 'Page manifest mismatch');
  for (const [i, article] of articles.entries()) {
    const id = article[1].match(/\bid="([^"]+)"/)?.[1];
    const unit = article[1].match(/\bdata-unit-page="([^"]+)"/)?.[1];
    check(bundle.pages[i]?.id === id && bundle.pages[i]?.page === i + 1, `Page ordering mismatch: ${id}`);
    check(!!bundle.sourceIndex?.[id]?.text, `Source index absent: ${id}`);
    const sourceText = article[0].replace(/<rt\b[^>]*>[\s\S]*?<\/rt>|<small class="reading-note">[\s\S]*?<\/small>/g, '').replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity]));
    check(bundle.sourceIndex?.[id]?.text === sourceText, `Source text mismatch: ${id}`);
    if (units.includes(unit)) check(bundle.sourceIndex[id]?.lesson === Number(unit.slice(1)), `Source lesson mismatch: ${id}`);
    check(!/<(?:script|iframe|object|embed)\b/i.test(article[2]), `Unsafe source article: ${id}`);
  }
  check(Object.keys(bundle.sourceIndex || {}).length === articles.length, 'Source index closure mismatch');
  const fields = [...html.matchAll(/<(?:input|textarea)\b[^>]*\bdata-save="([^"]+)"[^>]*>/g)].map(match => match[1]);
  check(new Set(fields).size > 0, 'No answer fields');
  const result = { passed: errors.length === 0, scope: 'Structural/hash/asset/anchor checks only; no independent language or browser certification', editionId: bundle.editionId, lessons: bundle.manuscript.lessons.length, pages: articles.length, assets: Object.keys(bundle.assets).length, answerKeys: new Set(fields).size, validatedBundleSha256: sha256(bundleBytes), actualFontCheck, errors };
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  const expected = value('--expected-lessons') ? Number(value('--expected-lessons')) : undefined;
  if (expected !== undefined && (!Number.isInteger(expected) || expected < 1 || expected > 99)) throw new Error('Expected lessons must be an integer from 1 to 99');
  validateArtifact(path.resolve(value('--out') || '/workspace/scratch/n3-production/web'), expected).then(result => { console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
