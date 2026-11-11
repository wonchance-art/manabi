// N5 「표기만 바꾼 파생 판본」 — 조각 치환(N5-NOTATION-001 1단계, 2026-11-11 KST). 원 N5 도구가 없어 쪽 틀은 다시 그리지 않는다.
// 바탕 판본(운영 8a8c)의 index.html에서, 바뀐 원고 문자열의 옛 렌더(n5Phrase)를 바이트 일치로 찾아 새 렌더로 바꾼다.
//
// 1단계 범위 = 본문 틀로만 렌더되는 필드: 과의 dialog[].ja · patterns[].examples[].ja · words[].ja · writing_sample.ja.
// 그 밖의 필드(답 · 선택지 · 단서 · 힌트 · 해설 — 인라인 틀, 루비 없음)는 2단계(화면 변화 · 목업)라 바뀌면 거절한다.
//
// 계약(하나라도 어긋나면 throw — 출력을 손으로 맞추지 않는다):
//   ⑴ 표기 외 동일(n5-notation-contract.mjs): 구조 · ID · 잠긴 필드 · 지도 키 집합 · 지도 읽기 불변, 모든 문자열의 가나형 동일.
//      → 낱글자 키가 합성어 안에서 틀린 읽기를 달면 가나형이 달라져 여기서 걸린다(그 낱말은 인라인 읽기로 통째 덮는다).
//   ⑵ 새 읽기는 인라인 {바탕|읽기}, 그 과 지도에 이미 있는 키는 지도로(인라인으로 다시 적으면 거절).
//   ⑶ 옛 렌더마다 HTML 출현 수 = 그 렌더를 내는 원고 문자열 수(다른 필드와 같은 렌더를 공유하면 거절) · 치환 뒤 옛 렌더 0.
//   ⑷ 루비 없는 한자: 요소별 (요소 id, 글자) 목록이 바탕과 같다 — 새로 생기지 않는다.
//   ⑸ sourceIndex = 요소별 글(rt 제거) 재계산 — 바탕에서 1,147/1,147 재현을 먼저 확인한다.
//   ⑹ id · data-save · href · data-search 목록이 판본 ID만 빼고 같다(찾아보기는 가나로 계속 찾아진다).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { n5Phrase } from './n5-markup.mjs';
import { misreadWarnings, notationOnlyReport, inlineBases } from './n5-notation-contract.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const manuscriptContent = m => Object.fromEntries(Object.entries(m).filter(([k]) => !['revision', 'source', 'editorialChanges'].includes(k)));
const HAN = /\p{Script=Han}/u;
// 1단계 필드(오케스트레이터 확정 2026-11-11 KST) — 문항이 아닌 본문 틀 필드만. 문항의 선택지 · 답(checks · practice_pages · review_pages)은
// 본문 틀로 그려지더라도 2단계(한 문항 안 선택지 표기를 한꺼번에, options.includes(answer) 일치까지).
export const STAGE1 = [
  /^lessons\.\d+\.dialog\.\d+\.ja$/, /^lessons\.\d+\.patterns\.\d+\.examples\.\d+\.ja$/, /^lessons\.\d+\.words\.\d+\.ja$/, /^lessons\.\d+\.writing_sample\.ja$/,
  // rows[].label은 인라인 틀(<b><span lang="ja">…</span></b>)이라 1단계가 아니다 — 본문 틀 일치처럼 보인 것은 같은 글의 ja 줄과 겹친 우연(실측).
  /^lessons\.\d+\.study_pages\.\d+\.rows\.\d+\.ja$/, /^lessons\.\d+\.study_pages\.\d+\.examples\.\d+\.ja$/,
  /^lessons\.\d+\.extra_patterns\.\d+\.examples\.\d+\.ja$/, /^lessons\.\d+\.reading$/,
];
const KANA = /[\u3040-\u30ff]/u, HANGUL = /[가-힣]/u;
/** 읽기표 줄 — study_pages rows에서 label이 한자 · 숫자(예: 1時 · 月曜日 · 何歳)이고 ja가 그 읽기인 줄. 표기를 바꾸면 읽기표가 깨지므로 1단계가 아니다
 *  (Data 세션 판정 2026-11-11 KST, 121줄). 이런 줄과 같은 렌더를 공유하는 다른 문자열은 「2단계 공유」처럼 함께 빠진다. */
