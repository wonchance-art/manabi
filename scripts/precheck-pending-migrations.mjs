#!/usr/bin/env node
/**
 * 병합 전 운영 상수 대조(런북 K-0 일반화 — FINGERPRINT-REPIN-002 ⑶). 운영에 아직 없는 마이그레이션이 주석 밖 코드에 박은
 * 32자리 md5 상수를 모두 뽑아, 운영에서 **읽기 전용**으로 각 값을 다시 계산하는 SQL 한 덩이를 출력한다(이 스크립트는 DB에 붙지 않는다).
 * 결과 행 = 상수 하나: 파일 · 줄 · 값 · 「지금 운영에서 같은 값인 양」(matches_now) · 파일 안에서 정해지는 값(offline, 예: 이 파일이
 * 새로 만드는 함수 본문의 md5). 둘 다 비면 그 상수는 운영의 어떤 양과도 맞지 않는다 — 병합 전에 멈추고 본다.
 *
 * 다시 계산하는 양: capability(게시 · 실제 지문 · 본문 템플릿 · 지문 SELECT md5) · FSRS 게시값 넷과 지금 계산값 넷 ·
 * capability 고정값을 지금 실제값으로 재게시했을 때의 core(191500 뒤 core 예측) · 상수 옆에 이름이 적힌 함수들의 본문 md5.
 * 실제 지문 · core 지문 SELECT는 운영 관측 정의(fixture)에서 가져오고, SQL 안에서 운영 본문과 같은지(…matches_embedded)를 함께 낸다.
 *
 *   node scripts/precheck-pending-migrations.mjs --after 20261016165910            (그 버전 뒤 저장소 마이그레이션 전부)
 *   node scripts/precheck-pending-migrations.mjs supabase/migrations/2026…_x.sql …  (파일 지정)
 *   --no-context: 결과에 코드 줄(context)을 싣지 않는다(SQL 편집기 · MCP에 붙이기 짧게)
 * 출력 SQL은 `begin transaction read only; set local search_path = ''; … rollback;` — 쓰기가 섞이면 Postgres가 거부한다.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FIXTURE = 'supabase/tests/fixtures/m09-learning-contracts-20261010.sql';
const md5 = text => createHash('md5').update(text).digest('hex');
const lit = text => `'${String(text).replaceAll("'", "''")}'`;

/** 주석(-- · /* *\/)을 같은 길이의 공백으로 지운다 — 줄 번호와 위치가 그대로다. 문자열 · 달러 인용 속 「--」는 지우지 않는다. */
export function blankComments(sql) {
  let out = '', i = 0, dollar = null, quote = false;
  while (i < sql.length) {
    if (dollar) { if (sql.startsWith(dollar, i)) { out += dollar; i += dollar.length; dollar = null; } else out += sql[i++]; continue; }
    if (quote) { if (sql[i] === "'" && sql[i + 1] === "'") { out += "''"; i += 2; } else { if (sql[i] === "'") quote = false; out += sql[i++]; } continue; }
    if (sql.startsWith('--', i)) { const end = sql.indexOf('\n', i); const stop = end < 0 ? sql.length : end; out += ' '.repeat(stop - i); i = stop; continue; }
    if (sql.startsWith('/*', i)) { const end = sql.indexOf('*/', i + 2); const stop = end < 0 ? sql.length : end + 2; out += sql.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 64));
    if (tag && !/[A-Za-z0-9_]/.test(sql[i - 1] || '')) { dollar = tag[0]; out += dollar; i += dollar.length; continue; }
    if (sql[i] === "'") quote = true;
    out += sql[i++];
  }
  return out;
}

/** 이 파일이 새로 정의하는 함수 본문(`CREATE … FUNCTION 이름(…) … AS $tag$본문$tag$`)의 md5 → 이름. */
export function ownBodies(sql) {
  const out = new Map();
  for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\([^)]*\)[\s\S]*?\bAS\s+(\$[A-Za-z_]*\$)([\s\S]*?)\2/gi)) {
    out.set(md5(m[3]), m[1]);
    out.set(md5(m[3].replace(/^\n|\n$/g, '')), `${m[1]} (안쪽 SELECT)`);
  }
  return out;
}

