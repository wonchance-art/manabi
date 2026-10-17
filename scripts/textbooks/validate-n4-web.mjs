// Artifact integrity is distinct from independent language and actual browser review.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, sha256, validateSource } from './build-n4-web.mjs';

async function walk(root, prefix = '') {
  const files = [];
  for (const item of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isSymbolicLink()) throw new Error(`Symlink rejected: ${relative}`);
    if (item.isDirectory()) files.push(...await walk(root, relative)); else files.push(relative);
  }
  return files.sort();
}
export async function validateArtifact(outDir, expectedLessons = 42) {
  const bundle = JSON.parse(await fs.readFile(path.join(outDir, 'bundle.json'), 'utf8'));
  const errors = validateSource(bundle.manuscript, expectedLessons);
  const check = (value, message) => { if (!value) errors.push(message); };
  check(bundle.bookId === 'japanese-n4' && bundle.status === 'draft', 'N4 draft bundle required');
  const contentHash = sha256(JSON.stringify(canonical(bundle.manuscript)));
  check(bundle.contentHash === contentHash && bundle.editionId === contentHash.slice(0, 24), 'Manuscript hash/edition mismatch');
  check(bundle.artifactManifest?.bundleHash === sha256(JSON.stringify(canonical(bundle.assets))), 'Asset manifest bundle hash mismatch');
  check(bundle.artifactManifest?.media?.web === true && bundle.artifactManifest.media.pdf === false && bundle.artifactManifest.media.audio === false, 'No PDF or audio output is certified');
  check(bundle.qa?.passed === false, 'New artifact must not inherit N5 QA certification');
  const expectedFiles = ['bundle.json', ...Object.keys(bundle.assets)].sort();
  check(JSON.stringify(await walk(outDir)) === JSON.stringify(expectedFiles), 'Undeclared or missing output asset');
  for (const [file, entry] of Object.entries(bundle.assets)) {
    if (!/^[-a-zA-Z0-9_./]+$/.test(file) || file.split('/').includes('..')) { errors.push(`Unsafe asset: ${file}`); continue; }
    try { const bytes = await fs.readFile(path.join(outDir, file)); check(bytes.length === entry.bytes && sha256(bytes) === entry.sha256, `Asset mismatch: ${file}`); } catch { errors.push(`Missing asset: ${file}`); }
  }
  const html = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(outDir, 'style.css'), 'utf8');
  const js = await fs.readFile(path.join(outDir, 'app.js'), 'utf8');
  const fontAudit = JSON.parse(await fs.readFile(path.join(outDir, 'font-audit.json'), 'utf8'));
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
  check(articles.length === 2 + (bundle.manuscript.frontMatter?.length || 0) + expectedLessons * 4, 'Unexpected article count');
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
  const result = { passed: errors.length === 0, scope: 'Structural/hash/asset/anchor checks only; no independent language or browser certification', editionId: bundle.editionId, lessons: bundle.manuscript.lessons.length, pages: articles.length, assets: Object.keys(bundle.assets).length, answerKeys: new Set(fields).size, errors };
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  const expected = Number(value('--expected-lessons') || 42);
  if (!Number.isInteger(expected) || expected < 1 || expected > 99) throw new Error('Expected lessons must be an integer from 1 to 99');
  validateArtifact(path.resolve(value('--out') || '/workspace/scratch/n4-production/web'), expected).then(result => { console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
