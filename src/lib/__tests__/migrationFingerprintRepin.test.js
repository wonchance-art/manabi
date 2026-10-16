import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 학습 계약 지문 재게시 계약(FINGERPRINT-REPIN-001, docs/architecture-and-handoff.md §4.9-1).
 *
 * 운영 한국어 학습 capability(`public.learning_language_capabilities()`)와 FSRS 계약 넷(core · manual · admission ·
 * activity)은 정해진 테이블 · 함수 · 트리거의 정책 · 인덱스 · 컬럼 · 권한 · 본문을 md5 지문으로 묶어 상수로 박아 두고, 같을 때만
 * 켜진다. 그 범위를 건드리는 마이그레이션이 같은 파일에서 상수를 다시 게시하지 않으면 운영 기능이 통째로 꺼진다 —
 * #1504(20261016150000_anon_book_catalog.sql)가 reading_materials에 RESTRICTIVE 정책 하나를 더하고 재게시하지 않아 운영 한국어
 * 학습이 꺼졌는데 CI는 아무것도 잡지 못했다(PGlite 검사는 그 파일만 적용하고 지문 함수를 싣지 않았다).
 *
 * 범위는 여기 다시 적지 않는다 — 운영 관측 정의(supabase/tests/fixtures/m09-learning-contracts-20261010.sql)의 지문 함수 본문에서
 * 직접 읽는다. 그 이후(관측일 2026-10-10 다음) 마이그레이션이 범위를 건드리면 같은 파일에 ⑴ 재게시 문(아래 REPIN)이 있거나
 * ⑵ FSRS 계약이면 적용 뒤 「지문 = 게시값」 검사(… is distinct from fsrs_private.<지문>() → raise)가 있거나 ⑶ 이유를 적은
 * 표식 `-- fingerprint-scope-optout: <scope> — <이유>`가 있어야 한다.
 */
const ROOT = path.resolve(__dirname, '../../..');
const FIXTURE = 'supabase/tests/fixtures/m09-learning-contracts-20261010.sql';
const MIGRATIONS = 'supabase/migrations';
const OBSERVED_AFTER = '20261010999999'; // 관측 이후 마이그레이션만 — 그 전 것은 관측된 운영 상태에 이미 들어 있다.
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

