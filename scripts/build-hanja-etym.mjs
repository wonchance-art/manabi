#!/usr/bin/env node
// 글자 카드 증강 R2·R3 데이터 정본 생성 → src/lib/data/hanjaEtym.json
// (오너 승인 2026-08-28 "R1~R3 ㄱㄱ" — 설계 보고의 조달 표대로)
//
// 원천 (수동 재생성 — prebuild 미연결, 결정성: 같은 원천 커밋이면 같은 출력):
//  · Unihan per-property 4종: unicode-org/unicodetools @ e4a5a6c9
//    unicodetools/data/ucd/dev/Unihan/{kTotalStrokes,kRSUnicode,kTraditionalVariant,kSimplifiedVariant}.txt
//    (Unicode License — 허용적. unicode.org 직결이 프록시에 막혀 공식 GitHub 리포로 수급)
//  · 분해: qundao/backup-babelstone-ids @ d8bd67e5 IDS.TXT
//    (BabelStone IDS — "허락·출처 표기 없이 개인·상업 이용 자유" 명문, 조사 2026-08-28.
//     cjkvi-ids는 GPLv2(CHISE 유래)라 배제 — 설계 보고 조달 표)
//
// 사용: node scripts/build-hanja-etym.mjs --unihan <Unihan 디렉터리> --ids <IDS.TXT>
//
// 규칙:
//  · 우주 = hanjaKo.json 키(URO 20,902) — 성분 훈음 폴백(음)이 항상 성립하는 범위.
//  · 분해는 1단만 저장(재귀는 런타임 조회) · 전 성분이 URO일 때만(부분 분해 금지 —
//    미부호·확장 성분이 하나라도 끼면 통째로 생략, listHanjaHunEum '조용히 생략' 관례).
//  · 부수표(214)는 아래 문자열이 정본 후보일 뿐 — 각 부수 글자의 kRSUnicode가 자기
//    번호(n.0)와 일치하는지 전량 검증하고, 하나라도 어긋나면 빌드 실패(자기검증).
//  · 간체 부수 변형(61' 등)은 번호만 취해 정체 부수로 표기(옥편·훈음 정본과 결).
//
// 출력 형식: { 글자: [총획, 부수, 성분들, 번체(≤2), 간체(≤2)] } — 뒤쪽 '' 슬롯은 절단.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (k, dflt) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const UNIHAN_DIR = argOf('--unihan', null);
const IDS_FILE = argOf('--ids', null);
if (!UNIHAN_DIR || !IDS_FILE) {
  console.error('사용: node scripts/build-hanja-etym.mjs --unihan <dir> --ids <IDS.TXT>');
  process.exit(1);
}

const OUT = path.join(process.cwd(), 'src/lib/data/hanjaEtym.json');
const koTable = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/data/hanjaKo.json'), 'utf8'));
const universe = Object.keys(koTable);

// 강희 부수 214 — 순서가 곧 번호(1..214). 아래 kRSUnicode 대조가 전량 검증한다.
const RADICALS = [...(
  '一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又' + // 1-29
  '口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳' + // 30-60
  '心戈戶手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄' + // 61-95
  '玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立竹米糸缶网羊羽老而耒耳聿肉臣自至臼' + // 96-134
  '舌舛舟艮色艸虍虫血行衣襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹' + // 135-172
  '雨靑非面革韋韭音頁風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠' // 173-214
)];
if (RADICALS.length !== 214) {
  console.error(`부수표 길이 오류: ${RADICALS.length} (214 필요)`);
  process.exit(1);
}

// per-property 파일: "3425<TAB>5.15" / "342A..342B<TAB>8.4" (키 = U+ 없는 hex, 범위 허용)
function readProp(name) {
  const map = new Map();
  const text = fs.readFileSync(path.join(UNIHAN_DIR, name), 'utf8');
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split('\t');
    const value = rest.join('\t').trim();
    if (!key || !value) continue;
    const [lo, hi] = key.split('..');
    const from = parseInt(lo, 16);
    const to = hi ? parseInt(hi, 16) : from;
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    for (let cp = from; cp <= to; cp += 1) map.set(cp, value);
  }
  return map;
}

const totalStrokes = readProp('kTotalStrokes.txt');
const rsUnicode = readProp('kRSUnicode.txt');
const tradVar = readProp('kTraditionalVariant.txt');
const simpVar = readProp('kSimplifiedVariant.txt');

