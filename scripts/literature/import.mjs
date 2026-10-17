#!/usr/bin/env node
/**
 * 정본 책 가져오기 — 카탈로그 한 줄로 받기부터 다듬기 점검까지(LIT-IMPORT-1, 오너 「언제든 불러오고 사용자들이 실사용 할 수 있을 정도로
 * 다듬는 과정까지 모두 프로세스 최적화」 2026-10-17 KST). 출처마다 따로 있던 네 명령(add-work · se-add-work · ws-add-work · pd-add-work)과
 * 손으로 쓰던 entry.json 칸(제목 · 작가 · 연도 · 원산국 · 번역자 · 권리 · 한국어 표기 · 표지 · parse)을 하나로 묶는다.
 *
 *   node scripts/literature/import.mjs --list [--country GB] [--status loadable]   카탈로그 보기(나라 · 상태별)
 *   node scripts/literature/import.mjs <카탈로그 id>                               한 편 가져오기
 *   node scripts/literature/import.mjs --next 3 [--country FR]                    아직 안 넣은 인기작 앞에서부터 N편
 *   … --dry-run  권리 · 표지 · 위치 검사만(받지도 쓰지도 않는다) · --accept-parse  추정 parse의 버리는 머리글을 사람이 확인했다
 *
 * 순서(어느 단계든 걸리면 멈추고 무엇을 고칠지 말한다 — fail-closed):
 *   ① 카탈로그 줄 검사 → ② 한국 공개 판정(rightsKorea · 번역본은 번역자까지) → ③ 표지 표기(실물 조사 또는 시대 · 언어 틀 — 장정 규칙 검사)
 *   → ④ 출처 받기(기존 명령 그대로 — 판 고정 · 해시) → ⑤ entry.json 채우기(사람 칸 없음 · 아오조라는 표지 문양만 남는다)
 *   → ⑥ 빌드 → ⑦ 장 점검(literatureLint — 오류가 있으면 멈춘다) → ⑧ 카탈로그 줄을 「수록」(key만 가리킴)으로.
 * 그다음(사람 · 관리자): PR 병합 → 관리자 화면 「준비 안 된 N편 모두 게시·분석」 → 묶음 검수 → 공개(docs/literature-pipeline.md §9).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogEntryProblems, catalogRightsVerdict, checkedCover } from '../lib/literature-catalog.mjs';
import { translatorRecords } from '../../src/lib/rightsKorea.js';
import { createPdSiteDraft, inferPdSiteParse, pdSiteParseReport } from '../../src/lib/pdSite.js';
import { inspectChapters, printInspection, workDir } from './inspect.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CATALOG_PATH = path.join(ROOT, 'src/content/literature/catalog.json');
const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const args = process.argv.slice(2);
const flag = (name) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const has = (name) => args.includes(`--${name}`);

export const readCatalog = () => JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const writeCatalog = (catalog) => writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);

function run(script, scriptArgs) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script), ...scriptArgs], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  if (result.status !== 0) throw new Error(`${script} 실패(${result.status})`);
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

/** 권리 기록 — 검토일 · 관할(원산국 · 번역 원산국 · 한국). 판정이 통과한 뒤에만 approved. */
function rightsRecord(entry, reviewedAt) {
  return {
    status: 'approved', basis: 'public-domain',
    reviewedJurisdictions: [...new Set([entry.countryOfOrigin, ...translatorRecords(entry.translator).map((item) => item.countryOfOrigin), 'KR'].filter(Boolean))],
    reviewer: 'claude', reviewedAt,
  };
}

/** 받은 뒤 entry.json의 사람 칸을 카탈로그로 채운다(출처별 모양 그대로 — 빌드 검사가 같은 entry를 읽는다). */
function fillEntry(entry, cover, reviewedAt) {
  const dir = workDir(entry.key);
  const file = path.join(dir, 'entry.json');
  const current = readJson(file);
  const facts = {
    title: entry.title, author: entry.author, level: entry.level,
    publishedYear: entry.publishedYear, authorDeathYear: entry.authorDeathYear, countryOfOrigin: entry.countryOfOrigin,
    ...(entry.translator ? { translator: entry.translator } : {}),
  };
  switch (entry.source.provider) {
    case 'standardebooks':
      // se-add-work가 제목 · 작가(판 메타) · 권리(approved)를 이미 썼다 — 레벨 · 표지만
      writeJson(file, { ...current, level: entry.level, display: cover });
      break;
    case 'wikisource': {
      const { files, ...rest } = current;
      writeJson(file, {
        ...rest, ...facts, mortPourLaFrance: entry.countryOfOrigin === 'FR' ? entry.mortPourLaFrance ?? false : null,
        ...(entry.source.chapterHeading ? { chapterHeading: entry.source.chapterHeading } : {}),
        rights: rightsRecord(entry, reviewedAt), display: cover, files,
      });
      break;
    }
    case 'pdsite': {
      const { file: source, ...rest } = current;
      writeJson(file, { ...rest, ...facts, language: entry.language, rights: rightsRecord(entry, reviewedAt), display: cover, parse: entry.parse, file: source });
      break;
    }
    case 'aozora': {
      const display = { ...current.display, titleKo: entry.titleKo, authorKo: entry.authorKo, ...(entry.aozoraCover ?? {}) };
      writeJson(file, { ...current, level: entry.level, display });
      break;
    }
    default: throw new Error(`모르는 출처 ${entry.source.provider}`);
  }
}

