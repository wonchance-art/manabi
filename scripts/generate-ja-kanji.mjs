// JLPT 단어 페이지 글자 칸 표 두 벌 생성(오너 확정 2026-10-19 KST · 문서 「HSK 단어 페이지」 「일본어 판에서 달라지는 점」).
//
// 1. src/lib/data/jaKanjiReadings.json — 글자별 음독 · 훈독(KANJIDIC2, EDRDG, CC BY-SA 4.0 — 이 파일만).
//    단어 읽기를 글자마다 나누는 데만 쓴다(経験 けいけん → 経 けい · 験 けん, src/lib/jaKanjiReading.js). 서버(빌드)에서만 읽는다.
//    음독은 히라가나로, 훈독은 오쿠리가나 앞 줄기(へ.る → へ)와 전체(へる)를 함께 싣는다. 이름 읽기(nanori)는 싣지 않는다.
//    글자 우주 = 상용 · 인명용(grade 있는 글자) ∪ 우리 일본어 단어 콘텐츠(src/content/japanese/vocab)의 한자.
// 2. src/lib/data/jaJeongja.json — 신자체 → 한국 정자(経 → 經, 学 → 學). 글자 칸 아래 회색 글자.
//    OpenCC JPShinjitaiCharacters(npm opencc-data@1.4.1, Apache-2.0)에서 다른 꼴 후보가 하나뿐인 글자만(弁 → 辨 · 瓣 · 辯처럼 단어마다
//    갈리는 글자는 싣지 않는다 — 글자 하나로 정할 수 없다).
//
// 재생성(네트워크 없는 결정적 생성 — 받은 파일을 인자로):
//   node scripts/generate-ja-kanji.mjs <kanjidic2.xml> <JPShinjitaiCharacters.txt> [--check]
//   kanjidic2.xml = https://www.edrdg.org/kanjidic/kanjidic2.xml.gz 의 압축 해제본.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HAN = /\p{Script=Han}/u;
const [kanjidicPath, shinjitaiPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CHECK = process.argv.includes('--check');
if (!kanjidicPath || !shinjitaiPath) {
  console.error('usage: node scripts/generate-ja-kanji.mjs <kanjidic2.xml> <JPShinjitaiCharacters.txt> [--check]');
  process.exit(2);
}

const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// 우리 콘텐츠의 한자(단어 · 예문 ja 필드).
const contentChars = new Set();
const vocabDir = path.join(ROOT, 'src/content/japanese/vocab');
for (const f of fs.readdirSync(vocabDir).sort()) {
  const s = fs.readFileSync(path.join(vocabDir, f), 'utf8');
  for (const m of s.matchAll(/\bja:\s*(['"`])((?:(?!\1).)+)\1/g)) for (const c of m[2]) if (HAN.test(c)) contentChars.add(c);
}

const kdBuf = fs.readFileSync(kanjidicPath);
const kd = kdBuf.toString('utf8');
const dbVersion = /<database_version>([^<]+)<\/database_version>/.exec(kd)?.[1] || '?';
const readings = {};
for (const m of kd.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
  const body = m[1];
  const ch = /<literal>([^<]+)<\/literal>/.exec(body)?.[1];
  if (!ch) continue;
  const graded = /<grade>\d+<\/grade>/.test(body);
  if (!graded && !contentChars.has(ch)) continue;
  const out = [];
  const add = (r) => { if (r && !out.includes(r)) out.push(r); };
  for (const r of body.matchAll(/<reading r_type="ja_on"[^>]*>([^<]+)<\/reading>/g)) add(hira(r[1]).replace(/-/g, ''));
  for (const r of body.matchAll(/<reading r_type="ja_kun"[^>]*>([^<]+)<\/reading>/g)) {
    const kun = r[1].replace(/-/g, '');
    const [stem, okuri] = kun.split('.');
    add(stem);
    if (okuri) add(stem + okuri);
  }
  if (out.length) readings[ch] = out.join(',');
}
const missing = [...contentChars].filter((c) => !readings[c]).sort();

const jeongja = {};
const occBuf = fs.readFileSync(shinjitaiPath);
for (const line of occBuf.toString('utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [shin, olds] = line.split('\t');
  if (!shin || !olds || [...shin].length !== 1) continue;
  const other = [...new Set(olds.trim().split(/\s+/))].filter((c) => c !== shin && [...c].length === 1);
  if (other.length === 1) jeongja[shin] = other[0];
}

const sorted = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
const files = {
  'src/lib/data/jaKanjiReadings.json': JSON.stringify({
    _source: `KANJIDIC2 (EDRDG, https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) database_version ${dbVersion}, kanjidic2.xml sha256 ${sha(kdBuf)}. `
      + 'CC BY-SA 4.0 — 이 파일만. 음독(히라가나) · 훈독 줄기와 전체(오쿠리가나 붙임). Derived by scripts/generate-ja-kanji.mjs.',
    _missing: missing,
    r: sorted(readings),
  }),
  'src/lib/data/jaJeongja.json': JSON.stringify({
    _source: `OpenCC JPShinjitaiCharacters.txt (npm opencc-data@1.4.1, Apache-2.0) sha256 ${sha(occBuf)} — 다른 꼴 후보가 하나뿐인 글자만. Derived by scripts/generate-ja-kanji.mjs.`,
    j: sorted(jeongja),
  }),
};

let stale = false;
for (const [rel, text] of Object.entries(files)) {
  const abs = path.join(ROOT, rel);
  const body = `${text}\n`;
  if (CHECK) {
    if (!fs.existsSync(abs) || fs.readFileSync(abs, 'utf8') !== body) { console.error(`stale: ${rel}`); stale = true; }
  } else {
    fs.writeFileSync(abs, body);
    console.log(`${rel}: ${Buffer.byteLength(body)} bytes`);
  }
}
console.log(`readings ${Object.keys(readings).length} · content kanji ${contentChars.size} · missing ${missing.length} · jeongja ${Object.keys(jeongja).length}`);
if (stale) process.exit(1);