/** 주석 밖 코드의 32자리 md5 상수(앞뒤가 16진 글자가 아닌 것). */
export function extractConstants(sql, file) {
  const code = blankComments(sql);
  const lines = code.split('\n'), raw = sql.split('\n');
  const bodies = ownBodies(sql);
  const out = [];
  lines.forEach((line, n) => {
    for (const m of line.matchAll(/(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/g)) {
      out.push({ file, line: n + 1, value: m[0], context: raw[n].trim().slice(0, 160), offline: bodies.get(m[0]) || '' });
    }
  });
  return out;
}

/** 상수 옆에 이름이 적힌 함수 서명(본문 md5를 다시 계산할 대상). */
export function signatures(sql) {
  const code = blankComments(sql);
  return [...new Set([...code.matchAll(/'((?:public|fsrs_private|library_private|auth)\.[a-z_][a-z0-9_]*\([a-z0-9_, [\]]*\))'/g)].map(m => m[1]))].sort();
}

function observedQueries(fixture) {
  const capBody = fixture.match(/CREATE OR REPLACE FUNCTION public\.learning_language_capabilities\(\)[\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1];
  const live = capBody?.match(/(WITH RECURSIVE [\s\S]*FROM objects) INTO live_hash;/)?.[1];
  const core = fixture.match(/CREATE OR REPLACE FUNCTION fsrs_private\.contract_hash\(\)[\s\S]*?AS \$function\$\n([\s\S]*?FROM objects)\n\$function\$;/)?.[1];
  const coreBody = fixture.match(/CREATE OR REPLACE FUNCTION fsrs_private\.contract_hash\(\)[\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/)?.[1];
  if (!live || !core || !coreBody) throw new Error('precheck: 관측 fixture에서 capability · core 지문 SELECT를 찾지 못했다');
  const fnLine = 'jsonb_build_array(pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_proc p JOIN pg_namespace n';
  if (core.split(fnLine).length !== 2) throw new Error('precheck: core 지문의 함수 줄이 예상과 다르다');
  const predicted = core.replace(fnLine, `jsonb_build_array(CASE WHEN p.oid=to_regprocedure('public.learning_language_capabilities()') THEN replace(pg_get_functiondef(p.oid),'ready:=live_hash= '''||(SELECT pin FROM cap)||'''','ready:=live_hash= '''||(SELECT live FROM cap)||'''') ELSE pg_get_functiondef(p.oid) END,p.proacl,p.proowner) FROM pg_proc p JOIN pg_namespace n`);
  return { live, liveMd5: md5(live), core, coreBodyMd5: md5(coreBody), predicted };
}

export function buildSql(constants, sigs, fixture, { context = true } = {}) {
  const q = observedQueries(fixture);
  const capOid = "pg_catalog.to_regprocedure('public.learning_language_capabilities()')";
  const rows = [
    ['capability.pinned', '(SELECT pin FROM cap)'],
    ['capability.live', '(SELECT live FROM cap)'],
    ['capability.template_md5', `(SELECT pg_catalog.md5(pg_catalog.regexp_replace(prosrc,'ready:=live_hash= ''([0-9a-f]{32})''','ready:=live_hash= ''<hash>''')) FROM pg_catalog.pg_proc WHERE oid=${capOid})`],
    ['capability.fingerprint_md5', `(SELECT pg_catalog.md5(substring(prosrc from '(WITH RECURSIVE .*FROM objects) INTO live_hash;')) FROM pg_catalog.pg_proc WHERE oid=${capOid})`],
    ['fsrs.core', '(SELECT contract_hash FROM fsrs_private.settings)'],
    ['fsrs.manual', '(SELECT contract_hash FROM fsrs_private.manual_save_settings)'],
    ['fsrs.admission', '(SELECT contract_hash FROM fsrs_private.admission_settings)'],
    ['fsrs.profile', '(SELECT profile_contract_hash FROM fsrs_private.activity_settings)'],
    ['fsrs.core_computed', 'fsrs_private.contract_hash()'],
    ['fsrs.manual_computed', 'fsrs_private.manual_contract_hash()'],
    ['fsrs.admission_computed', 'fsrs_private.admission_contract_hash()'],
    ['fsrs.profile_computed', 'fsrs_private.activity_profile_hash()'],
    ['fsrs.core_after_capability_repin', `(${q.predicted})`],
    ...sigs.map(sig => [`prosrc_md5:${sig}`, `(SELECT pg_catalog.md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(${lit(sig)}))`]),
  ];
  const values = constants.length
    ? constants.map(c => `(${lit(c.file)},${c.line},${lit(c.value)},${lit(c.offline)},${lit(context ? c.context : '')})`).join(',\n  ')
    : `(NULL,NULL,NULL,NULL,NULL)`;
  return `-- generated by scripts/precheck-pending-migrations.mjs — READ ONLY (운영 쓰기 없음)
begin transaction read only;
set local search_path = '';
with cap(pin, live) as (
 select (select substring(prosrc from 'ready:=live_hash= ''([0-9a-f]{32})''') from pg_catalog.pg_proc where oid=${capOid}),
  (
${q.live}
  )
), q(name, value) as (
${rows.map(([name, expr]) => ` select ${lit(name)}, ${expr}`).join('\n union all\n')}
), checks as (
 select (select pg_catalog.md5(substring(prosrc from '(WITH RECURSIVE .*FROM objects) INTO live_hash;')) from pg_catalog.pg_proc where oid=${capOid}) = ${lit(q.liveMd5)} as capability_fingerprint_matches_embedded,
  (select pg_catalog.md5(prosrc) from pg_catalog.pg_proc where oid=coalesce(pg_catalog.to_regprocedure('fsrs_private.contract_hash_live()'), pg_catalog.to_regprocedure('fsrs_private.contract_hash()'))) = ${lit(q.coreBodyMd5)} as core_fingerprint_matches_embedded
), lits(file, line, value, offline, context) as (values
  ${values}
)
select l.file, l.line, l.value,
  coalesce((select pg_catalog.string_agg(q.name, ', ' order by q.name) from q where q.value = l.value), '') as matches_now,
  l.offline, l.context,
  (select capability_fingerprint_matches_embedded from checks) as cap_fp_ok, (select core_fingerprint_matches_embedded from checks) as core_fp_ok,
  pg_catalog.to_char(pg_catalog.now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as kst
from lits l where l.value is not null order by l.file, l.line;
rollback;
`;
}

export function pendingFiles({ after, files }, root = ROOT) {
  if (files.length) return files;
  if (!/^\d{14}$/.test(after || '')) throw new Error('precheck: --after <운영에 적용된 마지막 버전 14자리> 또는 파일을 준다');
  const dir = path.join(root, 'supabase/migrations');
  return readdirSync(dir).filter(f => /^\d{14}_.+\.sql$/.test(f) && f.slice(0, 14) > after).sort().map(f => path.join('supabase/migrations', f));
}

function main(argv) {
  const files = [], opts = { after: null, context: true };
  for (let i = 0; i < argv.length; i++) { if (argv[i] === '--after') opts.after = argv[++i]; else if (argv[i] === '--no-context') opts.context = false; else files.push(argv[i]); }
  const list = pendingFiles({ ...opts, files });
  const constants = [], sigs = new Set();
  for (const file of list) {
    const sql = readFileSync(path.resolve(ROOT, file), 'utf8');
    constants.push(...extractConstants(sql, path.basename(file)));
    for (const s of signatures(sql)) sigs.add(s);
  }
  process.stdout.write(buildSql(constants, [...sigs].sort(), readFileSync(path.join(ROOT, FIXTURE), 'utf8'), { context: opts.context }));
  process.stderr.write(`precheck: ${list.length}개 파일 · 상수 ${constants.length}개 · 함수 ${sigs.size}개\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
