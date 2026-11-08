/**
 * VOA Learning English 자료실 글 → 공개 영어 시드 행(EN-SOURCE-001 ⓒ · 2026-11-09 KST).
 *
 * 권리 거름이 이 파일의 핵심이다. VOA 본문은 미국 정부 저작물(퍼블릭 도메인)이지만 AP · Reuters · AFP 기사와 그 각색은 아니다.
 * 각색 글도 본문만 보면 VOA 글처럼 읽혀서, 원문 끝 **기자 줄**(「X wrote this story for VOA Learning English.」 ·
 * 「Robin Millard reported on this story for Agence France-Presse. …」)로 가른다 — 1차 선별이 WHO 글(AFP 각색)을 놓친 실측(11/9 04:5x KST).
 * 기자 줄이 없거나 통신사가 나오면 넣지 않는다(fail-closed). 같은 검사가 마이그레이션 사전 검사에도 있다(재반입 · 추가분 공통).
 *
 *   node scripts/voa-seed.mjs <글 JSON> <마이그레이션 .sql>   — 파일 안 「-- voa-seed:begin」 ~ 「-- voa-seed:end」 사이 VALUES를 다시 쓴다.
 * 글 JSON = [{ title, url, date('15 Mar 2025'), section, credit(원문 기자 줄), paras: [문단] }] — 페이지에서 뽑은 원고(리포 밖).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** 기자 줄에 통신사가 나오면 참. 약칭(AP · AFP)은 대문자 낱말로만 본다(「app」 · 「map」 오탐 방지). 마이그레이션 사전 검사와 같은 규칙. */
const AGENCY_SHORT = /\b(?:AP|AFP)\b/;
const AGENCY_LONG = /associated press|reuters|agence france/i;
export function voaCreditIsAgency(credit) {
  const s = String(credit || '');
  return AGENCY_LONG.test(s) || AGENCY_SHORT.test(s);
}

/** 기자 줄이 VOA 글임을 말하는가 — 작성 · 각색 · 보도 동사가 있어야 한다. 비었거나 통신사면 false. */
export function voaCreditIsOwn(credit) {
  const s = String(credit || '').trim();
  return Boolean(s) && !voaCreditIsAgency(s) && /\b(?:wrote|reported|adapted)\b/i.test(s);
}

/** 화면에 남기지 않는 줄 — 영상 자리 표시 · 그림 출처. 문단 안 공백만 정리하고 표현은 고치지 않는다. */
const DROP_LINE = [/^No media source currently available$/, /^SOURCE: /];
export function voaCleanParagraphs(paras) {
  return (paras || [])
    .map((p) => String(p).replace(/​/g, '').replace(/[ \t]+/g, ' ').trim())
    .filter((p) => p && !DROP_LINE.some((re) => re.test(p)));
}

function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}
/** Flesch-Kincaid 학년(대략) — 급수 나눔에만 쓴다. */
export function fleschKincaid(text) {
  const sentences = text.split(/[.!?]+\s/).filter(Boolean).length || 1;
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (!words.length) return 0;
  return 0.39 * words.length / sentences + 11.8 * words.reduce((n, w) => n + syllables(w), 0) / words.length - 15.59;
}

const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const URL_RE = /^https:\/\/learningenglish\.voanews\.com\/a\/[\w-]+\/\d+\.html$/;
const AW_RE = /^Academic Writing: Common Sentence Patterns, Part (One|Two)$/;
const DQ = '$' + 'voa' + '$';

/** 글 → { rows, excluded }. rows = { title, level, source, body }, excluded = { title, reason }. */
export function buildVoaSeedRows(articles) {
  const rows = [];
  const excluded = [];
  for (const a of articles || []) {
    const title0 = String(a.title || '').replace(/\s+/g, ' ').trim();
    const credit = String(a.credit || '').replace(/\s+/g, ' ').trim();
    if (voaCreditIsAgency(credit)) { excluded.push({ title: title0, reason: 'agency-credit' }); continue; }
    if (!voaCreditIsOwn(credit)) { excluded.push({ title: title0, reason: 'no-voa-credit' }); continue; }
    if (!URL_RE.test(String(a.url || ''))) { excluded.push({ title: title0, reason: 'url' }); continue; }
    const paras = voaCleanParagraphs(a.paras);
    const body = paras.join('\n');
    if (!body || body.includes(DQ)) { excluded.push({ title: title0, reason: 'body' }); continue; }
    const aw = AW_RE.exec(title0);
    const code = aw ? 'B1' : fleschKincaid(paras.join(' ')) < 7.5 ? 'A2' : 'B1';
    const [d, m, y] = String(a.date || '').trim().split(/\s+/);
    rows.push({
      title: aw ? `[B1 writing #${aw[1] === 'One' ? 1 : 2}] ${title0}` : `[${code}] ${title0}`,
      level: code === 'A2' ? 'A2 초급' : 'B1 중급',
      source: { kind: 'web', site: 'voa_le', channel: 'VOA Learning English', url: a.url, license: 'public-domain',
        section: a.section, credit, feed_date: MON[m] ? `${y}-${MON[m]}-${d.padStart(2, '0')}` : null },
      body,
    });
  }
  rows.sort((p, q) => (p.level === q.level ? p.title.localeCompare(q.title) : p.level.localeCompare(q.level)));
  return { rows, excluded };
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
export function voaValuesSql(rows) {
  return rows.map((r) => `    (${lit(r.title)}, ${lit(r.level)}, ${lit(JSON.stringify(r.source))}::jsonb, ${DQ}${r.body}${DQ})`).join(',\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [input, sqlPath] = process.argv.slice(2);
  const { rows, excluded } = buildVoaSeedRows(JSON.parse(readFileSync(input, 'utf8')));
  const sql = readFileSync(sqlPath, 'utf8');
  const begin = '-- voa-seed:begin\n';
  const end = '\n-- voa-seed:end';
  const i = sql.indexOf(begin);
  const j = sql.indexOf(end);
  if (i < 0 || j < i) throw new Error('voa-seed markers not found');
  writeFileSync(sqlPath, sql.slice(0, i + begin.length) + voaValuesSql(rows) + sql.slice(j));
  console.log(`voa-seed: ${rows.length} rows, excluded ${excluded.length}`, excluded);
}
