#!/usr/bin/env node
// 한자 창(팝오버) 데이터 생성 → src/lib/data/hanjaPanel.json — 뷰어 v2 AE-R4 PR ①
// (VIEWER-V2-ROUNDS-001 §9 · 설계서 docs/manabi-viewer-v2-ae-r4.md §3 · 오너 범위 결정 #1337).
//
// 무엇: 중국어 표제어 글자(정체 꼴)마다 ⑴ 형성자 역할(뜻 조각 + 소리 조각) ⑵ 역할 미상 글자의 1단 성분
// ⑶ 소리 조각 → 같은 소리 조각 글자(빈도순 5) ⑷ 대표 병음 ⑸ 정체 → 간체 ⑹ 조각 라벨 보정.
//
// 역할 규칙(Unihan 추정 — 설계서 §3.2, 오너 결정: Make Me a Hanzi는 배포하지 않는다):
//   뜻 조각 = 1단 성분 둘 중 kRSUnicode 부수(또는 그 변형 — 氵=水 · 訁=言 · 阝=阜/邑 …)인 것.
//   소리 조각 = 나머지 성분이 그 글자와 Unihan kPhonetic(Casey 소리 계열 번호)을 하나 이상 공유할 때만.
//   성분이 2개가 아니거나 부수 성분이 없거나 소리 계열이 갈리면 「역할 미상」(지어내지 않는다 — 형성자의
//   소리 부분을 뜻으로 보이지 않는다). 수기 판정 scripts/hanja-curated.mjs ROLE_OVERRIDES가 이긴다.
//
// 원천(오프라인 인자 — 네트워크 없는 결정적 생성, 산출물은 커밋):
//   --unihan <dir>  Unicode Unihan per-property kPhonetic.txt · kMandarin.txt
//                   (unicode-org/unicodetools @ e4a5a6c9 unicodetools/data/ucd/dev/Unihan — hanjaEtym.json과
//                   같은 판, Unicode License v3)
//   리포 입력: src/lib/data/hanjaEtym.json(1단 분해 = BabelStone IDS · 부수 = Unihan kRSUnicode,
//   scripts/build-hanja-etym.mjs) · hanjaTrad.json(R0+ s2t — 글자 우주) · hanjaKo.json · hanjaHun.json ·
//   zhHskLevel.json · src/content/chinese/vocab(우리 사전 — 표제어·급).
//   선택 --compare <dictionary.txt>: 검수 대조 자료(Make Me a Hanzi 등 — 리포에 싣지 않음)의 형성자
//   역할과 일치율을 로그로만 낸다. 산출물에는 아무 영향이 없다(있으면 실패).
//
// 글자 우주 = 표제어(HSK 3.0 ∪ 우리 사전)를 R0+ s2t(toTraditional, 단어 단위)로 바꾼 글자.
// 빈도 순위 = 우주 등장 수(표제어 속 등장 횟수) → 그 글자가 든 표제어의 최저 급 → 코드포인트.
//
// 출력(키는 코드포인트 순 — 결정성):
//   roles — 글자 → 뜻 조각 + 소리 조각 [+ 본자](뜻 조각이 부수 변형이면 셋째 글자 = 부수 본자, 라벨·창 대상).
//   comps — 역할 미상 글자 → 1단 성분 2~3개(4개 이상·획 조각 분해는 싣지 않는다 — 창이 구성 덩어리를 숨긴다).
//   drill — 소리 조각 → 같은 소리 조각을 가진 우주 글자 상위 5(2자 이상인 조각만, 누른 글자 포함).
//   py    — 대표 병음(kMandarin 첫 값): 드릴다운 조각·글자, 뜻 조각(창 머리).
//   simp  — 정체 → 간체(뜻 조각 창의 단어 찾기 — 見 → 见). 표제어 s2t 대응 중 가장 흔한 것.
//   lab   — 조각 라벨 보정(PIECE_LABELS + 그 본자를 따르는 변형 부수 글자).
//
// 재생성: node scripts/generate-hanja-panel.mjs --unihan <Unihan 디렉터리> [--compare <dictionary.txt>]
// (src/lib/data/README.md — 로컬 Node 22 재생성 규칙)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { toTraditional, hanjaHunEum } from '../src/lib/hanjaKo.js';
import { ROLE_OVERRIDES, PIECE_LABELS } from './hanja-curated.mjs';
import { readZhHeadwords, readZhHeadwordLevels } from './zh-headwords.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const argOf = (k) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const UNIHAN = argOf('--unihan');
const COMPARE = argOf('--compare');
if (!UNIHAN) {
  console.error('사용법: node scripts/generate-hanja-panel.mjs --unihan <Unihan 디렉터리> [--compare <dictionary.txt>]');
  process.exit(1);
}