/** 전자책 사이트 parse — 카탈로그에 있으면 그것, 없으면 판 머리글로 추정 + 버리는 머리글 보고(사람이 한 번 본다). */
function resolvePdParse(entry) {
  const dir = workDir(entry.key);
  const current = readJson(path.join(dir, 'entry.json'));
  const html = new TextDecoder(current.file.encoding).decode(readFileSync(path.join(dir, 'source', current.file.path)));
  if (entry.source.parse) return entry.source.parse;
  const parse = inferPdSiteParse(html);
  if (!parse) throw new Error('parse를 추정하지 못했다(장 머리글이 고르지 않다) — 카탈로그 source.parse에 start · stop · chapter를 적는다');
  const report = pdSiteParseReport(html, parse);
  const harmless = new RegExp(`^(?:${[entry.title, entry.author, 'Contents', 'Table of Contents', 'by', 'Published \\d{4}'].map((text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')})$`, 'iu');
  const dropped = report.leadHeadings.filter((heading) => !harmless.test(heading));
  console.log(`  parse 추정: ${JSON.stringify(parse)}\n  버리는 앞글 ${report.leadWords}단어 · 머리글 ${JSON.stringify(report.leadHeadings)} · 장으로 안 잡힌 머리글 ${JSON.stringify(report.strayHeadings)}`);
  if ((dropped.length || report.strayHeadings.length) && !has('accept-parse')) {
    throw new Error('추정 parse가 머리글을 버리거나 못 잡았다 — 싣지 않을 앞글이면 --accept-parse, 장으로 넣을 머리글이면 카탈로그 source.parse를 고친다');
  }
  return parse;
}

function fetchSource(entry) {
  const s = entry.source;
  switch (s.provider) {
    case 'standardebooks':
      run('scripts/literature/se-add-work.mjs', [s.repo, '--published', String(entry.publishedYear), '--death', String(entry.authorDeathYear), '--origin', entry.countryOfOrigin,
        '--level', entry.level, '--title-ko', entry.titleKo, '--author-ko', entry.authorKo, '--approve', 'claude',
        ...(Array.isArray(entry.translator) ? ['--translators', JSON.stringify(entry.translator)]
          : entry.translator ? ['--translated', String(entry.translator.publishedYear), '--translator-death', String(entry.translator.deathYear), '--translator-origin', entry.translator.countryOfOrigin] : []),
        ...(s.exclude?.length ? ['--exclude', s.exclude.join(',')] : [])]);
      break;
    case 'wikisource':
      run('scripts/literature/ws-add-work.mjs', ['--wiki', s.wiki, '--key', entry.key, '--main', s.main, '--resume',
        ...(s.pattern ? ['--pattern', s.pattern] : []), ...(s.section ? ['--section', s.section] : []), ...(s.collection ? ['--collection'] : []),
        ...(s.wiki === 'zh' ? ['--variants', 'zh-hans,zh-hant'] : [])]);
      break;
    case 'pdsite':
      run('scripts/literature/pd-add-work.mjs', ['--site', s.site, ...(s.site === 'fp' ? ['--id', s.id] : ['--path', s.path]), '--key', entry.key]);
      break;
    case 'aozora':
      run('scripts/literature/add-work.mjs', [String(s.workId), '--level', entry.level, '--approve', 'claude']);
      break;
    default: throw new Error(`모르는 출처 ${s.provider}`);
  }
}