// 부수표 자기검증 — 각 부수 글자의 kRSUnicode 첫 값이 "번호.0"이어야 한다.
const radicalErrors = [];
RADICALS.forEach((ch, i) => {
  const v = rsUnicode.get(ch.codePointAt(0));
  const first = (v || '').split(/\s+/)[0] || '';
  if (!new RegExp(`^${i + 1}'{0,3}\\.0$`).test(first)) {
    radicalErrors.push(`#${i + 1} ${ch}: kRSUnicode=${v ?? '(없음)'}`);
  }
});
if (radicalErrors.length) {
  console.error('부수표 자기검증 실패:\n' + radicalErrors.join('\n'));
  process.exit(1);
}

// BabelStone IDS: "U+60F3<TAB>想<TAB>^⿱相心$(GHTJKPV)[<TAB>대안...]" — 첫 IDS만.
// 성분 필터는 범위가 아니라 '우주 소속'(hanjaKo 키) — U+9FA6 이후 URO 확장 글자(龰·龶
// 등)는 음 정본 밖이라 라벨이 성립 안 한다(실측: 범위 필터는 닫힘성 테스트에서 깨짐).
const isIdc = (cp) => (cp >= 0x2ff0 && cp <= 0x2fff) || cp === 0x31ef || cp === 0x303e;
const decomp = new Map();
{
  const text = fs.readFileSync(IDS_FILE, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.startsWith('U+')) continue;
    const fields = line.split('\t');
    if (fields.length < 3) continue;
    const ch = fields[1];
    const m = /^\^(.*)\$/.exec(fields[2] || '');
    if (!m) continue;
    const body = [...m[1]];
    const comps = body.filter((c) => !isIdc(c.codePointAt(0)));
    if (comps.length < 2) continue; // 원자(자기 자신) 또는 단일 성분 — 저장 없음
    if (!comps.every((c) => koTable[c])) continue; // 부분 분해 금지 — 전 성분 우주 소속일 때만
    decomp.set(ch, comps.join(''));
  }
}

// 변형: "U+4E7E U+5E72 U+5E79" → 자기 제외 최대 2자
function variantsOf(map, cp, self) {
  const v = map.get(cp);
  if (!v) return '';
  const chars = v.split(/\s+/)
    .map((u) => /^U\+([0-9A-F]+)$/.exec(u))
    .filter(Boolean)
    .map((mm) => String.fromCodePoint(parseInt(mm[1], 16)))
    .filter((c) => c !== self);
  return chars.slice(0, 2).join('');
}

const out = {};
const stats = { strokes: 0, radical: 0, comps: 0, trad: 0, simp: 0, skipped: 0 };
for (const ch of universe) {
  const cp = ch.codePointAt(0);
  const s = parseInt((totalStrokes.get(cp) || '').split(/\s+/)[0], 10) || 0;
  const rsFirst = (rsUnicode.get(cp) || '').split(/\s+/)[0] || '';
  const rNum = parseInt(rsFirst, 10) || 0; // "61.9" / "149'.0" → 61 / 149
  const r = rNum >= 1 && rNum <= 214 ? RADICALS[rNum - 1] : '';
  const c = decomp.get(ch) || '';
  const t = variantsOf(tradVar, cp, ch);
  const p = variantsOf(simpVar, cp, ch);
  if (!s && !r && !c && !t && !p) { stats.skipped += 1; continue; }
  const entry = [s, r, c, t, p];
  while (entry.length > 1 && entry[entry.length - 1] === '') entry.pop();
  out[ch] = entry;
  if (s) stats.strokes += 1;
  if (r) stats.radical += 1;
  if (c) stats.comps += 1;
  if (t) stats.trad += 1;
  if (p) stats.simp += 1;
}

fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`hanjaEtym.json ${kb}KB · 항목 ${Object.keys(out).length}/${universe.length} (생략 ${stats.skipped})`);
console.log(`획수 ${stats.strokes} · 부수 ${stats.radical} · 분해 ${stats.comps} · 번체 ${stats.trad} · 간체 ${stats.simp}`);
for (const probe of ['想', '语', '爱', '相', '心', '干']) {
  console.log(`${probe} → ${JSON.stringify(out[probe])}`);
}