const readData = (f) => JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data', f), 'utf8'));
const etym = readData('hanjaEtym.json');
const trad = readData('hanjaTrad.json');
const koTable = readData('hanjaKo.json');
const hunTable = readData('hanjaHun.json');
const HAN = /\p{Script=Han}/u;
const cpOrder = (a, b) => {
  const x = [...a].map((c) => c.codePointAt(0));
  const y = [...b].map((c) => c.codePointAt(0));
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
};
const fail = (msg) => {
  console.error(`생성 실패: ${msg}`);
  process.exit(1);
};

/** per-property 파일: "3405<TAB>954 1156" (키 = U+ 없는 hex, 범위 허용). */
function readProp(name) {
  const map = new Map();
  for (const line of fs.readFileSync(path.join(UNIHAN, name), 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split('\t');
    const value = rest.join('\t').trim();
    if (!key || !value) continue;
    const [lo, hi] = key.split('..');
    const from = parseInt(lo, 16);
    const to = hi ? parseInt(hi, 16) : from;
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    for (let cp = from; cp <= to; cp += 1) map.set(String.fromCodePoint(cp), value);
  }
  return map;
}
// kPhonetic 값 "954 1156" · "219*" · "804A" — 번호만 소리 계열 열쇠로 쓴다(별표·변형 글자 표지는 버림).
const phonetic = new Map([...readProp('kPhonetic.txt')].map(([c, v]) => [c, new Set(v.split(/\s+/).map((x) => x.replace(/[^0-9]/g, '')).filter(Boolean))]));
const mandarin = new Map([...readProp('kMandarin.txt')].map(([c, v]) => [c, v.split(/\s+/)[0]]));
if (phonetic.size < 10000 || mandarin.size < 30000) fail(`Unihan 파일이 모자란다(kPhonetic ${phonetic.size} · kMandarin ${mandarin.size})`);
const sharePhonetic = (a, b) => {
  const x = phonetic.get(a);
  const y = phonetic.get(b);
  return !!x && !!y && [...x].some((v) => y.has(v));
};

// 부수 본자 ↔ 1단 성분에 나오는 변형 글자(모두 URO — hanjaEtym 성분 규칙). 阝는 부수(阜/邑)가 가른다.
const RADICAL_VARIANTS = {
  水: '氵氺', 手: '扌', 心: '忄', 金: '釒钅', 食: '飠饣', 言: '訁讠', 人: '亻', 艸: '艹', 糸: '糹纟',
  示: '礻', 衣: '衤', 犬: '犭', 火: '灬', 网: '罒', 辵: '辶', 刀: '刂', 攴: '攵', 玉: '王', 肉: '月', 爪: '爫',
  牛: '牜', 歹: '歺', 長: '镸', 戶: '户', 靑: '青', 黃: '黄', 老: '耂', 阜: '阝', 邑: '阝',
};
const isRadicalForm = (comp, rad) => comp === rad || [...(RADICAL_VARIANTS[rad] || '')].includes(comp);
// 변형 글자 → 본자. 역할 미상 글자의 성분 라벨에 쓴다. 阝(阜/邑)·王(임금 왕/구슬 옥)·月(달 월/고기 육)은
// 홀로 있을 때 하나로 정할 수 없어 빼고, 역할 조각일 때만 그 글자의 부수가 본자를 정한다.
const VARIANT_BASE = {};
for (const [base, forms] of Object.entries(RADICAL_VARIANTS)) {
  for (const f of forms) if (!'阝王月'.includes(f)) VARIANT_BASE[f] = base;
}

/** Unihan 추정 역할 — {sem, ph, rad} 또는 null. */
function estimateRole(c) {
  const e = etym[c];
  if (!e) return null;
  const rad = e[1] || '';
  const comps = [...(e[2] || '')];
  if (comps.length !== 2 || !rad) return null;
  const ri = comps.findIndex((x) => isRadicalForm(x, rad));
  if (ri < 0) return null;
  const ph = comps[1 - ri];
  if (ph === comps[ri] || !sharePhonetic(c, ph)) return null;
  return { sem: comps[ri], ph, rad };
}

// ── 1. 글자 우주 · 빈도 ─────────────────────────────────────────────
const heads = [...await readZhHeadwords(root)].filter((w) => HAN.test(w)).sort(cpOrder);
const levels = await readZhHeadwordLevels(root);
const freq = new Map();
const minLevel = new Map();
const simpCount = new Map(); // 정체 → Map(간체 → 수)
for (const w of heads) {
  const s = [...w];
  const t = [...toTraditional(w, trad)];
  if (t.length !== s.length) continue;
  const lv = levels.get(w) ?? 9;
  t.forEach((c, i) => {
    if (!HAN.test(c)) return;
    freq.set(c, (freq.get(c) || 0) + 1);
    minLevel.set(c, Math.min(minLevel.get(c) ?? 9, lv));
    if (s[i] !== c) {
      if (!simpCount.has(c)) simpCount.set(c, new Map());
      const m = simpCount.get(c);
      m.set(s[i], (m.get(s[i]) || 0) + 1);
    }
  });
}
const universe = [...freq.keys()].sort(cpOrder);
const rankCmp = (a, b) => (freq.get(b) || 0) - (freq.get(a) || 0)
  || (minLevel.get(a) ?? 9) - (minLevel.get(b) ?? 9)
  || cpOrder(a, b);

// ── 2. 역할 ─────────────────────────────────────────────────────────
const roles = {};
const roleOf = new Map();
let estimated = 0;
for (const c of universe) {
  let r = null;
  if (Object.hasOwn(ROLE_OVERRIDES, c)) {
    const v = ROLE_OVERRIDES[c];
    if (v) {
      const [sem, ph] = [...v];
      r = { sem, ph, rad: etym[c]?.[1] || '' };
    }
  } else {
    r = estimateRole(c);
    if (r) estimated += 1;
  }
  if (!r) continue;
  // 생성 계약: 두 조각이 그 글자의 1단 성분에 있다 · 소리 조각은 kPhonetic 공유(수기 판정 제외)
  const comps = [...(etym[c]?.[2] || '')];
  if (!comps.includes(r.sem) || !comps.includes(r.ph)) fail(`${c}: 역할 조각 ${r.sem}+${r.ph}이 1단 성분(${comps.join('')})에 없다`);
  if (!Object.hasOwn(ROLE_OVERRIDES, c) && !sharePhonetic(c, r.ph)) fail(`${c}: 소리 조각 ${r.ph}이 kPhonetic을 공유하지 않는다`);
  const base = r.sem !== r.rad && isRadicalForm(r.sem, r.rad) ? r.rad : '';
  roles[c] = r.sem + r.ph + base;
  roleOf.set(c, { sem: r.sem, ph: r.ph, base });
}
for (const c of Object.keys(ROLE_OVERRIDES)) if (!freq.has(c)) fail(`ROLE_OVERRIDES ${c}가 글자 우주 밖이다(죽은 항목)`);

// ── 3. 역할 미상 글자의 1단 성분(2~3개) ───────────────────────────────
// 획 조각(一丨丶丿乙 …)이 든 분해는 싣지 않는다 — 상형·지사자를 획으로 쪼갠 것이라(中 = 口+丨,
// 工 = 丅+一, 十 = 一+丨) 구성 덩어리로 보이면 지어낸 설명이 된다. 창은 구성 덩어리를 숨긴다.
const STROKE_PIECES = new Set([...'一丨丶丿乀乙乚乛亅丷丆丅丄']);
const comps = {};
let strokeDropped = 0;
for (const c of universe) {
  if (roleOf.has(c)) continue;
  const cs = [...(etym[c]?.[2] || '')];
  if (cs.length < 2 || cs.length > 3) continue;
  if (cs.some((x) => STROKE_PIECES.has(x))) { strokeDropped += 1; continue; }
  comps[c] = cs.join('');
}

// ── 4. 소리 조각 드릴다운 ────────────────────────────────────────────
const byPhonetic = new Map();
for (const [c, r] of roleOf) {
  if (!byPhonetic.has(r.ph)) byPhonetic.set(r.ph, []);
  byPhonetic.get(r.ph).push(c);
}
const drill = {};
for (const ph of [...byPhonetic.keys()].sort(cpOrder)) {
  const list = byPhonetic.get(ph).sort(rankCmp);
  if (list.length < 2) continue;
  drill[ph] = list.slice(0, 5).join('');
  // 생성 계약: 드릴다운 목록은 모두 같은 소리 조각을 가진다
  for (const c of drill[ph]) if (roleOf.get(c)?.ph !== ph) fail(`드릴다운 ${ph}에 소리 조각이 다른 ${c}`);
}

// ── 5. 대표 병음 · 정체→간체 · 라벨 보정 ─────────────────────────────
const windowTargets = new Set([...roleOf.values()].map((r) => r.base || r.sem));
const pyChars = new Set([...windowTargets, ...Object.keys(drill), ...Object.values(drill).flatMap((s) => [...s])]);
const py = {};
for (const c of [...pyChars].sort(cpOrder)) if (mandarin.has(c)) py[c] = mandarin.get(c);
const simp = {};
for (const c of [...windowTargets].sort(cpOrder)) {
  const m = simpCount.get(c);
  if (!m) continue;
  simp[c] = [...m].sort((a, b) => b[1] - a[1] || cpOrder(a[0], b[0]))[0][0];
}
const pieceChars = new Set([...windowTargets, ...[...roleOf.values()].flatMap((r) => [r.sem, r.ph]), ...Object.values(comps).flatMap((s) => [...s])]);
const lab = {};
for (const c of [...pieceChars].sort(cpOrder)) {
  if (PIECE_LABELS[c]) lab[c] = PIECE_LABELS[c];
  else if (VARIANT_BASE[c]) {
    const base = VARIANT_BASE[c];
    const label = PIECE_LABELS[base] || hanjaHunEum(base, koTable, hunTable);
    if (label) lab[c] = label;
  }
}
for (const c of Object.keys(PIECE_LABELS)) if (!pieceChars.has(c)) fail(`PIECE_LABELS ${c}가 어느 조각에도 나오지 않는다(죽은 항목)`);

const sortObj = (o) => Object.fromEntries(Object.keys(o).sort(cpOrder).map((k) => [k, o[k]]));
const out = {
  _source: 'Unicode Unihan (Unicode License v3 — unicode-org/unicodetools @ e4a5a6c9 ucd/dev/Unihan kPhonetic·kMandarin; '
    + 'kRSUnicode 부수와 BabelStone IDS 1단 분해는 hanjaEtym.json 경유) · 우리 사전·HSK 3.0 표제어(글자 우주·빈도) · '
    + 'OpenCC s2t(hanjaTrad.json, Apache-2.0 — 정체 꼴) · 수기 판정 scripts/hanja-curated.mjs(ROLE_OVERRIDES·PIECE_LABELS, '
    + '라벨 훈은 libhangul hanja.txt BSD-3에서 다듬음). Generated by scripts/generate-hanja-panel.mjs — '
    + 'roles: 뜻 조각+소리 조각[+부수 본자] (뜻 = 부수 성분, 소리 = kPhonetic 공유 성분, 2성분만); comps: 역할 미상 1단 성분; '
    + 'drill: 소리 조각 → 같은 소리 조각 글자 빈도순 5; py: kMandarin 대표 병음; simp: 정체→간체; lab: 조각 라벨 보정.',
  roles: sortObj(roles),
  comps: sortObj(comps),
  drill,
  py,
  simp,
  lab,
};
const json = JSON.stringify(out);
fs.writeFileSync(path.join(root, 'src/lib/data/hanjaPanel.json'), json);

// ── 로그(산출물 무관) ────────────────────────────────────────────────
const tot = universe.reduce((n, c) => n + freq.get(c), 0);
const weight = (cs) => (100 * cs.reduce((n, c) => n + (freq.get(c) || 0), 0) / tot).toFixed(1);
const gz = (s) => zlib.gzipSync(Buffer.from(s), { level: 9 }).length;
console.log(`글자 우주 ${universe.length}자 · 역할 ${roleOf.size}자(가중 ${weight([...roleOf.keys()])}%, Unihan 추정 ${estimated} · 수기 ${Object.values(ROLE_OVERRIDES).filter(Boolean).length} · 수기 미상 ${Object.values(ROLE_OVERRIDES).filter((v) => !v).length})`);
console.log(`역할 미상 성분 ${Object.keys(comps).length}자(획 조각 분해 ${strokeDropped}자 제외) · 드릴다운 ${Object.keys(drill).length}조각 · 병음 ${Object.keys(py).length}자 · 간체 ${Object.keys(simp).length}자 · 라벨 ${Object.keys(lab).length}자`);
console.log(`hanjaPanel.json raw ${Buffer.byteLength(json)}B · gzip ${gz(json)}B`);
for (const k of ['roles', 'comps', 'drill', 'py', 'simp', 'lab']) console.log(`  ${k} raw ${Buffer.byteLength(JSON.stringify(out[k]))}B · gzip ${gz(JSON.stringify(out[k]))}B`);
console.log(`雚 → ${drill['雚']} · 觀 ${roles['觀']} · 術 ${roles['術'] || `미상(${comps['術']})`}`);

if (COMPARE) {
  // 검수 대조: 형성자(pictophonetic)이고 뜻·소리 둘 다 분해에 있는 것만. 산출물에 쓰지 않는다.
  const ref = new Map();
  for (const line of fs.readFileSync(COMPARE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const d = JSON.parse(line);
    const e = d.etymology;
    if (e?.type !== 'pictophonetic' || !e.semantic || !e.phonetic) continue;
    const dec = d.decomposition || '';
    if (dec.includes(e.semantic) && dec.includes(e.phonetic)) ref.set(d.character, { sem: e.semantic, ph: e.phonetic });
  }
  // 대조 자료는 육달월을 부수 보충 글자 ⺼(U+2EBC)로 적는다 — 우리 성분(URO 月)과 같은 조각으로 본다.
  const unify = (x) => (x === '\u2EBC' ? '月' : x);
  const sameSem = (a, b, rad) => unify(a) === unify(b) || (isRadicalForm(unify(a), rad) && isRadicalForm(unify(b), rad));
  let both = 0;
  let agree = 0;
  const diff = [];
  const refOnly = [];
  for (const c of universe) {
    const a = roleOf.get(c);
    const b = ref.get(c);
    if (b && !a) refOnly.push(c);
    if (!a || !b) continue;
    both += 1;
    if (sameSem(a.sem, b.sem, etym[c]?.[1] || '') && a.ph === b.ph) agree += 1;
    else diff.push(`${c} 우리 ${a.sem}+${a.ph} / 대조 ${b.sem}+${b.ph}`);
  }
  console.log(`[대조] 대조 형성자(우주) ${universe.filter((c) => ref.has(c)).length} · 둘 다 판정 ${both} · 일치 ${agree} (${(100 * agree / Math.max(both, 1)).toFixed(1)}%) · 대조만 판정(→ 역할 미상) ${refOnly.length}`);
  for (const d of diff) console.log(`  [대조 차이] ${d}`);
}
