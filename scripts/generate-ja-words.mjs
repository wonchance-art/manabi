// 중국어 표제어 → 일본어 표기·요미 표 생성 — AE-R3 日 줄 ⑵(VIEWER-V2-ROUNDS-001 §6 · 설계서 §3.3).
//
// 왜: 日 줄은 「확인된 일본어 단어」만 요미와 함께 보인다. 사전 행 ja(⑴)가 없는 화면(게스트 —
// morpheme_dictionary RLS, 미판정 레거시)에는 이 표가 쓰인다. 글자 변환(toJaForm)은 다대일을
// 틀리게 고르므로(方面 → 方麺, 历史 → 暦史) 계산한 꼴은 보이지 않는다 — 계산 꼴은 JMdict 표기를
// 찾는 열쇠로만 쓰고, 표에는 JMdict에 실제로 있는 표기와 그 표기의 요미만 싣는다.
//
// 원천(오프라인 인자 — 네트워크 없는 결정적 생성, 산출물은 커밋):
//   --edict  EDRDG EDICT(JMdict에서 EDRDG가 만든 줄 형식 판, EUC-JP, .gz 그대로 가능).
//            JMdict/EDICT © Electronic Dictionary Research and Development Group, CC BY-SA 4.0.
//            생성에 쓴 판: 「Created: 2025-11-06」(Ubuntu archive edict_2025.11.06.orig.tar.gz
//            sha256 e9147c2ab57bd1e4a56c28ad89c8d3c5791f2cc7c37cca473c59a9bd4c704dbf 안의 edict/edict.gz
//            sha256 17253f3c15fd67353bdc12633fe7d49ecd644c7d28b779842653882aff9330dd — Debian 관리자가 EDRDG
//            배포판을 그대로 묶은 것). 출력 _source에는 압축을 푼 EUC-JP 원본 바이트의 sha256을 적는다
//            (UTF-8로 바꾼 파일을 넣으면 표는 같고 이 해시만 달라진다 — 정본 입력은 edict.gz).
//            EDRDG 서버·GitHub(jmdict-simplified)는 이 환경의 프록시가 막아 JMdict XML을 받지 못했다.
//            EDICT 줄은 JMdict 항목을 (표기, 요미)마다 펼친 것이라 표기·요미·영문 뜻·표기 정보
//            (iK·oK·rK·sK)·요미 정보(ik·ok·rk·sk)를 모두 담는다.
//   --cedict CC-CEDICT JSON(npm cedict-json@1.3.20251213, CC BY-SA 4.0) — 영문 뜻 겹침 관문 계산에만
//            쓰고 표에는 싣지 않는다.
//   --kjnv   Unicode Unihan kJapaneseNewVariant(unicode-org/unicodetools @ e4a5a6c9
//            unicodetools/data/ucd/dev/Unihan/kJapaneseNewVariant.txt, Unicode License v3) —
//            구자체 → 신자체. 열쇠 후보와 생성 계약(표기에 구자체 0)에 쓴다.
//   저장소 안: src/lib/data/hanjaTrad.json(s2t) · hanjaJa.json(toJaForm 열쇠) · 표제어(zh-headwords.mjs)
//            · scripts/hanja-curated.mjs JA_FALSE_FRIENDS(수기 거부 목록).
//
// 규칙(결정적):
//   1. 대상 = 한자만으로 된 2자 이상 표제어(HSK 3.0 ∪ 우리 사전).
//   2. 열쇠 후보 = B kJNV∘s2t · C toJaForm∘s2t · A toJaForm 순(중복 제거). 각 후보가 EDICT 표기
//      (iK·oK·rK·sK 표기 제외)에 있으면 그 표기의 항목들을 영문 뜻 겹침으로 고른다.
//   3. 뜻 관문 = CC-CEDICT 영문 뜻(고유명사·이체 안내 제외)과 EDICT 항목 영문 뜻의 내용어 겹침.
//      겹침이 가장 큰 항목(같으면 (P) 공통어 → 파일 순)이 겹침 ≥2이거나, 겹침 1이면서 (P)이면 통과.
//      첫 후보가 관문에 떨어지면 다음 후보를 본다.
//   4. 요미 = 고른 항목에서 그 표기에 걸린 요미(ik·ok·rk·sk 요미 제외, 가나만) 중 (P) 공통어 요미.
//      **요미 우선순위 없는 입력에서는 다중 요미를 버린다**: EDICT는 같은 표기의 요미를 가나 순으로
//      늘어놓아 JMdict 요미 순서가 없다. 그래서 (P) 등급으로도 하나로 좁혀지지 않으면(최상위 등급에 요미가
//      둘 이상) 표에서 뺀다 — 파일 순으로 고르면 틀린 읽기가 나간다(情緒 じょうしょ·気質 かたぎ). 日 줄을
//      숨기는 편이 오답보다 낫다. 요미 순서를 담은 JMdict XML을 입력으로 쓰게 되면 이 규칙을 그 순서로 바꾼다.
//   5. JA_FALSE_FRIENDS 키는 관문을 통과해도 뺀다.
//   6. 계약: 표기는 표제어와 글자 수가 같고 한자만이며 kJNV 구자체를 담지 않는다. 어기면 실패.
//   7. 출력 키는 코드포인트 순. 값 = 표기가 표제어와 같으면 요미 문자열, 다르면 [표기, 요미].
//   8. warn = JA_FALSE_FRIENDS 중 표제어 우주 안의 키 → [일본어 표기, 일본어의 주된 뜻](값 '표기 — 뜻(중국어는 …)'을 가른다,
//      형식이 어긋나면 실패). 뷰어는 이 단어의 日 줄을 숨기고 「일본어로는」 줄에 경고로 보인다(AE-R3 PR ②).
//
// 산출물 src/lib/data/jaWords.json — **이 파일만 CC BY-SA 4.0**(JMdict 파생 데이터베이스).
// 앱 코드에는 걸리지 않는다. 고지: src/lib/data/README.md · LICENSES/CC-BY-SA-4.0.txt · /credits#jmdict.
//
// 재생성: node scripts/generate-ja-words.mjs --edict <edict.gz> --cedict <cedict.json> --kjnv <kJapaneseNewVariant.txt>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { toTraditional, toJaForm } from '../src/lib/hanjaKo.js';
import { viewerJapaneseGlyphTable } from '../src/lib/viewerJapaneseReference.js';
import { JA_FALSE_FRIENDS } from './hanja-curated.mjs';
import { readZhHeadwords } from './zh-headwords.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const edictPath = argOf('--edict');
const cedictPath = argOf('--cedict');
const kjnvPath = argOf('--kjnv');
const reportPath = argOf('--report'); // 선택: 표제어별 판정 근거(JSON) — 수기 감수용, 커밋하지 않는다
if (!edictPath || !cedictPath || !kjnvPath) {
  console.error('사용법: node scripts/generate-ja-words.mjs --edict <edict.gz> --cedict <cedict.json> --kjnv <kJapaneseNewVariant.txt>');
  process.exit(1);
}
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── EDICT 읽기 ─────────────────────────────────────────────────────
let edictBuf = fs.readFileSync(edictPath);
if (edictBuf[0] === 0x1f && edictBuf[1] === 0x8b) edictBuf = zlib.gunzipSync(edictBuf);
// UTF-8로 이미 바꾼 파일도 받는다(유효한 UTF-8이면 그대로, 아니면 EDRDG 원래 인코딩 EUC-JP)
let edictText;
try { edictText = new TextDecoder('utf-8', { fatal: true }).decode(edictBuf); } catch { edictText = new TextDecoder('euc-jp').decode(edictBuf); }
const edictLines = edictText.split('\n');
const created = /Created: (\d{4}-\d{2}-\d{2})/.exec(edictLines[0] || '')?.[1];
if (!created || !/EDICT/.test(edictLines[0])) throw new Error('EDICT 머리줄(Created: 날짜)을 찾지 못함');
const edictHash = sha256(edictBuf); // 압축을 푼 원본 바이트(EDRDG 배포 인코딩 EUC-JP) — 압축 방식과 무관

