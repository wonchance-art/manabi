#!/usr/bin/env node
/**
 * 콘텐츠 무결성 린트 — prebuild에서 실행되어 회귀를 막는다.
 * 하드 실패(exit 1): 슬러그 중복, 끊어진 ch 링크, 문형 사전 필수 필드(pattern/ko/ex/ex2) 누락,
 *                    patternKo 없는 챕터 패턴, (ja) 요미가나 정렬 실패
 * 소프트 경고:       챕터 퀴즈 최소 요건 미달(표현문항<2·예문<4), 어휘 예문률 70% 미만
 * 사용: node scripts/check-content.mjs
 */
import { spawnSync } from 'node:child_process';

const LANGS = {
  japanese: { g: ['ot', 'n5', 'n4', 'n3', 'n2', 'n1'], b: ['n5', 'n4', 'n3', 'n2', 'n1'], v: ['n5', 'n4', 'n3', 'n2', 'n1'] },
  english:  { g: ['ot', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'], b: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'], v: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] },
  french:   { g: ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'], b: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'], v: ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'] },
};
const root = new URL('../src/content/', import.meta.url);

const errors = [];
const warns = [];

for (const [lang, cfg] of Object.entries(LANGS)) {
  // ── 챕터: 슬러그 중복 + 퀴즈 최소 요건 + patternKo ──
  const slugs = new Set();
  for (const lv of cfg.g) {
    const m = await import(new URL(`${lang}/grammar/${lv}.js`, root));
    for (const ch of m.default) {
      if (slugs.has(ch.slug)) errors.push(`[${lang}/${lv}] 슬러그 중복: ${ch.slug}`);
      slugs.add(ch.slug);
      const own = (ch.sections || []).filter(s => s.pattern && s.patternKo).length;
      const noKo = (ch.sections || []).filter(s => s.pattern && !s.patternKo).length;
      const exs = (ch.sections || []).flatMap(s => s.examples || []).filter(e => e && e.ko).length;
      if (noKo > 0) errors.push(`[${lang}/${lv}] ${ch.slug}: patternKo 없는 패턴 ${noKo}개`);
      if (own < 2) warns.push(`[${lang}/${lv}] ${ch.slug}: 퀴즈 표현 문항 부족 (${own})`);
      if (exs < 4) warns.push(`[${lang}/${lv}] ${ch.slug}: 예문 부족 (${exs})`);
    }
  }
  // ── 문형 사전: ch 유효성 + 필수 필드 ──
  for (const lv of cfg.b) {
    const m = await import(new URL(`${lang}/bunkei/${lv}.js`, root));
    for (const t of m.default.themes || []) {
      for (const it of t.items || []) {
        const id = `[${lang}/bunkei/${lv}] ${it.pattern || '(패턴 없음)'}`;
        if (!it.pattern) errors.push(`${id}: pattern 누락`);
        if (!it.ko) errors.push(`${id}: ko 누락`);
        if (!it.ex) errors.push(`${id}: ex 누락`);
        if (!it.ex2) errors.push(`${id}: ex2 누락`);
        if (it.ch && !slugs.has(it.ch)) errors.push(`${id}: 끊어진 ch → ${it.ch}`);
      }
    }
  }
  // ── 어휘: 예문률 ──
  for (const lv of cfg.v) {
    const m = await import(new URL(`${lang}/vocab/${lv}.js`, root));
    const words = (m.default.themes || []).flatMap(t => t.words || []);
    if (!words.length) continue;
    const exPct = Math.round(words.filter(w => w.ex).length / words.length * 100);
    if (exPct < 70) warns.push(`[${lang}/vocab/${lv}] 예문률 ${exPct}% (<70%)`);
  }
}

// ── (ja) 요미가나 정렬 — 기존 스크립트를 파일별로 실행 ──
const jaFiles = [
  ...LANGS.japanese.g.map(l => `src/content/japanese/grammar/${l}.js`),
  ...LANGS.japanese.b.map(l => `src/content/japanese/bunkei/${l}.js`),
  ...LANGS.japanese.v.map(l => `src/content/japanese/vocab/${l}.js`),
];
let furiFail = 0;
for (const f of jaFiles) {
  const r = spawnSync('node', ['scripts/check-furigana.mjs', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    furiFail++;
    errors.push(`[furigana] ${f}:\n${(r.stdout || '').trim()}`);
  }
}

for (const w of warns) console.warn('⚠', w);
for (const e of errors) console.error('✗', e);
console.log(`\n콘텐츠 린트 — 오류 ${errors.length} · 경고 ${warns.length} (요미가나 검사 ${jaFiles.length}파일 중 실패 ${furiFail})`);
process.exit(errors.length ? 1 : 0);
