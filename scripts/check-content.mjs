#!/usr/bin/env node
/**
 * 콘텐츠 무결성 린트 — prebuild에서 실행되어 회귀를 막는다.
 * 하드 실패(exit 1): 슬러그 중복, 끊어진 ch 링크, 문형 사전 필수 필드(pattern/ko/ex/ex2) 누락,
 *                    patternKo 없는 챕터 패턴, (ja) 요미가나 정렬 실패
 * 소프트 경고:       챕터 퀴즈 최소 요건 미달(표현문항<2·예문<4), 어휘 예문률 70% 미만
 * 사용: node scripts/check-content.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const LANGS = {
  japanese: { g: ['ot', 'n5', 'n4', 'n3', 'n2', 'n1'], b: ['n5', 'n4', 'n3', 'n2', 'n1'], v: ['n5', 'n4', 'n3', 'n2', 'n1'] },
  english:  { g: ['ot', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'], b: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'], v: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] },
  french:   { g: ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'], b: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'], v: ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'] },
  chinese:  { g: ['ot', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], b: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], v: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] },
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
  // vocab은 보강 파일(n5_jlpt_a 등)까지 전부 — 하드코딩 목록이면 신규 파일이 감시망 밖으로 샌다.
  ...readdirSync('src/content/japanese/vocab').filter(f => f.endsWith('.js')).map(f => `src/content/japanese/vocab/${f}`),
];
let furiFail = 0;
for (const f of jaFiles) {
  const r = spawnSync('node', ['scripts/check-furigana.mjs', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    furiFail++;
    errors.push(`[furigana] ${f}:\n${(r.stdout || '').trim()}`);
  }
}


// ── 챕터→어휘 커버리지 회귀 가드 (en/fr) ──
// 규칙: 챕터 예문의 내용어는 같은 레벨 이하 어휘 사전에 수록되어야 한다.
// 휴리스틱 잔여(활용형·고유명사 등)가 있으므로, 기준선 초과 시에만 경고한다.
const EN_STOP = new Set(`a an the this that these those i you he she it we they me him her us them my your his its our their mine yours hers ours theirs myself yourself himself herself itself ourselves themselves yourselves who whom whose which what where when why how is are was were be been being am do does did done doing have has had having will would shall should can could may might must let lets not no nor and or but so yet for of in on at by to from with without about against between into through during before after above below up down out off over under again further then once here there all any both each few more most other some such only own same than too very just if because as until while s t don didn doesn isn aren wasn weren hasn haven hadn won wouldn shouldn couldn mustn needn ll ve re d m im id ive youre hes shes its were theyre`.split(/\s+/));
const FR_STOP = new Set(`le la les un une des du de d l au aux et ou mais donc or ni car que qu qui quoi dont où je tu il elle on nous vous ils elles me te se m t s moi toi lui leur eux y en ne pas plus jamais rien personne mon ma mes ton ta tes son sa ses notre nos votre vos leurs ce cet cette ces ça cela ceci est sont était étaient été être suis es sommes êtes serai sera seront serait a ont avait avaient eu avoir ai as avons avez aura auront aurait dans sur sous avec sans pour par chez vers entre depuis pendant avant après très bien là ici si oui non aussi comme alors quand parce`.split(/\s+/));

const COVER = {
  english: { field: 'en', stop: EN_STOP, otPool: 'a1',
    // 기준선: 2026-06 전수 수록 후 잔여 노이즈 + 여유 10
    base: { ot: 18, a1: 26, a2: 50, b1: 49, b2: 58, c1: 44, c2: 45 },
    lemmas: w => { const o = [w]; if (w.endsWith('ies')) o.push(w.slice(0,-3)+'y'); if (w.endsWith('es')) o.push(w.slice(0,-2)); if (w.endsWith('s')) o.push(w.slice(0,-1)); if (w.endsWith('ed')) o.push(w.slice(0,-2), w.slice(0,-1)); if (w.endsWith('ing')) o.push(w.slice(0,-3), w.slice(0,-3)+'e'); return o; },
    tokenize: t => (t.toLowerCase().match(/[a-z']+/g) || []).map(w => w.replace(/^'+|'+$/g, '')) },
  french: { field: 'fr', stop: FR_STOP, otPool: null,
    base: { a0: 20, a1: 40, a2: 72, b1: 107, b2: 95, c1: 60, c2: 65 },
    lemmas: w => { const o = [w]; if (w.endsWith('s')) o.push(w.slice(0,-1)); if (w.endsWith('e')) o.push(w.slice(0,-1)+'er'); if (w.endsWith('es')) o.push(w.slice(0,-2)+'er'); if (w.endsWith('ent')) o.push(w.slice(0,-3)+'er'); if (/ée?s?$/.test(w)) o.push(w.replace(/ée?s?$/, 'er')); return o; },
    tokenize: t => (t.toLowerCase().replace(/['\u2019]/g, "'").match(/[a-zàâçéèêëîïôùûüœæ'-]+/g) || []).flatMap(w => w.split(/['-]/)).filter(Boolean) },
};

for (const [lang, cv] of Object.entries(COVER)) {
  const cfg = LANGS[lang];
  const vocabSets = {};
  for (const lv of cfg.v) {
    const m = await import(new URL(`${lang}/vocab/${lv}.js`, root));
    const set = new Set();
    for (const w of (m.default.themes || []).flatMap(t => t.words || []))
      for (const tok of cv.tokenize(w[cv.field] || '')) if (!cv.stop.has(tok)) set.add(tok);
    vocabSets[lv] = set;
  }
  for (const lv of cfg.g) {
    const idx = cfg.v.indexOf(lv === 'ot' ? cv.otPool : lv);
    const pool = new Set();
    for (let i = 0; i <= Math.max(idx, 0); i++) for (const w of vocabSets[cfg.v[i]]) pool.add(w);
    const m = await import(new URL(`${lang}/grammar/${lv}.js`, root));
    const missing = new Set();
    for (const ch of m.default)
      for (const ex of (ch.sections || []).flatMap(sec => sec.examples || [])) {
        const text = ex[cv.field]; if (!text) continue;
        for (const tok of cv.tokenize(text)) {
          if (tok.length < 2 || cv.stop.has(tok)) continue;
          if (!cv.lemmas(tok).some(l => pool.has(l))) missing.add(tok);
        }
      }
    const allow = cv.base[lv] ?? 0;
    if (missing.size > allow)
      warns.push(`[${lang}/${lv}] 챕터 어휘 커버리지 회귀 — 미수록 후보 ${missing.size} > 기준선 ${allow} (새 예문 단어를 어휘 사전에 추가하세요)`);
  }
}

for (const w of warns) console.warn('⚠', w);
for (const e of errors) console.error('✗', e);
console.log(`\n콘텐츠 린트 — 오류 ${errors.length} · 경고 ${warns.length} (요미가나 검사 ${jaFiles.length}파일 중 실패 ${furiFail})`);
process.exit(errors.length ? 1 : 0);