// 지문 함수(이름 → 재게시 · 적용 후 검사 표현). 범위 자체는 함수 본문에서 읽는다.
const CONTRACTS = {
  capability: { fn: 'public.learning_language_capabilities', repinRedefines: true, repin: /create\s+or\s+replace\s+function\s+public\.learning_language_capabilities\s*\(/i, check: null },
  core: { fn: 'fsrs_private.contract_hash', repin: /update\s+fsrs_private\.settings\s+set\s+contract_hash/i, check: /is\s+distinct\s+from\s+fsrs_private\.contract_hash\(\)/i },
  manual: { fn: 'fsrs_private.manual_contract_hash', repin: /update\s+fsrs_private\.manual_save_settings\s+set\s+contract_hash/i, check: /is\s+distinct\s+from\s+fsrs_private\.manual_contract_hash\(\)/i },
  admission: { fn: 'fsrs_private.admission_contract_hash', repin: /update\s+fsrs_private\.admission_settings\s+set\s+contract_hash/i, check: /is\s+distinct\s+from\s+fsrs_private\.admission_contract_hash\(\)/i },
  activity: { fn: 'fsrs_private.activity_profile_hash', repin: /update\s+fsrs_private\.activity_settings\s+set\s+profile_contract_hash/i, check: /is\s+distinct\s+from\s+fsrs_private\.activity_profile_hash\(\)/i },
};

/**
 * 이미 운영에 나간 위반 — 고치는 마이그레이션이 준비되는 동안만 둔다. 고쳐지면(위반이 사라지면) 아래 검사가 이 항목을 지우라고 실패한다.
 * 고치는 쪽은 별도 마이그레이션(같은 트랜잭션: 적용 전 지문 확인 → capability 상수 재게시 → FSRS core contract_hash 재게시,
 * 본보기 docs/sql/korean-source-passage.sql r3)이라 이 파일 자체는 그대로 위반으로 남는다 — 그때 fixedBy를 채운다.
 */
const KNOWN_VIOLATIONS = {
  '20261016150000_anon_book_catalog.sql': {
    scopes: ['capability', 'core'],
    ticket: 'KO-CAP-REPIN-001 — #1504 anon_book_chapters_hidden(reading_materials 정책) 뒤 capability 상수 · FSRS core 재게시 마이그레이션 준비 중',
    fixedBy: null,
  },
};

function functionBody(sql, qualified) {
  const start = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION ${qualified.replace('.', '\\.')}\\(`, 'i'));
  if (start < 0) throw new Error(`fixture에 ${qualified} 정의가 없다`);
  const end = sql.indexOf('$function$;', start);
  if (end < 0) throw new Error(`${qualified} 본문 끝을 찾지 못했다`);
  return sql.slice(start, end);
}

const norm = name => {
  const clean = name.replace(/"/g, '').toLowerCase().trim();
  return clean.includes('.') ? clean : `public.${clean}`;
};

/** 지문 함수 본문 → 범위(테이블 · 함수 · 트리거 이름 · 와일드카드). */
export function scopeFromBody(body) {
  const tables = new Set(), functions = new Set(), triggers = new Set(), schemas = new Set(), tablePrefixes = new Set(), functionPrefixes = new Set();
  const schemaAcls = new Set(), roles = new Set();
  for (const [, name] of body.matchAll(/'([\w]+\.[\w]+)'::regclass/g)) tables.add(norm(name));
  for (const [, name] of body.matchAll(/'([\w]+\.[\w]+)\([^']*\)'::regprocedure/g)) functions.add(norm(name));
  for (const [, name] of body.matchAll(/to_regprocedure\('([\w]+\.[\w]+)\(/g)) functions.add(norm(name));
  for (const [, name] of body.matchAll(/\('((?:public|fsrs_private|auth|library_private)\.[\w]+)\([^)]*\)'\)/g)) functions.add(norm(name));
  for (const [, list] of body.matchAll(/c\.relname IN \(([^)]*)\)/g)) for (const [, name] of list.matchAll(/'([\w]+)'/g)) tables.add(`public.${name}`);
  for (const [, list] of body.matchAll(/tgname IN \(([^)]*)\)/g)) for (const [, name] of list.matchAll(/'([\w]+)'/g)) triggers.add(name);
  if (/nspname\s*=\s*'fsrs_private'\s+OR/i.test(body)) schemas.add('fsrs_private');
  if (/c\.relname LIKE 'fsrs\\_%'/.test(body)) tablePrefixes.add('public.fsrs_');
  if (/p\.proname LIKE 'fsrs\\_%'/.test(body)) functionPrefixes.add('public.fsrs_');
  for (const [, name] of body.matchAll(/p\.proname\s*=\s*'([\w]+)'/g)) functions.add(`public.${name}`);
  // 스키마 권한(nspacl · 소유자)과 역할 속성 · 소속(rolname IN …의 닫힘)도 지문에 든다.
  for (const [, list] of body.matchAll(/nspname IN \(([^)]*)\)/g)) for (const [, name] of list.matchAll(/'([\w]+)'/g)) schemaAcls.add(name);
  for (const [, list] of body.matchAll(/rolname IN \(([^)]*)\)/g)) for (const [, name] of list.matchAll(/'([\w]+)'/g)) roles.add(name);
  return { tables, functions, triggers, schemas, tablePrefixes, functionPrefixes, schemaAcls, roles };
}

/** fixture의 CREATE TRIGGER … ON <table> … EXECUTE FUNCTION <fn>() — 범위 테이블의 트리거 함수도 지문에 든다(tgfoid). */
function triggerFunctionsOn(sql, tables) {
  const out = new Set();
  for (const [, table, fn] of sql.matchAll(/^CREATE TRIGGER \w+ [^\n]*? ON ([\w.]+) [^\n]*EXECUTE FUNCTION ([\w.]+)\(/gim)) {
    if (tables.has(norm(table))) out.add(norm(fn));
  }
  return out;
}

export function loadScopes(fixture = read(FIXTURE)) {
  const scopes = {};
  for (const [key, { fn }] of Object.entries(CONTRACTS)) {
    const body = functionBody(fixture, fn);
    const scope = scopeFromBody(body);
    // activity는 의존 함수(activity_profile_dependencies)가 profiles 표현식을 읽는다 — 같은 테이블이다.
    for (const name of triggerFunctionsOn(fixture, scope.tables)) scope.functions.add(name);
    scope.chainsTo = new Set();
    scopes[key] = scope;
  }
  // 지문이 다른 지문을 품는 연쇄(값이 바뀌면 품은 쪽도 바뀐다):
  //  ⑴ 정의 연쇄 — capability는 상수를 함수 정의에 박아 재게시하므로, 그 함수 정의를 지문에 넣는 계약(core)이 따라 바뀐다.
  //  ⑵ 결과 연쇄 — 지문 함수의 결과를 그대로 넣는 계약(admission ← activity_profile_hash()).
  // FSRS 재게시는 설정 행만 고치고(행은 지문 밖) 함수 정의는 그대로라 정의 연쇄를 만들지 않는다.
  for (const [key, scope] of Object.entries(scopes)) {
    const body = functionBody(fixture, CONTRACTS[key].fn);
    for (const [other, { fn }] of Object.entries(CONTRACTS)) {
      if (other === key) continue;
      const definitional = CONTRACTS[other].repinRedefines && scope.functions.has(fn);
      const result = new RegExp(`[^'\\w.]${fn.replace('.', '\\.')}\\(\\)`).test(body);
      if (definitional || result) scopes[other].chainsTo.add(key);
    }
  }
  return scopes;
}

const inScope = (scope, kind, name) => {
  const [schema] = name.split('.');
  if (scope.schemas.has(schema)) return true;
  if (kind === 'table') return scope.tables.has(name) || [...scope.tablePrefixes].some(p => name.startsWith(p));
  if (kind === 'function') return scope.functions.has(name) || [...scope.functionPrefixes].some(p => name.startsWith(p));
  if (kind === 'trigger') return scope.triggers.has(name);
  if (kind === 'schema') return scope.schemaAcls.has(name.split('.').pop());
  if (kind === 'role') return scope.roles.has(name.split('.').pop());
  return false;
};

const stripComments = sql => sql.replace(/--[^\n]*/g, '');
const ID = '(?:"[^"]+"|[\\w]+)(?:\\.(?:"[^"]+"|[\\w]+))?';

/** 마이그레이션의 DDL · 권한 문 → 건드린 대상. 주석은 빼고(롤백 안내 등), 동적 SQL 문자열 안의 DDL은 센다(보수적). */
export function touchedObjects(sql) {
  const text = stripComments(sql);
  const hits = [];
  const add = (kind, name, statement) => hits.push({ kind, name: norm(name), statement: statement.replace(/\s+/g, ' ').trim().slice(0, 120) });
  for (const m of text.matchAll(new RegExp(`\\b(create|alter|drop)\\s+policy\\s+(?:if\\s+exists\\s+)?${ID}\\s+on\\s+(${ID})`, 'gi'))) add('table', m[2], m[0]);
  for (const m of text.matchAll(new RegExp(`\\bcreate\\s+(?:unique\\s+)?index\\s+(?:concurrently\\s+)?(?:if\\s+not\\s+exists\\s+)?(?:${ID}\\s+)?on\\s+(?:only\\s+)?(${ID})`, 'gi'))) add('table', m[1], m[0]);
  for (const m of text.matchAll(new RegExp(`\\b(?:create(?:\\s+or\\s+replace)?(?:\\s+constraint)?|drop)\\s+trigger\\s+(?:if\\s+exists\\s+)?(${ID})[\\s\\S]{0,300}?\\bon\\s+(${ID})`, 'gi'))) { add('table', m[2], m[0]); add('trigger', m[1].split('.').pop(), m[0]); }
  for (const m of text.matchAll(new RegExp(`\\balter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?(${ID})`, 'gi'))) add('table', m[1], m[0]);
  for (const m of text.matchAll(new RegExp(`\\b(?:create(?:\\s+or\\s+replace)?|drop)\\s+(?:table|view|materialized\\s+view)\\s+(?:if\\s+(?:not\\s+)?exists\\s+)?(${ID})`, 'gi'))) add('table', m[1], m[0]);
  for (const m of text.matchAll(new RegExp(`\\b(?:create(?:\\s+or\\s+replace)?|alter|drop)\\s+function\\s+(?:if\\s+exists\\s+)?(${ID})\\s*\\(`, 'gi'))) add('function', m[1], m[0]);
  for (const m of text.matchAll(new RegExp(`\\b(?:grant|revoke)\\b[^;]{0,300}?\\bon\\s+(?:(function|table)\\s+)?(${ID})`, 'gi'))) {
    if (/^(all|schema)$/i.test(m[2])) continue; // 아래(스키마 · 전체)에서 따로
    add(m[1]?.toLowerCase() === 'function' ? 'function' : 'table', m[2], m[0]);
  }
  for (const m of text.matchAll(/\b(?:grant|revoke)\b[^;]{0,200}?\bon\s+schema\s+(\w+)/gi)) add('schema', m[1], m[0]);
  for (const m of text.matchAll(/\balter\s+schema\s+(\w+)/gi)) add('schema', m[1], m[0]);
  for (const m of text.matchAll(/\balter\s+role\s+(\w+)/gi)) add('role', m[1], m[0]);
  for (const m of text.matchAll(/\b(?:grant|revoke)\s+(\w+)\s+(?:to|from)\s+(\w+)/gi)) { add('role', m[1], m[0]); add('role', m[2], m[0]); }
  for (const m of text.matchAll(/\b(?:grant|revoke)\b[^;]{0,300}?\bon\s+all\s+(tables|functions|routines)\s+in\s+schema\s+(\w+)/gi)) {
    add(/tables/i.test(m[1]) ? 'table' : 'function', `${m[2]}.*`, m[0]);
  }
  return hits;
}

const optOuts = sql => new Set([...sql.matchAll(/--\s*fingerprint-scope-optout:\s*(\w+)\s*—\s*(\S[^\n]{9,})/g)].map(m => m[1]));

/** 한 마이그레이션 파일 → 재게시가 필요한데 없는 지문 목록. */
export function missingRepins(sql, scopes) {
  const hits = touchedObjects(sql);
  const direct = new Set();
  const why = {};
  for (const hit of hits) {
    for (const [key, scope] of Object.entries(scopes)) {
      const wildcard = hit.name.endsWith('.*') && (scope.schemas.has(hit.name.split('.')[0])
        || [...(hit.kind === 'table' ? scope.tables : scope.functions)].some(n => n.startsWith(hit.name.slice(0, -1))));
      if (wildcard || inScope(scope, hit.kind, hit.name)) { direct.add(key); (why[key] ||= []).push(hit.statement); }
    }
  }
  const optedOut = optOuts(sql);
  // 지문별 판정: 재게시 → 바뀜(연쇄 전파), 적용 뒤 검사(직접 건드린 FSRS 계약만) · 이유 있는 opt-out → 안 바뀜, 그 밖 → 누락
  // (바뀐 것으로 보고 전파). 연쇄로 요구된 계약은 재게시나 opt-out으로만 풀린다. 연쇄는 짧아 고정점까지 되풀이한다.
  const required = new Set(direct), chainedBy = {};
  const judge = key => {
    const { repin, check } = CONTRACTS[key];
    if (repin.test(sql)) return 'repinned';
    if (optedOut.has(key)) return 'unchanged';
    return check && check.test(sql) && !chainedBy[key] ? 'unchanged' : 'missing';
  };
  for (let grew = true; grew;) {
    grew = false;
    for (const key of [...required]) {
      if (judge(key) === 'unchanged') continue;
      for (const next of scopes[key].chainsTo) {
        if (chainedBy[next]?.includes(key)) continue;
        (chainedBy[next] ||= []).push(key);
        (why[next] ||= []).push(`(연쇄) ${key} 지문 변경`);
        required.add(next);
        grew = true;
      }
    }
  }
  const status = Object.fromEntries([...required].map(key => [key, judge(key)]));
  const missing = [...required].filter(key => status[key] === 'missing');
  return { missing: missing.sort(), why };
}

const migrationFiles = () => fs.readdirSync(path.join(ROOT, MIGRATIONS)).filter(f => f.endsWith('.sql')).sort();

describe('지문 범위는 운영 관측 정의에서 읽는다', () => {
  const scopes = loadScopes();
  it('capability — 학습 테이블 · reading_materials · uploaded_pdfs와 그 트리거 함수', () => {
    for (const table of ['public.user_vocabulary', 'public.reading_materials', 'public.uploaded_pdfs', 'public.review_events', 'public.vocabulary_with_exclusions']) {
      expect(scopes.capability.tables.has(table), table).toBe(true);
    }
    expect(scopes.capability.functions.has('public.save_vocabulary_context')).toBe(true);
    expect(scopes.capability.functions.has('public.validate_source_passage')).toBe(true); // reading_materials 트리거 함수
    expect(scopes.capability.tables.has('public.profiles')).toBe(false);
  });
  it('core — fsrs_private 전체 · public.fsrs_* · capability 함수 · 레거시 가드 트리거, capability → core 연쇄', () => {
    expect(scopes.core.schemas.has('fsrs_private')).toBe(true);
    expect([...scopes.core.tablePrefixes]).toEqual(['public.fsrs_']);
    expect(scopes.core.functions.has('public.learning_language_capabilities')).toBe(true);
    expect([...scopes.core.triggers].sort()).toEqual(['fsrs_guard_legacy_event', 'fsrs_guard_legacy_vocabulary']);
    expect(scopes.capability.chainsTo.has('core')).toBe(true);
  });
  it('manual · admission · activity — 목록 · profiles, activity → admission 연쇄', () => {
    expect(scopes.manual.tables.has('public.fsrs_manual_save_receipts')).toBe(true);
    expect(scopes.admission.functions.has('public.learning_admission_status')).toBe(true);
    expect(scopes.activity.tables.has('public.profiles')).toBe(true);
    expect(scopes.activity.functions.has('public.update_streak')).toBe(true);
    expect(scopes.activity.chainsTo.has('admission')).toBe(true);
  });
});

describe('검출기', () => {
  const scopes = loadScopes();
  it('#1504 모양(정책 하나)은 capability + 연쇄 core 재게시를 요구한다 · 주석 속 DDL은 세지 않는다', () => {
    const sql = '-- 롤백: DROP POLICY IF EXISTS x ON public.user_vocabulary;\nCREATE POLICY p ON public.reading_materials AS RESTRICTIVE FOR SELECT TO anon USING (true);';
    expect(missingRepins(sql, scopes).missing).toEqual(['capability', 'core']);
    expect(missingRepins('-- DROP POLICY x ON public.reading_materials;\nselect 1;', scopes).missing).toEqual([]);
  });
  it('재게시 문이 있으면 통과, 이유 있는 opt-out도 통과(이유 없는 표식은 무효)', () => {
    const touch = 'CREATE INDEX i ON public.review_events (user_id);\n';
    const repinned = `${touch}EXECUTE format('CREATE OR REPLACE FUNCTION public.learning_language_capabilities() RETURNS jsonb ...');\nUPDATE fsrs_private.settings SET contract_hash = core_after;`;
    expect(missingRepins(repinned, scopes).missing).toEqual([]);
    expect(missingRepins(`${touch}-- fingerprint-scope-optout: capability — 인덱스는 지문에 들어가지만 PGlite에서 재계산해 같음을 확인함\n-- fingerprint-scope-optout: core — capability 정의를 바꾸지 않아 연쇄 없음`, scopes).missing).toEqual([]);
    expect(missingRepins(`${touch}-- fingerprint-scope-optout: capability — 짧음`, scopes).missing).toEqual(['capability', 'core']);
  });
  it('FSRS 계약: 적용 뒤 「지문 = 게시값」 검사(raise)가 있으면 바뀌지 않았다는 증명으로 받는다 — 없으면 연쇄(activity → admission)까지', () => {
    const policy = 'create policy p on public.profiles for select using (true);\n';
    expect(missingRepins(policy, scopes).missing).toEqual(['activity', 'admission']);
    const checked = `${policy}do $$ begin if (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then raise exception 'drift'; end if; end $$;`;
    expect(missingRepins(checked, scopes).missing).toEqual([]);
    // 연쇄로 요구된 계약은 검사만으로 풀리지 않는다 — capability 정책 변경의 core 연쇄는 core 재게시가 필요하다.
    const capability = 'create policy p on public.reading_materials for select using (true);\nEXECUTE format(\'CREATE OR REPLACE FUNCTION public.learning_language_capabilities() ...\');\nselect 1 where (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash();';
    expect(missingRepins(capability, scopes).missing).toEqual(['core']);
  });
  it('스키마 권한 · 역할 속성도 지문에 든다 — public 스키마 GRANT · anon 역할 변경', () => {
    expect(missingRepins('grant usage on schema public to anon;', scopes).missing).toEqual(expect.arrayContaining(['capability', 'core']));
    expect(missingRepins('alter role authenticated set statement_timeout = 0;', scopes).missing).toEqual(expect.arrayContaining(['capability', 'core']));
    expect(missingRepins('grant usage on schema conversation_private to authenticated;', scopes).missing).toEqual([]);
  });
  it('범위 밖(대화 로비 테이블 · 새 함수)은 아무것도 요구하지 않는다', () => {
    expect(missingRepins('create table public.conversation_lobby(id uuid);\ncreate function public.lobby_join(uuid) returns void language sql as $$ select $$;\ngrant execute on function public.lobby_join(uuid) to authenticated;', scopes).missing).toEqual([]);
  });
});

describe('관측 이후 마이그레이션은 범위를 건드리면 같은 파일에서 재게시한다', () => {
  const scopes = loadScopes();
  const files = migrationFiles().filter(f => f.slice(0, 14) > OBSERVED_AFTER);
  it('대상 마이그레이션이 있다(빈 목록 통과 방지)', () => {
    expect(files).toContain('20261016150000_anon_book_catalog.sql');
  });
  it.each(files)('%s', file => {
    const { missing, why } = missingRepins(read(`${MIGRATIONS}/${file}`), scopes);
    const known = KNOWN_VIOLATIONS[file];
    if (known) {
      // 허용 목록은 실제 위반과 정확히 같아야 한다 — 위반이 사라지거나 늘면 목록을 고치라고 알린다.
      expect(missing, `${file}: KNOWN_VIOLATIONS 항목과 실제 위반이 다르다 — ${JSON.stringify(why)}`).toEqual(known.scopes);
      expect(known.ticket.length).toBeGreaterThan(20);
      return;
    }
    expect(missing, `${file}가 지문 범위를 건드리고 재게시하지 않는다(§4.9-1): ${JSON.stringify(why, null, 1)}`).toEqual([]);
  });
});