const KANJI_BAD = new Set(['iK', 'oK', 'rK', 'sK']);
const KANA_BAD = new Set(['ik', 'ok', 'rk', 'sk']);
const LINE_TAGS = new Set([...KANJI_BAD, ...KANA_BAD, 'ateji', 'io', 'gikun']);
const KANA = /^[ぁ-ゖァ-ヺー]+$/u;
const HAN_ONLY = /^\p{Script=Han}+$/u;

/** 표기 → [{body, glosses, common, readings:[{kana, common}], order}] — EDICT 줄을 (표기, 뜻 본문)으로 다시 묶는다. */
const byForm = new Map();
let lineNo = 0;
for (const line of edictLines.slice(1)) {
  lineNo++;
  const m = /^(\S+) \[(\S+)\] \/(.*)\/$/.exec(line);
  if (!m) continue; // 가나만 줄·빈 줄
  const [, form, kana, rest] = m;
  if (!HAN_ONLY.test(form)) continue;
  const parts = rest.split('/');
  const common = parts[parts.length - 1] === '(P)';
  if (common) parts.pop();
  const tags = [];
  let first = parts[0] || '';
  for (let t; (t = /^\(([A-Za-z]+)\) /.exec(first)) && LINE_TAGS.has(t[1]);) { tags.push(t[1]); first = first.slice(t[0].length); }
  parts[0] = first;
  if (tags.some((t) => KANJI_BAD.has(t))) continue;
  const body = parts.join('/');
  if (!byForm.has(form)) byForm.set(form, []);
  const list = byForm.get(form);
  let entry = list.find((e) => e.body === body);
  if (!entry) { entry = { body, glosses: parts, common: false, readings: [], order: lineNo }; list.push(entry); }
  entry.common ||= common;
  if (!tags.some((t) => KANA_BAD.has(t)) && KANA.test(kana)) entry.readings.push({ kana, common });
}