/** 한 편 가져오기 — 결과 요약을 돌려준다(시뮬레이션 · 묶음 보고가 쓴다). */
export function importEntry(entry, { dryRun = false } = {}) {
  const reviewedAt = todayKst();
  const problems = catalogEntryProblems(entry);
  if (problems.length) throw new Error(`카탈로그 줄 ${entry.id}: ${problems.join(' · ')}`);
  if (entry.status === 'blocked') throw new Error(`${entry.id}: 막힘 — ${entry.blocker}`);
  const verdict = catalogRightsVerdict(entry, reviewedAt);
  if (!verdict.ok) throw new Error(`${entry.id}: 한국 공개 불가 — ${verdict.reasons.join(' / ')}`);
  const cover = entry.source.provider === 'aozora' ? null : checkedCover(entry);
  console.log(`■ ${entry.id} → ${entry.key} · ${entry.title} · ${entry.author} · 권리 ${verdict.basis}${translatorRecords(entry.translator).map((item) => ` · 번역 ${item.name}`).join('')} · 표지 ${cover?.binding ?? '시리즈 A(아오조라)'}`);
  if (dryRun) return { id: entry.id, key: entry.key, dryRun: true, cover: cover?.binding ?? null, basis: verdict.basis };
  fetchSource(entry);
  if (entry.source.provider === 'pdsite') entry = { ...entry, parse: resolvePdParse(entry) };
  fillEntry(entry, cover, reviewedAt);
  const build = spawnSync(process.execPath, [path.join(ROOT, 'scripts/build-literature.mjs')], { cwd: ROOT, encoding: 'utf8' });
  const failed = (build.stdout + build.stderr).split('\n').filter((line) => line.includes(entry.key) && /^\s+- /u.test(line));
  if (failed.length) throw new Error(`빌드 실패 — ${failed.join(' / ')}`);
  const chaptersFile = path.join(workDir(entry.key), 'chapters.json');
  if (!existsSync(chaptersFile)) {
    if (entry.source.provider === 'aozora') return { id: entry.id, key: entry.key, pending: 'aozora 표지 문양(display.motif) — 오너 결정: 작품마다 새 문양' };
    throw new Error('빌드가 chapters.json을 쓰지 않았다');
  }
  const built = readJson(chaptersFile);
  const summary = printInspection(built, { list: false });
  if (summary.error) throw new Error(`장 점검 오류 ${summary.error}건 — node scripts/literature/inspect.mjs ${entry.key}로 보고 파서 · parse를 고친다`);
  const { sizes } = inspectChapters(built.chapters, built.book);
  return { id: entry.id, key: entry.key, chapters: built.chapters.length, sizes, warn: summary.warn, cover: cover?.binding ?? null, basis: verdict.basis };
}

/** 수록 줄 → 작품 폴더의 한국어 표기(목록 보기용). */
function shelved(entry) {
  if (entry.status !== '수록') return entry;
  const file = path.join(workDir(entry.key), 'entry.json');
  const facts = existsSync(file) ? readJson(file) : {};
  return { ...entry, titleKo: facts.display?.titleKo ?? facts.title ?? entry.key, authorKo: facts.display?.authorKo ?? facts.author ?? '' };
}

function list() {
  const catalog = readCatalog();
  const rows = catalog.works.map(shelved).filter((entry) => (!flag('country') || entry.country === flag('country')) && (!flag('status') || entry.status === flag('status')));
  const countries = [...new Set(rows.map((entry) => entry.country))];
  for (const country of countries) {
    const mine = rows.filter((entry) => entry.country === country);
    console.log(`── ${country} (${mine.length}) ──`);
    for (const entry of mine) console.log(`  ${entry.status === '수록' ? '●' : entry.status === 'loadable' ? '○' : '×'} ${entry.id.padEnd(38)} ${entry.titleKo} — ${entry.authorKo}${entry.status === 'blocked' ? `  [${entry.blocker}]` : ''}`);
  }
}

function main() {
  if (has('list')) return list();
  const catalog = readCatalog();
  const nextCount = Number(flag('next') || 0);
  const id = args.find((arg) => !arg.startsWith('--') && !Object.values({ c: flag('country'), s: flag('status'), n: flag('next') }).includes(arg));
  const queue = nextCount
    ? catalog.works.filter((entry) => entry.status === 'loadable' && (!flag('country') || entry.country === flag('country'))).slice(0, nextCount)
    : catalog.works.filter((entry) => entry.id === id);
  if (!queue.length) { console.error('사용: import.mjs --list | <카탈로그 id> | --next N [--country XX] [--dry-run] [--accept-parse]'); process.exit(1); }
  const results = [];
  for (const entry of queue) {
    try {
      const result = importEntry(entry, { dryRun: has('dry-run') });
      results.push(result);
      if (!has('dry-run') && !result.pending) {
        // 수록되면 사실은 작품 폴더(entry.json)가 정본 — 줄은 가리키기만 남긴다(두 곳에 적어 어긋나지 않게).
        const at = catalog.works.findIndex((item) => item.id === entry.id);
        catalog.works[at] = { id: entry.id, key: entry.key, status: '수록', country: entry.country };
        writeCatalog(catalog);
      }
    } catch (error) {
      results.push({ id: entry.id, error: error.message });
      console.error(`✗ ${entry.id}: ${error.message}`);
    }
  }
  console.log(`\n결과: ${results.filter((item) => !item.error).length}/${results.length}편`);
  for (const item of results) console.log(`  ${item.error ? '✗' : item.pending ? '…' : '✓'} ${item.id}${item.error ? ` — ${item.error}` : item.pending ? ` — 남은 일: ${item.pending}` : item.dryRun ? ` (검사만 · 표지 ${item.cover ?? '-'})` : ` — ${item.chapters}장 · 경고 ${item.warn} · 표지 ${item.cover ?? '시리즈 A'}`}`);
  process.exit(results.some((item) => item.error) ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
export { createPdSiteDraft };
