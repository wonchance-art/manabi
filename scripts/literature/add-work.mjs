#!/usr/bin/env node
/**
 * 정본 문학책 작품 추가 — 青空文庫 작품 ID 하나로 원문 받기부터 entry.json 초안·진단까지 한 번에 한다.
 * (예전 절차 ②~④의 손일: zip 받기 · SHA-256 두 번 · Shift_JIS 변환 · 도서 카드 읽고 entry.json 쓰기 · 빌드해 보기)
 *
 *   node scripts/literature/add-work.mjs 127                       羅生門 — 초안 + 진단
 *   node scripts/literature/add-work.mjs 127 --level "N2 상급" --approve claude
 *   node scripts/literature/add-work.mjs 127 --dry-run              파일을 쓰지 않고 진단만
 *   node scripts/literature/add-work.mjs 799 --unproofread "오너 결정 원문"   교정자 없는 입력본(오너 승인 기록과 함께만)
 *
 * 하는 일:
 *   ① 공식 색인(candidates.mjs와 같은 캐시)에서 작품을 찾고 선정 기준(D5 일본 보호기간 만료·新字新仮名·원작만)을 1차 판정한다.
 *   ② 텍스트 zip을 받아 sourceSha256, Shift_JIS → UTF-8 source.txt, textSha256을 만든다(원문은 손대지 않는다).
 *   ③ 원문을 파싱해 미해결 외자·파서 경고·장 나눔(장 수·장별 글자 수·문단 찢김)을 진단한다. 문제가 있으면 아무것도 쓰지 않는다.
 *   ④ entry.json 초안 — 색인·원문에서 채울 수 있는 칸은 모두 채운다(제목·저자·연도·주소·해시·읽기, 같은 작가의 authorKo).
 *      권리는 근거·관할을 채운 「reviewing」으로 둔다. --approve <역할>이면 판정이 통과할 때만 approved로 기록한다
 *      (법률 판단을 대신하지 않는다 — 기록하는 사람이 도서 카드 근거를 본 뒤 붙이는 옵션이다).
 * 남는 사람 일: level · titleKo · cover(색) · motif(표지 문양) · (선택) review.json → node scripts/build-literature.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../eval/productImportHooks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LITERATURE_ROOT = path.join(ROOT, 'src/content/literature/aozora');

const { loadAozoraIndex, cachedFetch } = await import('./candidates.mjs');
const { aozoraCandidateIssues, unzipEntries, decodeAozoraText, colophonFirstAppearanceYear } = await import('../lib/aozora-index.mjs');
const { aozoraJurisdictionVerdict } = await import('../../src/lib/aozoraRights.js');
const { aozoraWorkKey } = await import('../../src/lib/aozoraCatalog.js');
const { parseAozoraText } = await import('../../src/lib/aozoraParser.js');
const { createAozoraMaterialDraft } = await import('../../src/lib/aozoraMaterial.js');
const { JP_LEVELS } = await import('../../src/lib/constants.js');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** 같은 작가의 기존 작품에서 한국어 이름(authorKo)을 가져온다 — 표기를 작품마다 다시 정하지 않는다. */
function knownAuthorKo(author) {
  if (!existsSync(LITERATURE_ROOT)) return '';
  for (const dir of readdirSync(LITERATURE_ROOT)) {
    const file = path.join(LITERATURE_ROOT, dir, 'entry.json');
    if (!existsSync(file)) continue;
    const entry = JSON.parse(readFileSync(file, 'utf8'));
    if (entry.author === author && entry.display?.authorKo) return entry.display.authorKo;
  }
  return '';
}

