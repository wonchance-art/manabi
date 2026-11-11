// 넓힌 검사: 공개 고정표 한자 판정 134어 + 원고 어휘 한자 판정 + 승인된 어휘 목록 밖 낱말이 1단계 문자열에 가나로 남았나
//   (활용형 · 앞 낱말에 붙은 명사 포함). 실행: node scripts/textbooks/ja-n5-stage1-check.mjs <repo> <raw.json> <blocked.txt> <check.json>
import '../eval/productImportHooks.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const [,, root, p3, blockedF, outF] = process.argv;
const { stems } = await import(root + '/scripts/ja-kanji-a2.mjs');
const spec = JSON.parse(readFileSync(root + '/supabase/data/ja-kanji-a2-n5.json', 'utf8'));
const M = JSON.parse(readFileSync(root + '/src/content/textbookEditions/8a8c1c1fd452773810abaf8c/bundle.json', 'utf8')).manuscript;
const j = JSON.parse(readFileSync(p3, 'utf8'));
const blocked = new Set(readFileSync(blockedF, 'utf8').split('\n').filter(Boolean));
const readingRows = new Set(j.readingRows.map((r) => r.path));
const conjRows = new Set((j.conjugationRows || []).map((r) => r.path));
const FIELD = /^lessons\.(\d+)\.(dialog\.\d+\.ja|patterns\.\d+\.examples\.\d+\.ja|words\.\d+\.ja|writing_sample\.ja|study_pages\.\d+\.rows\.\d+\.ja|study_pages\.\d+\.examples\.\d+\.ja|extra_patterns\.\d+\.examples\.\d+\.ja|reading)$/;
const all = [];
const walk = (v, p) => { if (typeof v === 'string') { if (FIELD.test(p)) all.push([p, v]); return; } if (Array.isArray(v)) v.forEach((x, i) => walk(x, p + '.' + i)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, p + '.' + k); };
M.lessons.forEach((l, i) => { if (i >= 9) walk(l, 'lessons.' + i); });
const src = new Map();
for (const [, [text, kana]] of Object.entries(spec.a2.write)) src.set(kana, { text, kana, from: '공개 표' });
for (const d of j.kanjiTable) if (!src.has(d.ja)) src.set(d.ja, { text: d.spelling, kana: d.ja, from: '원고 어휘 · 승인' });
const pats = [...src.values()].map((x) => { const [ks, rs] = stems(x.text, x.kana); const infl = /[るうくぐすつぬぶむい]$/.test(x.text) && x.text !== ks && !/^[一二三四五六七八九十]/.test(x.text); return { ...x, rs: infl ? rs : x.kana, infl }; }).filter((x) => [...x.rs].length >= 2 && /^[ぁ-ゟ]+$/.test(x.rs));
// 예외: 기록된 보류 자리(동음이의 · 동음어 · 지도 충돌 등)와 가나 유지 낱말
const held = new Map(); const recs = [];
for (const h of j.review.homonym) if (!h.applied) recs.push({ path: h.path, tok: h.word, why: '동음이의 보류' });
for (const u of j.review.uncertain) if (!u.chosen || /가나/.test(u.kind)) for (const pth of String(u.path).split(' · ')) recs.push({ path: pth, tok: u.token || (u.before.length < 12 ? u.before : ''), why: u.kind });
for (const h of j.review.homonym) if (!h.applied) held.set(h.path + '|' + h.word, '동음이의 보류');
for (const u of j.review.uncertain) if (!u.chosen) for (const a of u.alternatives || []) held.set(u.path + '|' + a, u.kind);
const FALSE_NEXT = { いま: /^[すせ]/, あそ: /^こ/, なか: /^$/ };
const hits = [];
for (const [path, before] of all) {
  if (blocked.has(path) || readingRows.has(path) || conjRows.has(path)) continue;
  const after = j.patch[path] ?? before;
  const plain = after.replace(/\{[^{}|]+\|[^{}|]+\}/g, '□');
  for (const x of pats) {
    let i = -1;
    while ((i = plain.indexOf(x.rs, i + 1)) >= 0) {
      const prev = plain[i - 1] || ''; if (prev && !/[\s、。「（(お ご]/.test(prev)) continue;
      const next = plain.slice(i + x.rs.length);
      if (x.kana === 'いま' && /^[すせ]/.test(next)) continue;
      const fp = (x.kana === 'なか' && prev === 'お') ? '검사 오탐: おなか(가나 유지)' : (x.rs === 'はい' && /^て/.test(next) && /くつ|靴|□を/.test(plain.slice(Math.max(0, i - 6), i))) ? '검사 오탐: 履いて(다른 낱말 · 어휘 목록 밖)' : null;
      if (fp) { hits.push({ path, word: x.text, kana: x.kana, from: x.from, exception: fp, ctx: plain.slice(Math.max(0, i - 8), i + x.rs.length + 8) }); continue; }
      if (x.rs === 'あそ' && /^こ/.test(next)) continue;
      if (prev === 'お' && !/^お/.test(x.text) && !['ご'].includes(prev)) { if (!/^[ぁ-ゟ]/.test(plain[i - 2] || ' ') ) {} else continue; }
      if (!x.infl && /^[ぁ-ゟ]/.test(next) && !/^[のがをはにでともへやかなだじ]/.test(next)) continue;
      if (x.infl && !/^[ぁ-ゟ]/.test(next)) continue;
      if (/^[一二三四五六七八九十]/.test(x.text) && x.text.length <= 2) continue;
      const why = held.get(path + '|' + x.text) || recs.find((r) => r.path === path && r.tok && (r.tok.startsWith(x.rs) || x.kana.startsWith(r.tok)))?.why || null;
      hits.push({ path, word: x.text, kana: x.kana, from: x.from, exception: why, ctx: plain.slice(Math.max(0, i - 8), i + x.rs.length + 8) });
    }
  }
}

// 보강 ①: 한자로 정한 용언의 활용형 가나(어간 + 어미) — 분석기 분할 없이 원문을 직접 훑는다
// 보강 ②: 한자로 정한 명사가 앞 낱말에 붙은 자리(のまえに · たあとで · ～のしかた)
const KEEP_EXPR = /^(すみません|いけません|いただきます|ください|おねがい|いいえ|いい)/;
const lexPosOf = new Map(M.lexicon.map((e) => [e.ja, e.pos || '']));
const GODAN_RU = new Set(['かえる', 'はいる', 'しる', 'はしる', 'きる', 'いる', 'かかる', 'おわる', 'まがる', 'とまる', 'しまる', 'わかる', 'ある', 'つくる', 'のる', 'とる', 'うる', 'すわる', 'がんばる', 'あがる', 'さがる', 'なる', 'はじまる', 'ふる', 'おくる']);
const R5 = { う: 'わいうえお', く: 'かきくけこ', ぐ: 'がぎぐげご', す: 'さしすせそ', つ: 'たちつてと', ぬ: 'なにぬねの', ぶ: 'ばびぶべぼ', む: 'まみむめも', る: 'らりるれろ' };
const O5 = { う: 'っ', つ: 'っ', る: 'っ', く: 'い', ぐ: 'い', む: 'ん', ぶ: 'ん', ぬ: 'ん', す: 'し' };
const ET = '(?=[\\s、。」]|こと|とき|前|まえ|の|まで|から|か|よ|ね|です|$)';
const skipW = new Set([...(j.review.homonym || []).map((h) => h.word)]);
const infl = [];
for (const x of src.values()) {
  if (!/[一-鿿]/.test(x.text) || skipW.has(x.kana) || ['くる', 'する', 'いる', 'ある'].includes(x.kana)) continue;
  const L = x.kana.slice(-1); const stem = x.kana.slice(0, -1); const pos = lexPosOf.get(x.kana) || '';
  let alt = null;
  if (L === 'い' && /[一-鿿]い$/.test(x.text) && !/동사/.test(pos)) alt = `(?:い${ET}|く(?:ない|なかった|て|なり)|かった)`;
  else if (L === 'る' && (/동사\(2\)/.test(pos) || (!/동사\(1\)/.test(pos) && !GODAN_RU.has(x.kana) && /[いきぎしじちにひびみりえけげせぜてでねへべめれ]$/.test(stem)))) alt = `(?:ます|ません|ましょう|ました|たい|たく|ない|なかった|ないで|て|た|ながら|る${ET})`;
  else if (R5[L] && /[一-鿿]/.test(x.text) && /[るうくぐすつぬぶむ]$/.test(x.text)) { const r = R5[L]; alt = `(?:${r[1]}(?:ます|ません|ましょう|ました|たい|たく|ながら)|${r[0]}(?:ない|なかった|ないで)|${O5[L]}(?:て|た|で|だ)|${L}${ET})`; }
  if (!alt || !stem) continue;
  infl.push({ ...x, re: new RegExp(`(?<=^|[\\s、。「（/])${stem}${alt}`, 'g') });
}
const nouns = [...src.values()].filter((x) => !/[るうくぐすつぬぶむい]$/.test(x.text) && /^[ぁ-ゟ]{2,}$/.test(x.kana));
for (const [path, before] of all) {
  if (blocked.has(path) || readingRows.has(path) || conjRows.has(path)) continue;
  const after = j.patch[path] ?? before;
  const plain = after.replace(/\{[^{}|]+\|[^{}|]+\}/g, '□');
  for (const x of infl) {
    for (const m of plain.matchAll(x.re)) {
      if (KEEP_EXPR.test(plain.slice(m.index))) continue;
      const why = recs.find((r) => r.path === path && r.tok && (m[0].startsWith(r.tok) || r.tok.startsWith(m[0].slice(0, 2))))?.why || null;
      hits.push({ path, word: x.text, kana: x.kana, from: x.from, check: '활용형', exception: why, ctx: plain.slice(Math.max(0, m.index - 6), m.index + m[0].length + 6) });
    }
  }
  for (const x of nouns) {
    let i = -1;
    while ((i = plain.indexOf(x.kana, i + 1)) >= 0) {
      const prev = plain[i - 1] || '';
      if (!/[のるた]/.test(prev)) continue;
      const next = plain.slice(i + x.kana.length);
      if (!/^[にでのはがを]/.test(next)) continue;
      const why = recs.find((r) => r.path === path && r.tok && r.tok.includes(x.kana))?.why || null;
      hits.push({ path, word: x.text, kana: x.kana, from: x.from, check: '붙은 명사', exception: why, ctx: plain.slice(Math.max(0, i - 6), i + x.kana.length + 6) });
    }
  }
}
const fail = hits.filter((h) => !h.exception); const exc = hits.filter((h) => h.exception);
writeFileSync(outF, JSON.stringify({ total: hits.length, fail: fail.length, exceptions: exc.length, failList: fail, exceptionList: exc }, null, 1));
console.log('hits', hits.length, 'fail', fail.length, 'exc', exc.length);
const by = new Map(); for (const h of fail) by.set(h.word, (by.get(h.word) || []).concat(h));
for (const [w, hs] of [...by].sort((a, b) => b[1].length - a[1].length)) console.log(' FAIL', w, hs.length, '|', hs.slice(0, 3).map((h) => h.path.split('.').slice(1, 3).join('.') + ':' + h.ctx).join(' ‖ '));
const be = new Map(); for (const h of exc) be.set(h.word + ' · ' + h.exception, (be.get(h.word + ' · ' + h.exception) || 0) + 1);
for (const [k, n] of be) console.log(' EXC', k, n);