export function isReadingRow(manuscript, path) {
  const m = path.match(/^lessons\.(\d+)\.study_pages\.(\d+)\.rows\.(\d+)\.ja$/);
  if (!m) return false;
  const label = manuscript.lessons[+m[1]]?.study_pages?.[+m[2]]?.rows?.[+m[3]]?.label;
  return typeof label === 'string' && /[\p{Script=Han}\p{Number}]/u.test(label);
}

/**
 * 1단계에서 바꿀 수 있는 원고 문자열(경로)과 빠지는 까닭. 렌더 단위로 묶는다:
 *   - 옛 본문 렌더가 HTML에 없으면(같은 필드라도 인라인 틀로 그려진 줄 — 예: 일부 row label) → 'inline-template'
 *   - 같은 렌더의 HTML 출현 수 > 1단계 문자열 수 → 1단계 밖(2단계 필드 · 읽기표 줄)과 렌더 공유 → 묶음 전체 'shared-with-non-stage1'
 *   - 1–9과(fromLesson 앞) 문자열과 렌더를 공유 → 'shared-with-kana-lessons'
 *   - 같으면 묶음 전체가 대상(여럿이면 함께 · 같은 새 표기로 바꿔야 한다 — deriveNotation이 강제).
 */
export function stage1Eligibility(base, { fromLesson = 1 } = {}) {
  const { bundle, html } = base, rows = [];
  bundle.manuscript.lessons.forEach((lesson, li) => {
    const visit = (v, p) => {
      if (typeof v === 'string') {
        const path = p.join('.');
        if (STAGE1.some(re => re.test(path)) && KANA.test(v) && !HANGUL.test(v) && !isReadingRow(bundle.manuscript, path)) rows.push({ path, text: v, lesson: li, render: n5Phrase(v, lesson.kanji || {}) });
        return;
      }
      if (Array.isArray(v)) v.forEach((x, i) => visit(x, [...p, i])); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'kanji') visit(x, [...p, k]);
    };
    visit(lesson, ['lessons', li]);
  });
  const byRender = new Map(); for (const r of rows) byRender.set(r.render, [...(byRender.get(r.render) || []), r]);
  const eligible = [], excluded = [];
  const unitOf = r => bundle.manuscript.lessons[r.lesson].id;
  for (const [render, group] of byRender) {
    const found = occurrences(html, render);
    // 과별로 나눌 수 있나: 각 과 문자열 수 = 그 과 article 안 출현 수, 과 article 밖 출현 0이면 과마다 따로 바꾼다(같은 가나라도 과마다
    // 다른 낱말 · 다른 지도일 수 있다 — 예: はる 春/貼る, 10과 {今|いま} · 26과 지도 今). 아니면 묶음 전체를 함께.
    const perUnit = occurrencesByUnit(html, render), units = new Map();
    for (const r of group) units.set(unitOf(r), (units.get(unitOf(r)) || 0) + 1);
    const separable = found === group.length && [...units].every(([u, n]) => (perUnit.get(u) || 0) === n) && [...perUnit.keys()].every(u => units.has(u));
    // 1–9과(가나 중심 유지)와 같은 렌더를 공유하면 — 과별로 나눌 수 없을 때만 — 함께 바꿀 수 없어 묶음 전체를 뺀다.
    const kanaLesson = !separable && group.some(g => bundle.manuscript.lessons[g.lesson].number < fromLesson);
    const reason = found === 0 ? 'inline-template' : found > group.length ? 'shared-with-non-stage1' : found < group.length ? 'render-mismatch' : kanaLesson ? 'shared-with-kana-lessons' : null;
    for (const r of group) {
      if (bundle.manuscript.lessons[r.lesson].number < fromLesson) continue;
      const mates = separable ? group.filter(g => g.lesson === r.lesson) : group;
      const entry = { path: r.path, text: r.text, scope: separable ? unitOf(r) : 'book', group: mates.length > 1 ? mates.map(g => g.path) : undefined };
      if (reason) excluded.push({ ...entry, reason }); else eligible.push(entry);
    }
  }
  return { eligible, excluded };
}