// ── CC-CEDICT 영문 뜻 ──────────────────────────────────────────────
const cedictBuf = fs.readFileSync(cedictPath);
const cedEnglish = new Map();
// 고유명사 항목(병음 첫 글자 대문자 — 大众 Volkswagen · 成功 대만 지명)과 이체 안내 뜻(variant of …)은
// 학습자가 보는 보통 낱말 뜻이 아니므로 관문에서 뺀다.
const NOT_SENSE = /^(old |archaic |erhua )?variant of |^see |^used in |^surname /i;
for (const e of JSON.parse(cedictBuf.toString('utf8'))) {
  if (/^[A-Z]/.test(e.pinyin || '')) continue;
  const senses = (e.english || []).filter((g) => !NOT_SENSE.test(g));
  if (!senses.length) continue;
  if (!cedEnglish.has(e.simplified)) cedEnglish.set(e.simplified, []);
  cedEnglish.get(e.simplified).push(...senses);
}
const STOP = new Set('a an the to of and or in on at for by with as be is are sb sth one oneself something someone etc also esp lit fig used see variant cl adj adv n v from into up out over off it its this that not no very'.split(' '));
const tokens = (arr) => new Set(arr.join(' ; ').toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z]+/)
  .filter((t) => t.length > 2 && !STOP.has(t)).map((t) => t.replace(/(ing|ed|es|s)$/, '')));
const overlap = (a, b) => { let n = 0; for (const t of a) if (b.has(t)) n++; return n; };

