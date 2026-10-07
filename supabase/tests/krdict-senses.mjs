/** 한국어기초사전 설치 SQL 격리 검사(PGlite 일회용 DB). 운영 DB에 연결하지 않는다.
 * node supabase/tests/krdict-senses.mjs
 * 기준선: korean-learning-support.mjs의 legacy 고정 스키마 + 실제 선행 SQL + 실제 한국어 지원 SQL.
 * 사전 행: src/lib/__tests__/fixtures/krdict-20260619-excerpt.xml(국립국어원 「한국어기초사전」
 * 발췌, CC BY-SA 2.0 KR)을 실제 임포트 함수로 변환해 적재한다.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { buildKrdictRows, buildReleaseRow, parseKrdictXml, releaseFromCreationDate, sha256 } from '../../scripts/lib/krdictImport.mjs';

const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const a = '10000000-0000-0000-0000-000000000001';
const b = '10000000-0000-0000-0000-000000000002';
const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');
const install = await read('../../docs/sql/krdict-senses.sql');
const rollback = await read('../../docs/sql/krdict-senses-rollback.sql');
const support = await read('../../docs/sql/korean-learning-support.sql');
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
async function as(role, id = null) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  if (role) await db.exec(`SET ROLE ${role}`);
}
const capabilities = async () => { await as('authenticated', a); const r = (await rows('SELECT public.learning_language_capabilities() AS r'))[0].r; await as(null); return r; };
const allTrue = { version: 1, languages: { Korean: { save: true, review: true, known: true, exclude: true } } };
const allFalse = { version: 1, languages: { Korean: { save: false, review: false, known: false, exclude: false } } };
const saveWord = async (word, meaning) => {
  await as('authenticated', a);
  const quote = `${word}을 읽어요.`;
  const result = (await rows('SELECT public.save_vocabulary_context($1,$2,NULL,NULL) AS r', [
    { word_text: word, meaning, language: 'Korean' },
    { kind: 'reading', materialId: '1', quote, locator: { tokenId: word, surface: word, sourceRevision: 'r1', start: 0, end: word.length } },
  ]))[0].r;
  await as(null);
  return result;
};
const learning = async () => ({
  vocabulary: await rows('SELECT * FROM public.user_vocabulary ORDER BY id'),
  contexts: await rows('SELECT * FROM public.vocabulary_contexts ORDER BY id'),
  known: await rows('SELECT * FROM public.user_known_words ORDER BY user_id,lang,word_text'),
  exclusions: await rows('SELECT * FROM public.vocabulary_exclusions ORDER BY id'),
  events: await rows('SELECT * FROM public.review_events ORDER BY created_at,item_key'),
  columns: await rows("SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='user_vocabulary' ORDER BY ordinal_position"),
});
const denied = (sql, params = []) => assert.rejects(db.query(sql, params), /permission denied/);
const tables = ['krdict_releases', 'krdict_senses', 'vocabulary_krdict_senses'];
const keyColumn = { krdict_releases: 'id', krdict_senses: 'release_id', vocabulary_krdict_senses: 'release_id' };

// 사전 행: 실제 임포트 함수 결과.
const xml = await read('../../src/lib/__tests__/fixtures/krdict-20260619-excerpt.xml');
const parsed = parseKrdictXml(xml);
const release = releaseFromCreationDate(parsed.creationDate);
const { rows: senseRows } = buildKrdictRows(parsed.entries, { release });
const releaseRow = buildReleaseRow({ release, sourceKind: 'unofficial-copy', inputFormat: 'xml', rows: senseRows,
  files: [{ name: 'krdict-20260619-excerpt.xml', sha256: sha256(xml), bytes: Buffer.byteLength(xml) }] });
const senseColumns = Object.keys(senseRows[0]);
async function loadRelease() {
  await as('service_role');
  await db.query(`INSERT INTO public.krdict_releases(id,snapshot_date,source_kind,source_label,source_url,license,license_url,input_format,input_files,input_digest,output_sha256,sense_count,importer_version)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`, [
    releaseRow.id, releaseRow.snapshot_date, releaseRow.source_kind, releaseRow.source_label, releaseRow.source_url, releaseRow.license,
    releaseRow.license_url, releaseRow.input_format, JSON.stringify(releaseRow.input_files), releaseRow.input_digest, releaseRow.output_sha256,
    releaseRow.sense_count, releaseRow.importer_version]);
  // 임포트의 upsert(ignoreDuplicates)와 같은 ON CONFLICT DO NOTHING — UPDATE 권한 없이 재실행 가능해야 한다.
  for (const row of senseRows) {
    await db.query(`INSERT INTO public.krdict_senses(${senseColumns.join(',')}) VALUES(${senseColumns.map((_, i) => `$${i + 1}`).join(',')})
      ON CONFLICT (release_id,entry_id,sense_no) DO NOTHING`, senseColumns.map(column => row[column]));
  }
  await as(null);
}

try {
  // legacy 고정 스키마(korean-learning-support.mjs와 같은 원본). service_role은 Supabase처럼 BYPASSRLS(합성).
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role NOSUPERUSER BYPASSRLS; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY); GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE TABLE public.reading_materials(id bigint PRIMARY KEY,owner_id uuid,visibility text,title text);
    CREATE TABLE public.uploaded_pdfs(id uuid PRIMARY KEY,owner_id uuid,title text);
    CREATE TABLE public.user_vocabulary(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,word_text text,base_form text,meaning text,furigana text,pos text,
      language text CHECK(language IN ('Japanese','Chinese','English','French')),source_sentence text,source_material_id bigint,
      interval real DEFAULT 0,ease_factor real DEFAULT 2.5,repetitions int DEFAULT 0,next_review_at timestamptz,last_reviewed_at timestamptz,UNIQUE(user_id,word_text));
    CREATE TABLE public.review_events(user_id uuid,lang text CHECK(lang IN ('Japanese','Chinese','English','French')),source text,item_key text,correct boolean,detail jsonb,created_at timestamptz DEFAULT now());
    ALTER TABLE public.reading_materials ENABLE ROW LEVEL SECURITY; ALTER TABLE public.uploaded_pdfs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY; ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY material_read ON public.reading_materials FOR SELECT USING(true);
    CREATE POLICY pdf_owner ON public.uploaded_pdfs FOR ALL TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
    CREATE POLICY vocab_owner ON public.user_vocabulary FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY event_owner ON public.review_events FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_vocabulary TO authenticated;
    GRANT SELECT,INSERT ON public.review_events TO authenticated;
    GRANT SELECT ON public.reading_materials,public.uploaded_pdfs TO authenticated;
    INSERT INTO auth.users VALUES('${a}'),('${b}');
    INSERT INTO public.reading_materials VALUES(1,'${a}','private','A');
    INSERT INTO public.user_vocabulary(user_id,word_text,base_form,meaning,language,source_sentence,interval,ease_factor,repetitions,next_review_at,last_reviewed_at)
      VALUES('${a}','books','book','my edited meaning','English','original source',30,8.1,7,'2026-10-10','2026-09-01'),
            ('${b}','책','책','private B meaning','Chinese','B source',10,3,2,'2026-10-09','2026-09-01');
    INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES('${a}','English','vocab','books',true,'{"legacy":true}');`);
  for (const path of ['../migrations/20260905065205_textbook_material_contexts.sql', '../../docs/sql/vocabulary-exclusion.sql',
    '../migrations/20260823170000_user_known_words.sql', '../../docs/sql/known-word-controls.sql']) await db.exec(await read(path));
  await db.exec(support);
  const fly = await saveWord('파리', '주로 여름철에 음식물과 더러운 물질에 몰려들며 콜레라 등의 전염병을 옮기는, 날아다니는 작은 곤충.');
  await as('authenticated', a);
  await db.query("INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES($1,'ko','이미앎')", [a]);
  await as(null);

  await check('기준선: 한국어 지원이 봉인된 상태(all-true)이고, user_vocabulary 열 추가는 그 봉인을 끈다', async () => {
    assert.deepEqual(await capabilities(), allTrue);
    // 원래 지시안(user_vocabulary에 nullable 열 2개)을 그대로 적용하면 한국어 학습 전체가 꺼진다.
    await db.exec('BEGIN; ALTER TABLE public.user_vocabulary ADD COLUMN meaning_sense_key text, ADD COLUMN meaning_release text;');
    await as('authenticated', a);
    assert.deepEqual((await rows('SELECT public.learning_language_capabilities() AS r'))[0].r, allFalse);
    await db.exec('RESET ROLE; ROLLBACK');
    assert.deepEqual(await capabilities(), allTrue);
  });

  const before = await learning();
  // Supabase 기본 권한 재현: 새 표에 anon·authenticated·service_role ALL. 설치 SQL이 이것을 걷어야 한다.
  await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role');

  await check('보존 검사는 설치 중 user_vocabulary의 카탈로그·행 변경을 잡아 전체를 되돌린다', async () => {
    const marker = 'NOTIFY pgrst';
    for (const [change, reason] of [
      ['CREATE INDEX krdict_probe ON public.user_vocabulary(word_text);', /krdict_user_vocabulary_catalog_changed/],
      ['ALTER TABLE public.user_vocabulary ADD COLUMN probe text;', /krdict_user_vocabulary_(rows|catalog)_changed/],
      ["UPDATE public.user_vocabulary SET meaning=meaning||'!' WHERE word_text='books';", /krdict_user_vocabulary_rows_changed/],
    ]) {
      const tampered = install.replace('DO $preservation$', `${change}\nDO $preservation$`);
      assert.ok(tampered.includes(change) && tampered.includes(marker));
      await assert.rejects(db.exec(tampered), reason);
      await db.exec('ROLLBACK').catch(() => {});
      for (const table of tables) assert.equal((await rows('SELECT to_regclass($1) AS r', [`public.${table}`]))[0].r, null);
    }
    assert.deepEqual(await learning(), before);
  });

  await db.exec(install);

  await check('설치: 기존 카드·문맥·아는 단어·제외·이벤트 행과 user_vocabulary 열이 바이트 단위로 같다', async () => {
    assert.deepEqual(await learning(), before);
    assert.equal((await rows('SELECT count(*)::int AS n FROM public.vocabulary_krdict_senses'))[0].n, 0);
  });

  await check('설치 뒤에도 한국어 지원 봉인이 그대로(all-true)이고 한국어 저장이 동작한다', async () => {
    assert.deepEqual(await capabilities(), allTrue);
    const saved = await saveWord('열다', '닫히거나 잠긴 것을 트거나 벗기다.');
    assert.equal(saved.created, true);
  });

  await check('재실행은 조용히 덮지 않고 거부한다', async () => {
    await assert.rejects(db.exec(install), /krdict_already_installed/);
    await db.exec('ROLLBACK').catch(() => {});
  });

  await check('RLS·권한: anon 차단, authenticated 읽기만, service_role은 넣기·지우기만(UPDATE·TRUNCATE 없음)', async () => {
    // 기본 권한 재현이 실제로 걸려 있었는지(새 표면 anon도 TRUNCATE를 받는다) — 설치 SQL의 REVOKE가 필요한 이유.
    await db.exec('CREATE TABLE public.krdict_probe(id int)');
    assert.equal((await rows("SELECT has_table_privilege('anon','public.krdict_probe','TRUNCATE') AS p"))[0].p, true);
    await db.exec('DROP TABLE public.krdict_probe');
    const matrix = await rows(`SELECT t AS table_name, r AS role, string_agg(p, ',' ORDER BY p) AS privileges
      FROM unnest($1::text[]) t CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
      WHERE has_table_privilege(r, 'public.'||t, p) GROUP BY t, r ORDER BY t, r`, [tables]);
    assert.deepEqual(matrix, tables.flatMap(table => [
      { table_name: table, role: 'authenticated', privileges: 'SELECT' },
      { table_name: table, role: 'service_role', privileges: 'DELETE,INSERT,SELECT' },
    ]));
    for (const table of tables) {
      assert.equal((await rows('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [`public.${table}`]))[0].relrowsecurity, true);
    }
    await as('anon');
    for (const table of tables) await denied(`SELECT * FROM public.${table}`);
    await as('authenticated', a);
    for (const table of tables) {
      assert.deepEqual(await rows(`SELECT * FROM public.${table}`), []);
      await denied(`DELETE FROM public.${table}`);
      await denied(`UPDATE public.${table} SET ${keyColumn[table]}=${keyColumn[table]}`);
      await denied(`TRUNCATE public.${table}`);
    }
    await denied("INSERT INTO public.krdict_releases(id) VALUES('krdict-20260619')");
    await as('service_role');
    await denied("UPDATE public.krdict_senses SET definition_ko='위조'");
    await denied("UPDATE public.krdict_releases SET sense_count=1");
    for (const table of tables) await denied(`TRUNCATE public.${table}`);
    await as(null);
  });

  await check('적재: 임포트 결과를 service_role로 넣고, 재실행은 같은 행 수로 끝난다(ON CONFLICT DO NOTHING)', async () => {
    await loadRelease();
    await loadRelease();
    await as('authenticated', a);
    const counted = (await rows('SELECT count(*)::int AS n FROM public.krdict_senses WHERE release_id=$1', [release]))[0].n;
    assert.equal(counted, releaseRow.sense_count);
    const stored = await rows(`SELECT ${senseColumns.join(',')} FROM public.krdict_senses ORDER BY entry_id,sense_no`);
    assert.deepEqual(stored, senseRows);
    const walk = await rows("SELECT sense_key FROM public.krdict_senses WHERE release_id=$1 AND lookup_form='걷다' ORDER BY homograph_no,entry_id,display_order", [release]);
    assert.equal(walk.length, 11);
    assert.equal(walk[3].sense_key, 'krdict:29667:2');
    const fly = (await rows("SELECT definition_ko,zh_cn_equivalent FROM public.krdict_senses WHERE release_id=$1 AND sense_key='krdict:71307:1'", [release]))[0];
    assert.match(fly.definition_ko, /곤충/);
    assert.equal(fly.zh_cn_equivalent, '苍蝇');
    assert.equal((await rows("SELECT count(*)::int AS n FROM public.krdict_senses WHERE lexical_unit NOT IN ('단어','구','문법‧표현')"))[0].n, 0);
    await as(null);
    assert.ok((await rows("SELECT indexdef FROM pg_indexes WHERE indexname='krdict_senses_lookup'"))[0].indexdef.includes('(release_id, lookup_form)'));
  });

  await check('제약: 표제어 키·대역 없음·판본 날짜·공식본 형식이 어긋난 행은 들어가지 않는다', async () => {
    await as('service_role');
    const base = { ...senseRows[0], entry_id: 999999, sense_no: 1 };
    const insert = row => db.query(`INSERT INTO public.krdict_senses(${senseColumns.join(',')}) VALUES(${senseColumns.map((_, i) => `$${i + 1}`).join(',')})`, senseColumns.map(column => row[column]));
    for (const bad of [{ lookup_form: '가 맣다' }, { zh_cn_no_equivalent: true }, { lexical_unit: '관용구' }, { definition_ko: ' 앞 공백' }]) {
      await assert.rejects(insert({ ...base, ...bad }), /check constraint/);
    }
    await assert.rejects(insert({ ...base, release_id: 'krdict-20991231' }), /foreign key/);
    for (const sql of [
      "INSERT INTO public.krdict_releases SELECT 'krdict-20260620',snapshot_date,source_kind,source_label,source_url,license,license_url,input_format,input_files,input_digest,output_sha256,sense_count,importer_version FROM public.krdict_releases",
      "INSERT INTO public.krdict_releases SELECT 'krdict-20260620','2026-06-20','official',source_label,source_url,license,license_url,'jsonl',input_files,input_digest,output_sha256,sense_count,importer_version FROM public.krdict_releases",
    ]) await assert.rejects(db.query(sql), /check constraint/);
    await as(null);
  });

  const flyCard = fly.vocabularyId;
  await check('카드 연결: 있는 뜻만 가리키고, 주인만 읽고, 가리켜진 뜻 행은 지울 수 없다', async () => {
    await as('service_role');
    await assert.rejects(db.query("INSERT INTO public.vocabulary_krdict_senses(vocabulary_id,release_id,sense_key) VALUES($1,$2,'krdict:71307:9')", [flyCard, release]), /foreign key/);
    await assert.rejects(db.query("INSERT INTO public.vocabulary_krdict_senses(vocabulary_id,release_id,sense_key) VALUES($1,'krdict-20251219','krdict:71307:1')", [flyCard]), /foreign key/);
    await db.query("INSERT INTO public.vocabulary_krdict_senses(vocabulary_id,release_id,sense_key) VALUES($1,$2,'krdict:71307:1')", [flyCard, release]);
    await assert.rejects(db.query("DELETE FROM public.krdict_senses WHERE sense_key='krdict:71307:1'"), /foreign key/);
    await as('authenticated', a);
    assert.deepEqual((await rows('SELECT vocabulary_id,release_id,sense_key FROM public.vocabulary_krdict_senses')), [{ vocabulary_id: flyCard, release_id: release, sense_key: 'krdict:71307:1' }]);
    await as('authenticated', b);
    assert.deepEqual(await rows('SELECT * FROM public.vocabulary_krdict_senses'), []);
    await as(null);
    // 연결 기록이 카드 행(뜻·일정·출처)을 바꾸지 않는다.
    assert.deepEqual((await rows('SELECT * FROM public.user_vocabulary WHERE id=$1', [flyCard]))[0], before.vocabulary.find(v => v.id === flyCard));
  });

  await check('한국어 지원 SQL 재적용(재봉인)이 사전 표가 있어도 그대로 통과한다', async () => {
    await db.exec(support);
    assert.deepEqual(await capabilities(), allTrue);
  });

  await check('롤백: 카드 연결이 있으면 거부하고 표를 남긴다', async () => {
    await assert.rejects(db.exec(rollback), /krdict_rollback_card_links_present/);
    await db.exec('ROLLBACK').catch(() => {});
    for (const table of tables) assert.notEqual((await rows('SELECT to_regclass($1) AS r', [`public.${table}`]))[0].r, null);
  });

  await check('카드 삭제는 연결만 함께 지우고(권한 없는 사용자도 FK cascade), 롤백은 사전 표만 지운다', async () => {
    await as('authenticated', a);
    await db.query('DELETE FROM public.user_vocabulary WHERE id=$1', [flyCard]);
    await as(null);
    assert.equal((await rows('SELECT count(*)::int AS n FROM public.vocabulary_krdict_senses'))[0].n, 0);
    const kept = await learning();
    await db.exec(rollback);
    for (const table of tables) assert.equal((await rows('SELECT to_regclass($1) AS r', [`public.${table}`]))[0].r, null);
    assert.deepEqual(await learning(), kept);
    assert.deepEqual(await capabilities(), allTrue);
  });

  await check('롤백 뒤 재설치·재적재가 같은 행을 만든다(결정적 복원 경로)', async () => {
    await db.exec(install);
    await loadRelease();
    await as('service_role');
    assert.deepEqual(await rows(`SELECT ${senseColumns.join(',')} FROM public.krdict_senses ORDER BY entry_id,sense_no`), senseRows);
    await as(null);
    assert.deepEqual(await capabilities(), allTrue);
  });

  console.log(`${checks} PostgreSQL checks passed; no live database touched.`);
} finally { await db.close(); }