const occurrences = (text, needle) => { let n = 0, i = 0; while ((i = text.indexOf(needle, i)) >= 0) { n++; i += needle.length; } return n; };
/** article 구간(data-unit-page) — 중첩 없음(8a8c 실측). 과 단위 치환 · 출현 집계에 쓴다. */
export function articleSpans(html) {
  const spans = [];
  for (const m of html.matchAll(/<article\b([^>]*)>/g)) {
    const end = html.indexOf('</article>', m.index);
    if (end < 0 || html.slice(m.index + 1, end).includes('<article')) throw new Error('article 중첩 — 과 단위 치환 불가');
    spans.push({ unit: m[1].match(/data-unit-page="([^"]*)"/)?.[1] ?? '', start: m.index, end: end + '</article>'.length });
  }
  return spans;
}
function occurrencesByUnit(html, needle) {
  const counts = new Map(); let inside = 0;
  for (const sp of articleSpans(html)) { const n = occurrences(html.slice(sp.start, sp.end), needle); if (n) { counts.set(sp.unit, (counts.get(sp.unit) || 0) + n); inside += n; } }
  const outside = occurrences(html, needle) - inside; if (outside) counts.set('#outside', outside);
  return counts;
}
/** 과(unit)의 article 안에서만 before → after. 바꾼 수를 돌려준다. */
function replaceInUnit(html, unit, before, after) {
  let out = '', last = 0, count = 0;
  for (const sp of articleSpans(html)) {
    if (sp.unit !== unit) continue;
    const slice = html.slice(sp.start, sp.end), n = occurrences(slice, before);
    out += html.slice(last, sp.start) + (n ? slice.split(before).join(after) : slice); last = sp.end; count += n;
  }
  return { html: out + html.slice(last), count };
}

export const stripSource = h => h.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>|<small class="reading-note">[\s\S]*?<\/small>/g, '').replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, e => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[e]));

/** id를 가진 요소의 바깥 HTML(같은 태그 중첩을 센다). */
export function elementById(html, id) {
  const at = html.indexOf(` id="${id}"`);
  if (at < 0) return null;
  const start = html.lastIndexOf('<', at), tag = html.slice(start + 1).match(/^[a-z0-9]+/i)[0];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'gi'); re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) { if (m[0][1] === '/') { if (--depth === 0) return html.slice(start, m.index + m[0].length); } else depth++; }
  return null;
}
export const sourceIndexFrom = (html, previous) => Object.fromEntries(Object.entries(previous).map(([id, entry]) => [id, { ...entry, text: stripSource(elementById(html, id) ?? '') }]));

