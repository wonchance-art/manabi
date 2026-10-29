// JLPT 단어 페이지 글자 창의 음 · 훈 표 두 벌 생성(오너 2026-10-25 KST 「상용한자 교재에서 나오는 모양」 · 시안 ⑧).
//
// 1. src/lib/data/jaJoyo.json — 常用漢字表(2010 内閣告示 第2号, 2,136자 · 4,388음훈). 고시는 저작권법 13조로 권리 밖.
//    글자마다 표 순서 그대로 「セイ,ショウ,い.きる,…」 — 음은 가타카나, 훈은 히라가나에 오쿠리가나 앞 「.」,
//    한 자 내려 쓴 읽기(특별하거나 쓰임이 아주 좁은 것)는 앞에 「*」. 표의 글자꼴(𠮟 · 塡 · 剝 · 頰)은 흔한 꼴(叱 · 填 · 剥 · 頬)로도 싣는다.
//    표는 오쿠리가나를 가는 글씨로만 구분해서 글자로 뽑으면 사라진다 — 같은 줄 예(生きる · 淫らだ · 生い立ち)에서 되살리고,
//    예가 활용형뿐인 두 읽기(干 ひる · 足 たる)만 OKURI_MANUAL로 둔다.
// 2. src/lib/data/jaKanjiOnKun.json — 상용 밖인데 우리 일본어 단어 콘텐츠에 나오는 한자의 음 · 훈(KANJIDIC2, EDRDG, CC BY-SA 4.0 — 이 파일만).
//    같은 꼴(음 가타카나 · 훈 「.」), 접사 읽기(-ぶ · さ-)와 이름 읽기는 싣지 않는다. 「*」는 없다.
//
// 재생성(네트워크 없는 결정적 생성 — 받은 파일을 인자로):
//   node scripts/generate-ja-joyo.mjs <joyokanjihyo.txt> <kanjidic2.xml> [--check]
//   joyokanjihyo.txt = `pdftotext -layout joyokanjihyo_20101130.pdf` (https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/pdf/joyokanjihyo_20101130.pdf)
//   kanjidic2.xml = https://www.edrdg.org/kanjidic/kanjidic2.xml.gz 의 압축 해제본.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [hyoPath, kanjidicPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CHECK = process.argv.includes('--check');
if (!hyoPath || !kanjidicPath) {
  console.error('usage: node scripts/generate-ja-joyo.mjs <joyokanjihyo.txt> <kanjidic2.xml> [--check]');
  process.exit(2);
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fail = (msg) => { console.error(msg); process.exit(1); };

// ── 1. 常用漢字表 ──
const hyoBuf = fs.readFileSync(hyoPath);
const lines = hyoBuf.toString('utf8').split('\n');
const KANA = '[ァ-ヶー]+|[ぁ-ゖー]+';
const HAN = '[\\u3400-\\u9fff\\uf900-\\ufaff\\u{20000}-\\u{2ffff}]';
// 글자 줄: 들여쓰기 20칸 안 · 글자 · (옛 꼴 · ［허용 꼴］ · 꼴만 따로 적힌 옛 글자) · 첫 읽기 · 예.
const HEAD = new RegExp(`^(\\s{0,20})(${HAN})((?:\\s*(?:（[^）]*）|［[^］]*］|${HAN}))*)\\s*(${KANA})(\\s+(.*))?$`, 'u');
// 읽기 줄: 읽기 칸(20–36칸)에서 시작하는 가나. 더 깊이 들여 쓴 줄은 앞 줄 예가 넘어온 것.
const READING = new RegExp(`^(\\s{20,36})(${KANA})(\\s+(.*))?$`, 'u');
// 옛 꼴만 다음 줄에 적힌 읽기(餅 （餠） もち).
const OLD_FORM_READING = new RegExp(`^\\s+（[^）]*）\\s*(${KANA})(\\s+(.*))?$`, 'u');

const start = lines.findIndex((l) => /^\s*亜（亞）/.test(l));
const end = lines.findIndex((l, i) => i > start && /^\s*付\s+表\s*$/.test(l));
if (start < 0 || end < 0) fail('本表의 시작(亜) · 끝(付表)을 찾지 못했다');
const entries = [];
let cur = null, page = 0;
for (let i = start; i < end; i++) {
  const line = lines[i];
  if (line.includes('.indd')) page++;
  if (line.startsWith('\f') || line.includes('.indd')) continue; // 쪽 머리(읽기 색인) · 쪽 꼬리
  let m = HEAD.exec(line);
  if (m) {
    cur = m[2];
    // 글자 줄의 첫 읽기 자리 — 옛 꼴이 없을 때만 칸 수가 믿을 만하다(있으면 전각 괄호 폭이 어긋난다).
    // 칸 수는 글자 단위로 센다(𠮟는 UTF-16 두 칸).
    const col = m[3] ? null : [...line.slice(0, line.indexOf(m[4], m[1].length + m[2].length))].length;
    entries.push({ k: cur, r: m[4], col, ex: m[6] || '', page, first: true });
    continue;
  }
  if (!cur) continue;
  m = OLD_FORM_READING.exec(line);
  if (m) { entries.push({ k: cur, r: m[1], col: null, ex: m[3] || '', page, first: false }); continue; }
  m = READING.exec(line);
  if (m) entries.push({ k: cur, r: m[2], col: m[1].length, ex: m[4] || '', page, first: false });
}
// 한 자 내림 — 쪽마다 읽기 줄의 가장 흔한 칸이 기준, 그보다 오른쪽이면 내려 쓴 읽기.
const base = new Map();
for (const p of new Set(entries.map((e) => e.page))) {
  const count = new Map();
  for (const e of entries) if (e.page === p && !e.first && e.col != null) count.set(e.col, (count.get(e.col) || 0) + 1);
  const best = [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  if (best) base.set(p, best[0]);
}
const kanjiCount = new Set(entries.map((e) => e.k)).size;
if (kanjiCount !== 2136 || entries.length !== 4388) fail(`常用漢字表 2,136자 · 4,388음훈이어야 하는데 ${kanjiCount}자 · ${entries.length}음훈`);

// 오쿠리가나 — 같은 줄 예에서 그 글자 바로 뒤 히라가나(S)로 줄기를 찾는다.
const OKURI_MANUAL = { '干:ひる': 'ひ.る', '足:たる': 'た.る' };
const I_ROW = { う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち', ぬ: 'に', ぶ: 'び', む: 'み', る: 'り' };
function okurigana(e) {
  const R = e.r;
  if (/^[ァ-ヶ]/.test(R)) return R;
  if (OKURI_MANUAL[`${e.k}:${R}`]) return OKURI_MANUAL[`${e.k}:${R}`];
  const tails = [];
  for (const tok of e.ex.split(/[，、\s]+/)) {
    for (let at = tok.indexOf(e.k); at >= 0; at = tok.indexOf(e.k, at + e.k.length)) {
      const s = /^[ぁ-ゖ]*/.exec(tok.slice(at + e.k.length))[0];
      if (s) tails.push(s);
    }
  }
  const split = (p) => `${R.slice(0, p)}.${R.slice(p)}`;
  // ① 예의 꼬리가 읽기 끝과 같다(生きる → い.きる) — 가장 긴 꼬리
  const exact = tails.filter((s) => R.endsWith(s) && s.length < R.length).sort((a, b) => b.length - a.length)[0];
  if (exact) return split(R.length - exact.length);
  // ② 읽기 끝이 예 꼬리의 앞(淫らだ → みだ.ら)
  for (let p = 1; p < R.length; p++) if (tails.some((s) => s.startsWith(R.slice(p)))) return split(p);
  // ③ 예 꼬리가 읽기 끝의 앞(書き初め → そ.める)
  for (let p = R.length - 1; p > 0; p--) if (tails.some((s) => R.slice(p).startsWith(s))) return split(p);
  // ④ 5단 연용형(生い立ち → お.う)
  for (let p = R.length - 1; p > 0; p--) {
    const t = R.slice(p);
    if (I_ROW[t.at(-1)] && tails.some((s) => s.startsWith(t.slice(0, -1) + I_ROW[t.at(-1)]))) return split(p);
  }
  return R; // 오쿠리가나 없는 훈(なま · き)
}
const ALIAS = { '𠮟': '叱', '塡': '填', '剝': '剥', '頰': '頬' };
const joyo = {};
for (const e of entries) {
  const rare = !!(e.col != null && base.has(e.page) && e.col > base.get(e.page));
  const value = `${rare ? '*' : ''}${okurigana(e)}`;
  for (const k of [e.k, ALIAS[e.k]].filter(Boolean)) joyo[k] = joyo[k] ? `${joyo[k]},${value}` : value;
}

// ── 2. 상용 밖 콘텐츠 한자(KANJIDIC2) ──
const contentChars = new Set();
const vocabDir = path.join(ROOT, 'src/content/japanese/vocab');
for (const f of fs.readdirSync(vocabDir).sort()) {
  const s = fs.readFileSync(path.join(vocabDir, f), 'utf8');
  for (const m of s.matchAll(/\bja:\s*(['"`])((?:(?!\1).)+)\1/g)) for (const c of m[2]) if (/\p{Script=Han}/u.test(c) && !joyo[c]) contentChars.add(c);
}
const kdBuf = fs.readFileSync(kanjidicPath);
const kd = kdBuf.toString('utf8');
const dbVersion = /<database_version>([^<]+)<\/database_version>/.exec(kd)?.[1] || '?';
const onkun = {};
for (const m of kd.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
  const body = m[1];
  const ch = /<literal>([^<]+)<\/literal>/.exec(body)?.[1];
  if (!ch || !contentChars.has(ch)) continue;
  const out = [];
  const add = (r) => { if (r && !r.includes('-') && !out.includes(r)) out.push(r); };
  for (const r of body.matchAll(/<reading r_type="ja_on"[^>]*>([^<]+)<\/reading>/g)) add(r[1]);
  for (const r of body.matchAll(/<reading r_type="ja_kun"[^>]*>([^<]+)<\/reading>/g)) add(r[1]);
  if (out.length) onkun[ch] = out.join(',');
}
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

const files = {
  'src/lib/data/jaJoyo.json': JSON.stringify({
    _source: `常用漢字表(平成22年内閣告示第2号, 文化庁 joyokanjihyo_20101130.pdf → pdftotext -layout, sha256 ${sha(hyoBuf)}). `
      + '고시 — 저작권법 13조. 음 가타카나 · 훈 히라가나(오쿠리가나 앞 「.」) · 한 자 내린 읽기 「*」, 표 순서. Derived by scripts/generate-ja-joyo.mjs.',
    r: sorted(joyo),
  }),
  'src/lib/data/jaKanjiOnKun.json': JSON.stringify({
    _source: `KANJIDIC2 (EDRDG, https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) database_version ${dbVersion}, kanjidic2.xml sha256 ${sha(kdBuf)}. `
      + 'CC BY-SA 4.0 — 이 파일만. 상용 밖 콘텐츠 한자의 음(가타카나) · 훈(오쿠리가나 앞 「.」). Derived by scripts/generate-ja-joyo.mjs.',
    r: sorted(onkun),
  }),
};
let stale = false;
for (const [rel, text] of Object.entries(files)) {
  const body = `${text}\n`;
  const abs = path.join(ROOT, rel);
  if (CHECK) {
    if (!fs.existsSync(abs) || fs.readFileSync(abs, 'utf8') !== body) { console.error(`stale: ${rel}`); stale = true; }
  } else fs.writeFileSync(abs, body);
}
console.log(`常用漢字表 ${kanjiCount}자 · ${entries.length}음훈 · 내린 읽기 ${entries.filter((e) => e.col != null && base.has(e.page) && e.col > base.get(e.page)).length} · 상용 밖 콘텐츠 한자 ${Object.keys(onkun).length}/${contentChars.size}`);
if (stale) process.exit(1);
