#!/usr/bin/env node
/**
 * 정본 책 한 편 미리보기 · 점검(LIT-IMPORT-1) — 네 출처 공통. 3차 묶음에서 출처마다 따로 쓰던 장 미리보기 스크립트를 하나로 모았다.
 *
 *   node scripts/literature/inspect.mjs <작품 key>            장 목록(분량 · 제목 · 첫머리) + 점검 결과
 *   node scripts/literature/inspect.mjs <작품 key> --chapter 3 장 하나의 글 전체
 *   node scripts/literature/inspect.mjs --all                  모든 작품의 점검 요약(오류 · 경고 수)
 *
 * 빌드된 chapters.json을 읽는다(표지 대기 작품은 빌드가 chapters.json을 쓰지 않으므로 import.mjs가 초안으로 점검한다).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapterSize, lintLiteratureChapters, summarizeLint } from '../../src/lib/literatureLint.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LIT = path.join(ROOT, 'src/content/literature');
export const PROVIDER_DIRS = Object.freeze({ 'aozora-': 'aozora', 'se-': 'standardebooks', 'ws-': 'wikisource', 'pd-': 'pdsite' });
/** 언어별 장 목표 분량(빌드의 나눔 목표 — 영 · 불 단어, 일 · 중 · 한 글자). 점검의 「아주 짧은 장 · 긴 장」 기준. */
export const CHAPTER_TARGETS = Object.freeze({ Japanese: 2500, English: 2200, French: 2200, Chinese: 2500, Korean: 3000 });

export function workDir(key) {
  const prefix = Object.keys(PROVIDER_DIRS).find((item) => key.startsWith(item));
  return prefix ? path.join(LIT, PROVIDER_DIRS[prefix], key) : null;
}

export function inspectChapters(chapters, book) {
  const language = chapters[0]?.metadata?.language;
  const findings = lintLiteratureChapters({ chapters, book, language, target: CHAPTER_TARGETS[language] ?? null });
  const sizes = chapters.map((chapter) => chapterSize(chapter.rawText, language)).sort((a, b) => a - b);
  return { language, findings, summary: summarizeLint(findings), sizes: { min: sizes[0], median: sizes[Math.floor(sizes.length / 2)], max: sizes.at(-1) } };
}

export function printInspection({ chapters, book }, { list = true } = {}) {
  const { language, findings, summary, sizes } = inspectChapters(chapters, book);
  const unit = language === 'English' || language === 'French' ? '단어' : '자';
  console.log(`■ ${book.key} — ${book.title} · ${book.author} · ${language} · ${chapters.length}장 (장당 ${sizes.min}–${sizes.max}${unit}, 가운데 ${sizes.median})`);
  if (list) {
    for (const chapter of chapters) {
      console.log(`  ${String(chapter.order).padStart(3)} ${String(chapterSize(chapter.rawText, language)).padStart(6)}  ${chapter.title} | ${chapter.rawText.slice(0, 60).replace(/\n/gu, ' ⏎ ')}`);
    }
  }
  console.log(`  점검: 오류 ${summary.error} · 경고 ${summary.warn} · 참고 ${summary.info}`);
  for (const finding of findings.filter((item) => item.level !== 'info')) console.log(`   ${finding.level === 'error' ? '✗' : '!'} ${finding.code} 장 ${finding.order ?? '-'} — ${finding.sample}`);
  return summary;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--all')) {
    let errors = 0;
    for (const dir of Object.values(PROVIDER_DIRS)) {
      for (const key of readdirSync(path.join(LIT, dir)).sort()) {
        const file = path.join(LIT, dir, key, 'chapters.json');
        if (!existsSync(file)) continue;
        const { chapters, book } = JSON.parse(readFileSync(file, 'utf8'));
        const { summary } = inspectChapters(chapters, book);
        errors += summary.error;
        if (summary.error || summary.warn) console.log(`${summary.error ? '✗' : '!'} ${key}: 오류 ${summary.error} · 경고 ${summary.warn} — ${Object.keys(summary.byCode).join(' · ')}`);
      }
    }
    console.log(errors ? `✗ 오류 ${errors}건` : '✓ 모든 작품 오류 0');
    process.exit(errors ? 1 : 0);
  }
  const key = args.find((arg) => !arg.startsWith('--'));
  const dir = key && workDir(key);
  if (!dir || !existsSync(path.join(dir, 'chapters.json'))) { console.error('사용: inspect.mjs <작품 key> [--chapter N] | --all (빌드된 작품만)'); process.exit(1); }
  const built = JSON.parse(readFileSync(path.join(dir, 'chapters.json'), 'utf8'));
  const at = args.indexOf('--chapter');
  if (at >= 0) {
    const chapter = built.chapters.find((item) => item.order === Number(args[at + 1]));
    console.log(chapter ? `${chapter.title}\n\n${chapter.rawText}` : '그런 장이 없다');
    return;
  }
  const summary = printInspection(built);
  process.exit(summary.error ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