export async function addWork(workId, { level, approve, unproofreadReason, dryRun = false } = {}) {
  const index = await loadAozoraIndex();
  const work = index.get(String(Number(workId)));
  if (!work) throw new Error(`색인에 작품 ${workId}가 없다`);

  const zip = await cachedFetch(work.textUrl, `text-${work.workId}.zip`);
  const txt = unzipEntries(zip).find((entry) => /\.txt$/iu.test(entry.name));
  if (!txt) throw new Error(`${work.textUrl}: zip에 txt가 없다`);
  const source = decodeAozoraText(txt.bytes);
  const sourceBytes = Buffer.from(source, 'utf8');
  const document = parseAozoraText(source);

  const publishedYear = work.publishedYear ?? colophonFirstAppearanceYear(source);
  const issues = aozoraCandidateIssues(work, { publishedYear });
  const verdict = aozoraJurisdictionVerdict({ publishedYear: publishedYear ?? undefined, authorDeathYear: work.author?.deathYear ?? undefined });
  const entry = {
    schemaVersion: 1,
    personId: work.author?.personId ?? '',
    workId: work.workId,
    title: document.header.title,
    author: document.header.author,
    language: 'ja',
    charset: work.charset,
    publishedYear,
    authorDeathYear: work.author?.deathYear ?? null,
    level: level ?? null,
    cardUrl: work.cardUrl,
    sourceFileUrl: work.textUrl,
    sourceFormat: 'txt',
    sourceSha256: sha256(zip),
    textSha256: sha256(sourceBytes),
    attribution: { author: document.header.author, translator: null, illustrator: null },
    rights: {
      status: approve && verdict.ok && !issues.length ? 'approved' : 'reviewing',
      basis: 'public-domain',
      reviewedBy: approve || null,
      reviewedAt: approve ? kstToday() : null,
      reviewedJurisdictions: ['JP', 'KR'],
      evidenceUrl: work.cardUrl,
    },
    // 교정자 없는 입력본 — 오너가 그 작품을 승인한 원문을 --unproofread "<오너 결정>"으로 남길 때만(빌드도 이 기록을 본다)
    ...(unproofreadReason ? { unproofreadApproval: { approvedBy: 'owner', approvedAt: kstToday(), reason: unproofreadReason } } : {}),
    display: {
      titleReading: /^[ぁ-ゟ゠-ヿー\s]+$/u.test(work.titleReading) ? work.titleReading : '',
      titleKo: '',
      authorKo: knownAuthorKo(document.header.author),
      cover: '',
      motif: '',
    },
  };

  // 장 나눔·외자·경고 진단 — 빌드와 같은 함수로(권리·레벨은 진단용 임시값). 실패하면 그 이유가 곧 제외 사유다.
  let diagnostics = null;
  let draftError = null;
  try {
    const probe = { ...entry, level: entry.level ?? JP_LEVELS[2], rights: { ...entry.rights, status: 'approved', reviewedBy: 'probe', reviewedAt: kstToday() },
      publishedYear: entry.publishedYear ?? 1900, authorDeathYear: entry.authorDeathYear ?? 1900 };
    const draft = createAozoraMaterialDraft(probe, document);
    diagnostics = { ...draft.diagnostics, division: draft.book.division, titles: draft.chapters.map((chapter) => chapter.title) };
    if (diagnostics.midParagraphSplitCount || diagnostics.droppedRubyCount) draftError = `장 경계가 문단 ${diagnostics.midParagraphSplitCount}곳·루비 ${diagnostics.droppedRubyCount}개를 갈랐다`;
  } catch (error) {
    draftError = error.message;
  }

  const key = entry.personId ? aozoraWorkKey(entry) : null;
  const report = { key, title: entry.title, author: entry.author, publishedYear, authorDeathYear: entry.authorDeathYear, verdict, issues, draftError, diagnostics };
  if (issues.length || draftError || !key || dryRun) return { report, written: false };

  const base = path.join(LITERATURE_ROOT, key);
  mkdirSync(base, { recursive: true });
  writeFileSync(path.join(base, 'source.txt'), sourceBytes);
  const entryFile = path.join(base, 'entry.json');
  // 다시 돌려도 사람이 채운 칸(level·display·권리 기록)은 지우지 않는다 — 원문·해시·색인 칸만 새로 쓴다.
  const previous = existsSync(entryFile) ? JSON.parse(readFileSync(entryFile, 'utf8')) : null;
  const merged = previous ? {
    ...entry,
    level: level ?? previous.level ?? null,
    rights: previous.rights?.status === 'approved' && !approve ? previous.rights : entry.rights,
    display: { ...entry.display, ...Object.fromEntries(Object.entries(previous.display ?? {}).filter(([, value]) => value)) },
  } : entry;
  writeFileSync(entryFile, `${JSON.stringify(merged, null, 2)}\n`);
  return { report, written: true, base, entry: merged };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2).filter((arg, index, args) => /^\d+$/u.test(arg) && !['--level', '--approve', '--unproofread'].includes(args[index - 1]));
  if (!ids.length) {
    console.error('사용: node scripts/literature/add-work.mjs <作品ID> [...] [--level "N3 중급"] [--approve claude] [--dry-run]');
    process.exit(2);
  }
  const level = option('--level');
  if (level && !JP_LEVELS.includes(level)) {
    console.error(`--level은 ${JP_LEVELS.join(' · ')} 중 하나`);
    process.exit(2);
  }
  let failed = 0;
  for (const id of ids) {
    const { report, written, base, entry } = await addWork(id, { level, approve: option('--approve'), unproofreadReason: option('--unproofread'), dryRun: process.argv.includes('--dry-run') });
    const d = report.diagnostics;
    console.log(`\n■ ${id} ${report.title} — ${report.author} (初出 ${report.publishedYear ?? '?'} · 몰 ${report.authorDeathYear ?? '?'})`);
    console.log(`  권리 1차 판정 JP ${report.verdict.JP ? '만료' : '?'} · KR ${report.verdict.KR ? '만료' : '?'}(JP를 따름)${report.verdict.US ? '' : ' · 참고: US 보호 가능(공개 조건 아님)'}`);
    if (d) {
      console.log(`  장 ${d.titles.length}개(${d.division}) · 글자 ${d.chapterChars.join('/')} · 외자 ${d.resolvedGaijiCount}자 해결 · 루비 ${d.mappedRubyCount}/${d.rubyCount}`);
    }
    if (report.issues.length || report.draftError) {
      failed += 1;
      console.log(`  ✗ 넣을 수 없음: ${[...report.issues, report.draftError].filter(Boolean).join(' / ')}`);
      continue;
    }
    if (!written) { console.log('  (dry-run — 쓰지 않음)'); continue; }
    const todo = [
      !entry.level && `level(${JP_LEVELS.join('·')})`,
      entry.rights.status !== 'approved' && 'rights 기록(도서 카드 확인 후 --approve <역할>)',
      !entry.publishedYear && 'publishedYear(초출 연도 — 색인·판권에 없음)',
      !entry.display.titleReading && 'display.titleReading(가나)',
      !entry.display.titleKo && 'display.titleKo(원제 직역)',
      !entry.display.authorKo && 'display.authorKo(외래어 표기법)',
      !entry.display.cover && 'display.cover(새 색 — literatureDisplay 팔레트)',
      !entry.display.motif && 'display.motif(새 표지 문양 — LiteratureCoverArt)',
    ].filter(Boolean);
    console.log(`  ✓ ${path.relative(ROOT, base)}/ 에 source.txt·entry.json`);
    if (todo.length) console.log(`  남은 일: ${todo.join(' · ')}`);
  }
  console.log('\n다음: 남은 칸을 채운 뒤 node scripts/build-literature.mjs → npm test');
  process.exit(failed ? 1 : 0);
}