// ── 열쇠 후보 ─────────────────────────────────────────────────────
const kjnvBuf = fs.readFileSync(kjnvPath);
const cp = (u) => String.fromCodePoint(parseInt(u.replace(/^U\+/, ''), 16));
const kjnv = new Map();
for (const line of kjnvBuf.toString('utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [a, b] = line.split('\t');
  if (!a || !b) continue;
  if (!kjnv.has(cp(a))) kjnv.set(cp(a), cp(b.trim().split(/\s+/)[0]));
}
if (kjnv.size < 300) throw new Error(`kJapaneseNewVariant 행이 너무 적음: ${kjnv.size}`);
const trad = readJson('src/lib/data/hanjaTrad.json');
const jaGlyph = viewerJapaneseGlyphTable(readJson('src/lib/data/hanjaJa.json'));
const keyCandidates = (w) => {
  const t = toTraditional(w, trad);
  const b = [...t].map((c) => kjnv.get(c) || c).join('');
  return [...new Set([b, toJaForm(t, jaGlyph), toJaForm(w, jaGlyph)])];
};

// ── 생성 ──────────────────────────────────────────────────────────
const words = [...await readZhHeadwords(root)].filter((w) => HAN_ONLY.test(w) && [...w].length >= 2).sort(byCodePoint);
const out = {};
const report = reportPath ? [] : null;
const stats = { words: words.length, formHit: 0, gateFail: 0, rejected: [], yomiTie: [], yomiDropped: [], viaB: 0, viaC: 0, viaA: 0 };
for (const w of words) {
  const zh = tokens(cedEnglish.get(w) || []);
  const cands = keyCandidates(w);
  let pick = null;
  let anyForm = false;
  for (const [ci, form] of cands.entries()) {
    const entries = (byForm.get(form) || []).filter((e) => e.readings.length);
    if (!entries.length) continue;
    anyForm = true;
    const best = entries
      .map((e) => ({ e, s: overlap(zh, tokens(e.glosses)) }))
      .sort((x, y) => y.s - x.s || Number(y.e.common) - Number(x.e.common) || x.e.order - y.e.order)[0];
    // 관문: 겹침 ≥2, 또는 겹침 1이면 그 항목이 (P) 공통어일 때만. 겹침 1 + 비공통어는 대부분
    // 옛말·전문어 동형어다(再见 ↔ 再見 'seeing again' · 马上 ↔ 馬上 'on horseback' — 표본 감수 2026-10-07).
    if (report) report.push({ w, form, s: best.s, common: best.e.common, gloss: best.e.body.slice(0, 120), yomi: best.e.readings.map((r) => r.kana).join('/') });
    if (best.s >= 2 || (best.s === 1 && best.e.common)) {
      // EDICT 줄 순서는 JMdict 요미 순서가 아니다(가나 순 정렬 — 気質 かたぎ·きしつ). (P) 공통어 요미가
      // 하나뿐이면 그것, 최상위 등급에 요미가 둘 이상이면 하나로 정할 근거가 없어 뺀다(규칙 4 — 모호하면 숨김).
      const rs = [...best.e.readings].sort((x, y) => Number(y.common) - Number(x.common));
      if (rs.length > 1 && rs[0].common === rs[1].common) {
        const top = rs.filter((r) => r.common === rs[0].common).map((r) => r.kana).join('/');
        (rs[0].common ? stats.yomiTie : stats.yomiDropped).push(`${w}:${top}`);
        pick = 'drop';
        break;
      }
      pick = { form, yomi: rs[0].kana, via: ['B', 'C', 'A'][ci] };
      break;
    }
  }
  if (anyForm) stats.formHit++;
  if (pick === 'drop') continue;
  if (!pick) { if (anyForm) stats.gateFail++; continue; }
  if (Object.hasOwn(JA_FALSE_FRIENDS, w)) { stats.rejected.push(`${w}→${pick.form}`); continue; }
  const fc = [...pick.form];
  if (fc.length !== [...w].length || !HAN_ONLY.test(pick.form)) throw new Error(`표기 계약 위반: ${w} → ${pick.form}`);
  const old = fc.filter((c) => kjnv.has(c));
  if (old.length) throw new Error(`표기에 kJNV 구자체: ${w} → ${pick.form} (${old.join('')})`);
  stats[`via${pick.via}`]++;
  out[w] = pick.form === w ? pick.yomi : [pick.form, pick.yomi];
}
// 표제어 밖 키는 예방용이다(나중에 우리 사전에 들어와도 새지 않게) — 로그로만 남긴다.
const outsideFalse = Object.keys(JA_FALSE_FRIENDS).filter((k) => !words.includes(k));
const FF_RE = /^([\p{Script=Han}々]+) — (.+?)\(중국어/u;
const warn = {};
for (const k of Object.keys(JA_FALSE_FRIENDS).filter((key) => words.includes(key)).sort(byCodePoint)) {
  const m = FF_RE.exec(JA_FALSE_FRIENDS[k]);
  if (!m || [...m[1]].length !== [...k].length) throw new Error(`JA_FALSE_FRIENDS 형식 위반: ${k} — ${JA_FALSE_FRIENDS[k]}`);
  warn[k] = [m[1], m[2].trim()];
}

const result = {
  _source: `JMdict/EDICT (EDRDG, https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) — EDICT Created: ${created}, `
    + `edict sha256 ${edictHash} (gunzip, EUC-JP). Derived by scripts/generate-ja-words.mjs: 중국어 표제어(HSK 3.0 ∪ 우리 사전)와 같은 표기의 `
    + '일본어 단어만 골라 표기·요미를 실음(열쇠: Unihan kJapaneseNewVariant · OpenCC s2t · hanjaJa, 뜻 관문: CC-CEDICT 영문 뜻 겹침, '
    + '거부 목록: scripts/hanja-curated.mjs JA_FALSE_FRIENDS). 값 = 요미(표기가 표제어와 같음) 또는 [표기, 요미]. '
    + 'warn = 거부 목록(수기 저작)의 표제어 → [일본어 표기, 일본어의 주된 뜻] — 동형이의어 경고.',
  _license: 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/) — 이 파일만. '
    + 'JMdict/EDICT © Electronic Dictionary Research and Development Group, used in conformance with the Group\'s licence '
    + '(https://www.edrdg.org/edrdg/licence.html). 고지 원문: src/lib/data/LICENSES/CC-BY-SA-4.0.txt.',
  words: Object.fromEntries(Object.keys(out).sort(byCodePoint).map((k) => [k, out[k]])),
  warn,
};
const dest = path.join(root, 'src/lib/data/jaWords.json');
const json = JSON.stringify(result);
fs.writeFileSync(dest, json);
const n = Object.keys(result.words).length;
console.log(`jaWords.json 생성 — ${n}항 (표제어 ${stats.words} · 표기 일치 ${stats.formHit} · 관문 탈락 ${stats.gateFail} · 거부 ${stats.rejected.length})`
  + ` · 열쇠 B ${stats.viaB} / C ${stats.viaC} / A ${stats.viaA} · ${Buffer.byteLength(json)}B · gzip ${zlib.gzipSync(json, { level: 9 }).length}B`);
console.log(`  입력 — EDICT ${created} 원본 ${edictHash} · CC-CEDICT ${sha256(cedictBuf)} · kJNV ${sha256(kjnvBuf)} (${kjnv.size}행)`);
if (report) fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
console.log(`  거부 — ${stats.rejected.join(' ')} · 표제어 밖(예방) ${outsideFalse.join(' ')} · warn ${Object.keys(warn).length}항`);
console.log(`  요미 미정으로 뺌 ${stats.yomiTie.length + stats.yomiDropped.length} — (P) 요미 둘 이상 ${stats.yomiTie.length}: ${stats.yomiTie.join(' ')}`);
console.log(`    (P) 없는 다중 요미 ${stats.yomiDropped.length}: ${stats.yomiDropped.join(' ')}`);
