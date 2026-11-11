/**
 * 공개 N5 25편 표기 전환(A-2) 마이그레이션의 데이터 칸 생성기(JA-KANJI-A-001 · 2026-11-11 KST).
 *
 * 정본 = supabase/data/ja-kanji-a2-n5.json(사람이 정한 토큰 고정표 — 자동 재분석이 아니다). 이 스크립트는 그 표를
 * 마이그레이션 SQL의 「-- jka-data:begin」 ~ 「-- jka-data:end」 사이 VALUES로만 옮긴다. 판단은 JSON에만 있다.
 *   node scripts/ja-kanji-a2.mjs <마이그레이션 .sql>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { JA_NA_ADJECTIVES } from '../src/lib/jaNaAdjectives.js';

const SPEC_URL = new URL('../supabase/data/ja-kanji-a2-n5.json', import.meta.url);
export const loadSpec = () => JSON.parse(readFileSync(SPEC_URL, 'utf8'));

/** 한자 표기와 가나 읽기의 공통 끝(오쿠리가나)을 뗀 어간 쌍 — 食べる/たべる → [食, た]. */
export function stems(kanji, kana) {
  let n = 0;
  while (n < kanji.length && n < kana.length && kanji[kanji.length - 1 - n] === kana[kana.length - 1 - n]) n++;
  return [kanji.slice(0, kanji.length - n), kana.slice(0, kana.length - n)];
}

const INFLECTING = new Set(['동사', '형용사']);
/** 가나 표기 → 자연 표기(한자). 활용형은 한자 어간 + 원래 가나 꼬리. 맞지 않으면 null. */
export function kanjiText(spec, kana, base, pos) {
  const w = spec.a2.write[base];
  if (!w) return null;
  if (!INFLECTING.has(pos)) return w[0];
  const [ks, rs] = stems(w[0], w[1]);
  return kana.startsWith(rs) ? ks + kana.slice(rs.length) : null;
}
/** 후리가나 — 명사류는 원래 가나 표기, 동사 · 형용사는 기본형 읽기(운영 관례). */
export function furiganaFor(spec, kana, base, pos) {
  const w = spec.a2.write[base];
  return INFLECTING.has(pos) && w ? w[1] : kana;
}

const lit = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (xs) => `ARRAY[${xs.map(lit).join(',')}]::text[]`;

export function dataSql(spec = loadSpec()) {
  const convert = new Set(spec.a2.convertIds);
  const rules = spec.rules.map((r) => `(${[r[0], r[1], r[2], r[3], r[5] ?? null].map(lit).join(',')})`);
  const write = Object.entries(spec.a2.write).map(([b, [t, r]]) => { const [ks, rs] = stems(t, r); return `(${[b, t, r, ks, rs].map(lit).join(',')})`; });
  const keep = spec.a2.keepKanaA2.map((x) => `(${lit(x)})`);
  const fixes = spec.fixes.map((f, i) => `(${i + 1},${f.id},${arr(f.keys)},${lit(f.old)})`);
  const pieces = spec.fixes.flatMap((f, i) => f.pieces.map((p, k) => {
    const kanji = p.kanji ?? (convert.has(f.id) ? kanjiText(spec, p.kana, p.base, p.pos) : null);
    const furi = p.furigana ?? (kanji && kanji !== p.kana ? furiganaFor(spec, p.kana, p.base, p.pos) : null);
    return `(${i + 1},${k + 1},${[p.kana, p.base, p.pos, p.meaning, kanji, furi].map(lit).join(',')})`;
  }));
  const expect = spec.expected.perMaterial.map((e) => `(${e.id},${lit(convert.has(e.id) ? 'convert' : 'kana')},${e.ruleHits},${e.converted},${e.fixKeys})`);
  const na = [...JA_NA_ADJECTIVES].map((x) => `(${lit(x)})`);
  return [
    `INSERT INTO pg_temp.jka_rule (ob, op, nb, np, mn) VALUES\n  ${rules.join(',\n  ')};`,
    `INSERT INTO pg_temp.jka_write (b, t, r, ks, rs) VALUES\n  ${write.join(',\n  ')};`,
    `INSERT INTO pg_temp.jka_keep (x) VALUES ${keep.join(',')};`,
    `INSERT INTO pg_temp.jka_fix (fx, mid, keys, old) VALUES\n  ${fixes.join(',\n  ')};`,
    `INSERT INTO pg_temp.jka_piece (fx, idx, kana, base, pos, meaning, kanji, furigana) VALUES\n  ${pieces.join(',\n  ')};`,
    `INSERT INTO pg_temp.jka_expect (mid, phase, rule_hits, converted, fix_keys) VALUES\n  ${expect.join(',\n  ')};`,
    `INSERT INTO pg_temp.jka_na (x) VALUES ${na.join(',')};`,
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const path = process.argv[2];
  const sql = readFileSync(path, 'utf8');
  const begin = '-- jka-data:begin\n';
  const end = '\n-- jka-data:end';
  const i = sql.indexOf(begin);
  const j = sql.indexOf(end);
  if (i < 0 || j < i) throw new Error('jka-data markers not found');
  writeFileSync(path, sql.slice(0, i + begin.length) + dataSql() + sql.slice(j));
  console.log('jka-data written');
}
