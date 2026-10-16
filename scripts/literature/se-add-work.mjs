#!/usr/bin/env node
/**
 * Standard Ebooks 작품 추가(LIT-SRC-EN-1) — 판 저장소 한 커밋에서 본문 XHTML만 복사하고 entry.json 초안을 쓴다.
 *
 *   node scripts/literature/se-add-work.mjs <작가>_<작품> --published 1865 --death 1898 --origin GB --level "B1 중급" \
 *        [--title-ko 이상한 나라의 앨리스] [--author-ko 루이스 캐럴] [--commit <40자>] [--approve claude] [--dry-run]
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
const slug = args.find((arg) => /^[a-z0-9-]+_[a-z0-9-]+$/u.test(arg));
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
  const spine = [...opf.matchAll(/<itemref idref="([^"]+)"/gu)].map((match) => match[1]);
  const files = spine.filter((file) => /epub:type="[^"]*bodymatter/u.test(readFileSync(path.join(work, 'src/epub/text', file), 'utf8')));
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
    level: flag('level') || '',
    display: { titleKo: flag('title-ko') || '', authorKo: flag('author-ko') || '' },
    files: files.map((file) => ({ path: file, sha256: sha256(readFileSync(path.join(work, 'src/epub/text', file), 'utf8')) })),
    rights: {
      status: 'reviewing',
      basis: 'public-domain',
      reviewedBy: flag('approve') || '',
      reviewedAt: todayKst,
      reviewedJurisdictions: [...new Set([flag('origin'), 'KR'].filter(Boolean))],
      evidenceUrl: url,
    },
  };
  const verdict = standardEbooksRightsVerdict(entry);
  if (flag('approve') && verdict.ok) entry.rights.status = 'approved';
  const texts = files.map((file) => ({ path: file, text: readFileSync(path.join(work, 'src/epub/text', file), 'utf8') }));
  const key = standardEbooksBookKey(repo);
  console.log(`■ ${key} — ${entry.title} · ${entry.author} (${entry.publishedYear} · 몰 ${entry.authorDeathYear} · ${entry.countryOfOrigin})`);
  console.log(`  권리 ${verdict.ok ? '만료(원산국 — 한국은 상호주의)' : `불가 — ${verdict.reasons.join(' / ')}`} · 본문 ${files.length}파일 · 커밋 ${commit.slice(0, 12)}`);
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
