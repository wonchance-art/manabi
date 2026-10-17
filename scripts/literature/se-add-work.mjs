#!/usr/bin/env node
/**
 * Standard Ebooks 작품 추가(LIT-SRC-EN-1) — 판 저장소 한 커밋에서 본문 XHTML만 복사하고 entry.json 초안을 쓴다.
 *
 *   node scripts/literature/se-add-work.mjs <작가>_<작품> --published 1865 --death 1898 --origin GB --level "B1 중급" \
 *        [--title-ko 이상한 나라의 앨리스] [--author-ko 루이스 캐럴] [--commit <40자>] [--approve claude] [--dry-run]
 *        [--translated 1862 --translator-death 1879 --translator-origin GB]   ← 번역본(이름은 content.opf의 translator)
 *        [--translators '[{"name":…,"deathYear":…,"publishedYear":…,"countryOfOrigin":…}, …]'] [--exclude a.xhtml,b.xhtml]   ← 번역자 여럿인 모음집
 *
 * 판 저장소: https://github.com/standardebooks/<작가>_<작품>. --commit이 없으면 기본 가지 끝 커밋으로 고정한다.
 * 본문 = content.opf spine 순서 중 body epub:type이 bodymatter인 파일(표제·판권·후기·목록은 넣지 않는다).
 * 권리: 원산국·출판 연도·작가 몰년으로 standardEbooksRightsVerdict를 돌리고, --approve <역할>일 때만 판정이 통과하면 approved로 적는다.
 * 남는 사람 일: 레벨 확인 → node scripts/build-literature.mjs → npm test.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { STANDARD_EBOOKS_ROOT } from '../lib/standard-ebooks-build.mjs';
import { createStandardEbooksDraft, SE_BOOK_VERSION, SE_PROVIDER, standardEbooksBookKey, standardEbooksRightsVerdict } from '../../src/lib/standardEbooks.js';

const args = process.argv.slice(2);
const flag = (name) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const slug = args.find((arg) => /^[a-z0-9-]+(?:_[a-z0-9-]+){1,4}$/u.test(arg)); // 번역본은 <작가>_<작품>_<번역자>
if (!slug) { console.error('사용: se-add-work.mjs <작가>_<작품> --published YYYY --death YYYY --origin GB|US --level "B1 중급"'); process.exit(1); }
const repo = `standardebooks/${slug}`;
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const work = mkdtempSync(path.join(tmpdir(), 'manabi-se-'));
try {
  execFileSync('git', ['clone', '-q', '--filter=blob:none', `https://github.com/${repo}`, work], { stdio: 'inherit' });
  const commit = flag('commit') || execFileSync('git', ['-C', work, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', work, 'checkout', '-q', commit], { stdio: 'inherit' });
  const opf = readFileSync(path.join(work, 'src/epub/content.opf'), 'utf8');
  const meta = (id) => new RegExp(`<dc:(?:title|creator) id="${id}"[^>]*>([^<]+)<`, 'u').exec(opf)?.[1]?.trim();
  const url = /<dc:identifier id="uid">([^<]+)</u.exec(opf)?.[1]?.trim();
  // 번역본: 원작과 번역이 둘 다 한국에서 만료여야 한다(rightsKorea) — 번역자 몰년·번역 출판 연도·번역 원산국을 함께 적는다.
  // 번역자가 여럿인 모음집(id="translator-1" …)은 --translators '[{name, deathYear, publishedYear, countryOfOrigin}, …]'(실을 작품의
  // 번역자만 — 뺀 작품의 번역자는 --exclude로 그 파일과 함께 빠진다). 이름은 content.opf 그대로여야 한다.
  const translatorNames = [...opf.matchAll(/<dc:contributor id="translator(?:-\d+)?">([^<]+)</gu)].map((match) => match[1].trim());
  let translator = null;
  if (translatorNames.length > 1) {
    const listed = flag('translators') ? JSON.parse(flag('translators')) : null;
    if (!Array.isArray(listed) || !listed.length) { console.error(`번역자 여럿(${translatorNames.join(' · ')}) — --translators '[{…}]'(실을 작품의 번역자)가 필요하다`); process.exit(1); }
    const unknown = listed.filter((item) => !translatorNames.includes(item?.name));
    if (unknown.length) { console.error(`--translators의 이름이 판에 없다: ${unknown.map((item) => item?.name).join(' · ')}`); process.exit(1); }
    translator = listed;
  } else if (translatorNames.length === 1) {
    if (!flag('translator-death')) { console.error(`번역본(${translatorNames[0]}) — --translated · --translator-death · --translator-origin가 필요하다`); process.exit(1); }
    translator = {
      name: translatorNames[0],
      deathYear: Number(flag('translator-death')),
      publishedYear: Number(flag('translated')),
      countryOfOrigin: flag('translator-origin'),
    };
  }
  const translators = [translator].flat().filter(Boolean);
  // 권리가 안 되는 번역의 작품은 판에서 뺀다(만 단편집 「Mario and the Magician」 — Lowe-Porter 1963 사망)
  const excluded = new Set((flag('exclude') || '').split(',').map((item) => item.trim()).filter(Boolean));
  const spine = [...opf.matchAll(/<itemref idref="([^"]+)"/gu)].map((match) => match[1]).filter((file) => !excluded.has(file));
  // 부·편 칸막이 파일은 건너뛴다 — 머리(<header>·<hgroup>) 밖에 문단이 없는 파일: 표제만(도덕감정론 「Part I」) 또는 부제 한 줄
  // (국부론 「Book I」의 se:bridgehead). 장 제목이 대신한다. 머리 밖에 머리말이 있는 부(도덕감정론 「Part VI」)는 남는다.
  const hasParagraphs = (xhtml) => /<p\b/u.test(xhtml.replace(/<header\b[\s\S]*?<\/header>|<hgroup\b[\s\S]*?<\/hgroup>/gu, ''));
  const files = spine.filter((file) => {
    const xhtml = readFileSync(path.join(work, 'src/epub/text', file), 'utf8');
    return /epub:type="[^"]*bodymatter/u.test(xhtml) && hasParagraphs(xhtml);
  });
  const entry = {
    schemaVersion: SE_BOOK_VERSION,
    provider: SE_PROVIDER,
    repo,
    commit,
    url,
    title: meta('title'),
    author: meta('author'),
    publishedYear: Number(flag('published')),
    authorDeathYear: Number(flag('death')),
    countryOfOrigin: flag('origin'),
    ...(translator ? { translator } : {}),
    level: flag('level') || '',
    display: { titleKo: flag('title-ko') || '', authorKo: flag('author-ko') || '' },
    files: files.map((file) => ({ path: file, sha256: sha256(readFileSync(path.join(work, 'src/epub/text', file), 'utf8')) })),
    rights: {
      status: 'reviewing',
      basis: 'public-domain',
      reviewedBy: flag('approve') || '',
      reviewedAt: todayKst,
      reviewedJurisdictions: [...new Set([flag('origin'), ...translators.map((item) => item.countryOfOrigin), 'KR'].filter(Boolean))],
      evidenceUrl: url,
    },
  };
  const verdict = standardEbooksRightsVerdict(entry);
  if (flag('approve') && verdict.ok) entry.rights.status = 'approved';
  const texts = files.map((file) => ({ path: file, text: readFileSync(path.join(work, 'src/epub/text', file), 'utf8') }));
  const key = standardEbooksBookKey(repo);
  console.log(`■ ${key} — ${entry.title} · ${entry.author} (${entry.publishedYear} · 몰 ${entry.authorDeathYear} · ${entry.countryOfOrigin})`);
  console.log(`  권리 ${verdict.ok ? `한국에서 만료(${verdict.basis})${translators.map((item) => ` · 번역 ${item.name} ${item.publishedYear}`).join('')}` : `불가 — ${verdict.reasons.join(' / ')}`} · 본문 ${files.length}파일 · 커밋 ${commit.slice(0, 12)}`);
  if (entry.rights.status === 'approved') {
    const draft = createStandardEbooksDraft(entry, texts);
    console.log(`  장 ${draft.book.total}개 · 단어 ${draft.diagnostics.words} (장당 ${draft.diagnostics.minChapterWords}–${draft.diagnostics.maxChapterWords})`);
  }
  if (args.includes('--dry-run')) { console.log('  (dry-run — 쓰지 않음)'); process.exit(0); }
  const base = path.join(STANDARD_EBOOKS_ROOT, key);
  if (existsSync(base)) rmSync(path.join(base, 'source'), { recursive: true, force: true });
  mkdirSync(path.join(base, 'source'), { recursive: true });
  for (const file of files) cpSync(path.join(work, 'src/epub/text', file), path.join(base, 'source', file));
  writeFileSync(path.join(base, 'entry.json'), `${JSON.stringify(entry, null, 2)}\n`);
  console.log(`  ✓ ${base}/ 에 source/·entry.json — 다음: node scripts/build-literature.mjs → npm test`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