/** 루비 밖 한자 — lang="ja" span 안, (가장 가까운 id 요소, 글자) 목록. */
export function bareKanji(html) {
  const out = [], stack = [];
  let owner = '';
  // 태그 · 글 토큰을 차례로 — span 쌓기로 lang="ja" 안인지, 가장 최근 id를 소유자로.
  for (const m of html.replace(/<ruby>[\s\S]*?<\/ruby>/g, '').matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    const [, close, tag, rest, text] = m;
    if (text !== undefined) { if (stack.includes(true)) for (const ch of text.match(/\p{Script=Han}/gu) || []) out.push(`${owner}:${ch}`); continue; }
    const id = rest?.match(/ id="([^"]+)"/)?.[1]; if (id) owner = id;
    if (tag.toLowerCase() !== 'span') continue;
    if (close) stack.pop(); else if (!/\/\s*$/.test(rest)) stack.push(/\blang="ja"/.test(rest));
  }
  return out.sort();
}
const attrs = (html, id) => (html.match(/(?:id|data-save|href|data-search)="[^"]*"/g) || []).map(v => v.replaceAll(id, '<edition>'));

export function deriveNotation(base, next, { fromLesson = 10 } = {}) {
  const { bundle, html, app, css } = base;
  const fail = message => { throw new Error(`N5 표기 파생 거절: ${message}`); };
  // ⑸ 바탕 재현
  const again = sourceIndexFrom(html, bundle.sourceIndex);
  const drift = Object.keys(again).filter(id => again[id].text !== bundle.sourceIndex[id].text);
  if (drift.length) fail(`바탕 sourceIndex 재현 실패 ${drift.length}건(${drift.slice(0, 3).join(', ')})`);
  // ⑴ 표기 외 동일
  const report = notationOnlyReport(bundle.manuscript, next);
  if (report.violations.length) fail(`표기 외 변경 ${report.violations.length}건 — ${report.violations.slice(0, 3).map(v => `${v.kind} ${v.path}`).join(' | ')}`);
  // 바뀐 문자열 · 범위 · ⑵ 인라인 규칙
  const changes = [];
  bundle.manuscript.lessons.forEach((lesson, li) => {
    const visit = (a, b, p) => {
      if (typeof b === 'string') { if (a !== b) changes.push({ path: p.join('.'), lesson: li, before: b, after: a }); return; }
      if (Array.isArray(b)) b.forEach((v, i) => visit(a[i], v, [...p, i]));
      else if (b && typeof b === 'object') for (const k of Object.keys(b)) visit(a[k], b[k], [...p, k]);
    };
    visit(next.lessons[li], lesson, ['lessons', li]);
  });
  // 1단계 자격(stage1Eligibility — 필드 · 1–9과 · 렌더 공유)과 묶음 동시 변경
  const { eligible, excluded } = stage1Eligibility(base, { fromLesson });
  const allowed = new Map(eligible.map(e => [e.path, e])), blocked = new Map(excluded.map(e => [e.path, e.reason]));
  const changedTo = new Map(changes.map(c => [c.path, c.after]));
  for (const c of changes) {
    if (!STAGE1.some(re => re.test(c.path))) fail(`1단계 범위 밖 필드 ${c.path}(인라인 틀 · 문항 — 2단계)`);
    if (bundle.manuscript.lessons[c.lesson].number < fromLesson) fail(`${c.path}: ${fromLesson}과 앞은 가나 중심 유지`);
    if (isReadingRow(bundle.manuscript, c.path)) fail(`${c.path}: 읽기표 줄(label의 읽기) — 바꾸지 않는다`);
    if (blocked.has(c.path)) fail(`${c.path}: 1단계 제외(${blocked.get(c.path)})`);
    const entry = allowed.get(c.path);
    if (!entry) fail(`${c.path}: 1단계 자격 목록에 없다`);
    for (const member of entry.group || []) if (changedTo.get(member) !== c.after) fail(`${c.path}: 같은 렌더 묶음(${entry.group.join(', ')})은 함께 · 같은 새 표기로 바꾼다`);
    const map = next.lessons[c.lesson].kanji || {};
    for (const b of inlineBases(c.after)) if (Object.hasOwn(map, b)) fail(`${c.path}: ${b}는 그 과 지도에 있다 — 지도 읽기를 쓴다`);
  }
  // ⑶ 렌더 단위 치환 — 과별로 나눌 수 있는 묶음은 그 과 article 안에서, 아니면 책 전체에서.
  const groups = new Map();
  for (const c of changes) {
    const map = next.lessons[c.lesson].kanji || {}, scope = allowed.get(c.path).scope;
    const before = n5Phrase(c.before, map), after = n5Phrase(c.after, map);
    if (HAN.test(stripSource(after.replace(/<ruby>[\s\S]*?<\/ruby>/g, '')))) fail(`${c.path}: 새 렌더에 루비 없는 한자`);
    const key = `${scope}\u0000${before}`;
    const g = groups.get(key) || { scope, before, after, paths: [] };
    if (g.after !== after) fail(`같은 옛 렌더가 서로 다른 새 렌더로 갈린다: ${g.paths[0]} · ${c.path}`);
    g.paths.push(c.path); groups.set(key, g);
  }
  let out = html, replaced = 0;
  for (const g of groups.values()) {
    const afterBefore = occurrences(out, g.after);
    let count;
    if (g.scope === 'book') {
      count = occurrences(out, g.before);
      if (count !== g.paths.length) fail(`${g.paths.join(', ')}: HTML 출현 ${count} ≠ 바꾸는 원고 문자열 ${g.paths.length}(다른 필드와 렌더 공유)`);
      out = out.split(g.before).join(g.after);
    } else {
      const r = replaceInUnit(out, g.scope, g.before, g.after); count = r.count;
      if (count !== g.paths.length) fail(`${g.paths.join(', ')}: ${g.scope} 안 출현 ${count} ≠ 바꾸는 원고 문자열 ${g.paths.length}`);
      out = r.html;
    }
    replaced += count;
    if (occurrences(out, g.after) !== afterBefore + count) fail(`${g.paths[0]}: 치환 수 불일치`);
  }
  // 옛 렌더 잔존: 책 단위로 바꾼 렌더는 0, 과 단위는 그 과 안에서 0(다른 과의 같은 가나는 그 과 원고대로 남는다)
  for (const g of groups.values()) {
    const left = g.scope === 'book' ? occurrences(out, g.before) : (occurrencesByUnit(out, g.before).get(g.scope) || 0);
    if (left) fail(`${g.paths[0]}: 옛 렌더 ${left}곳이 남았다`);
  }
  // 판본 ID
  const contentHash = sha256(JSON.stringify(canonical(manuscriptContent(next))));
  const editionId = contentHash.slice(0, 24);
  out = out.split(bundle.editionId).join(editionId);
  const nextApp = app.split(bundle.editionId).join(editionId);
  // ⑷ ⑹
  const bareBefore = bareKanji(html), bareAfter = bareKanji(out.split(editionId).join(bundle.editionId));
  if (JSON.stringify(bareBefore) !== JSON.stringify(bareAfter)) fail(`루비 없는 한자 목록이 달라졌다(${bareBefore.length} → ${bareAfter.length})`);
  if (JSON.stringify(attrs(html, bundle.editionId)) !== JSON.stringify(attrs(out, editionId))) fail('id · data-save · href · data-search 목록이 달라졌다');
  const sourceIndex = sourceIndexFrom(out, bundle.sourceIndex);
  const assets = {
    'index.html': { sha256: sha256(out), bytes: Buffer.byteLength(out), type: bundle.assets['index.html'].type },
    'app.js': { sha256: sha256(nextApp), bytes: Buffer.byteLength(nextApp), type: bundle.assets['app.js'].type },
    'style.css': { ...bundle.assets['style.css'] },
  };
  if (sha256(css) !== bundle.assets['style.css'].sha256) fail('바탕 style.css 해시 불일치');
  const nextBundle = {
    bookId: bundle.bookId, editionId, contentHash, manuscript: next, pages: bundle.pages, sourceIndex, assets,
    artifactManifest: {
      bundleHash: sha256(JSON.stringify(canonical(assets))), pages: bundle.pages.length, webContentRevision: editionId, media: bundle.artifactManifest.media,
      baseEdition: bundle.editionId, baseBundleSha256: base.bundleSha256, inheritedMedia: bundle.artifactManifest.inheritedMedia,
      derivation: 'notation-only fragment substitution (scripts/textbooks/n5-derive-notation.mjs) — page templates inherited byte-for-byte',
    },
    qa: { passed: false, scope: 'Notation-only derivation contracts passed. Language review, notation table sign-off and runtime/browser review pending.' },
  };
  const changedSources = Object.keys(sourceIndex).filter(id => sourceIndex[id].text !== bundle.sourceIndex[id].text);
  return { editionId, bundle: nextBundle, html: out, app: nextApp, css, report: { changes: changes.length, renders: groups.size, replaced, changedSources: changedSources.length, bareKanji: bareAfter.length, uncovered: report.uncovered, misread: misreadWarnings(bundle.manuscript, next) } };
}

export async function loadBase(dir) {
  const raw = await fs.readFile(path.join(dir, 'bundle.json'), 'utf8');
  return { bundle: JSON.parse(raw), bundleSha256: sha256(raw), html: await fs.readFile(path.join(dir, 'index.html'), 'utf8'), app: await fs.readFile(path.join(dir, 'app.js'), 'utf8'), css: await fs.readFile(path.join(dir, 'style.css'), 'utf8') };
}

/** 패치(경로 → 새 문자열)를 바탕 원고에 적용한다. 경로는 lessons.9.dialog.1.ja 꼴. */
export function applyPatch(manuscript, patch) {
  const next = structuredClone(manuscript);
  for (const [p, value] of Object.entries(patch)) {
    const keys = p.split('.'), last = keys.pop();
    let node = next; for (const k of keys) { if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('Invalid path'); node = node[k]; }
    if (typeof node?.[last] !== 'string') throw new Error(`패치 경로가 문자열이 아니다: ${p}`);
    node[last] = value;
  }
  return next;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), value = f => args.includes(f) ? args[args.indexOf(f) + 1] : null;
  const baseDir = path.resolve(value('--base') || 'src/content/textbookEditions/8a8c1c1fd452773810abaf8c');
  const outRoot = path.resolve(value('--out-root') || '');
  const base = await loadBase(baseDir);
  const next = applyPatch(base.bundle.manuscript, JSON.parse(await fs.readFile(path.resolve(value('--patch')), 'utf8')));
  const result = deriveNotation(base, next);
  const outDir = path.join(outRoot, result.editionId);
  await fs.mkdir(outDir, { recursive: false }); // 이미 있으면 실패 — 발행 판본은 덮어쓰지 않는다
  await fs.writeFile(path.join(outDir, 'index.html'), result.html);
  await fs.writeFile(path.join(outDir, 'app.js'), result.app);
  await fs.writeFile(path.join(outDir, 'style.css'), result.css);
  await fs.writeFile(path.join(outDir, 'bundle.json'), JSON.stringify(result.bundle));
  console.log(JSON.stringify({ editionId: result.editionId, outDir, ...result.report }));
}
