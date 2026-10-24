// Disposable PostgreSQL: execute the actual N3 SQL; no production connection.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const n5 = '5'.repeat(24), n4 = '4'.repeat(24), n3 = '3'.repeat(24), hash = 'a'.repeat(64);
const checks = [];
const check = async (label, fn) => { await fn(); checks.push(label); };
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const migration = await readFile(new URL('./n3-book-support.sql', import.meta.url), 'utf8');
const identity = async (id, role = 'authenticated') => {
  await db.exec('reset role');
  await db.query("select set_config('test.uid',$1,false)", [id || '']);
  await db.exec(`set role ${role}`);
};
try {
  await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${owner}'::uuid$$;
create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');
create table reading_materials(id bigint primary key,owner_id uuid,visibility text,title text,raw_text text,processed_json jsonb,document_json jsonb,source_pdf_id uuid,page_start int,direction text,created_at timestamptz default now());
create table reading_progress(material_id bigint,user_id uuid,is_completed boolean,last_token_idx int,updated_at timestamptz);
create table uploaded_pdfs(id uuid primary key,owner_id uuid,title text,filename text,language text,lang text,level text,created_at timestamptz default now(),storage_path text,thumbnail_path text);
create schema storage;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
create table user_vocabulary(id int,meaning text,fsrs jsonb);insert into user_vocabulary values(1,'preserved meaning','{"due":"2027-01-01","stability":4}');
alter table reading_materials enable row level security;alter table uploaded_pdfs enable row level security;alter table reading_progress enable row level security;
create policy m_read on reading_materials for select using(owner_id=auth.uid() or visibility='public');
create policy pdf_read on uploaded_pdfs for select using(owner_id=auth.uid());
create policy rp_read on reading_progress for select using(user_id=auth.uid());
grant usage on schema auth,public to authenticated,anon;grant select on reading_materials,uploaded_pdfs,reading_progress,user_vocabulary to authenticated,anon;
insert into reading_materials(id,owner_id,visibility,title,raw_text,processed_json) values
(1,'${owner}','private','Original','unchanged original','{}'),(2,'${other}','private','Other private','private source','{}');`);
  for (const file of ['20260906024758_textbook_book_editions.sql', '20260908025511_personal_library_catalog.sql', '20260930135103_personal_library_management.sql']) {
    await db.exec(await readFile(new URL('../../supabase/migrations/' + file, import.meta.url), 'utf8'));
  }
  const manuscript = id => ({ id, lessons: [] });
  const publish = async (book, edition) => rows('select public.publish_textbook_book($1,$2,$3,$4,$5,null,null,false)', [book, edition, hash, manuscript(book), { bundleHash: hash }]);
  await db.exec(await readFile(new URL('./n4-book-support.sql', import.meta.url), 'utf8'));
  await identity(owner);
  await publish('japanese-n5', n5);
  await publish('japanese-n4', n4);
  const n5Before = JSON.stringify(await rows("select * from textbook_book_editions where book_id='japanese-n5'"));
  const n4Before = JSON.stringify(await rows("select * from textbook_book_editions where book_id='japanese-n4'"));
  const n4ReleaseBefore = JSON.stringify(await rows("select * from textbook_book_releases where book_id='japanese-n4'"));
  const releaseBefore = JSON.stringify(await rows("select * from textbook_book_releases where book_id='japanese-n5'"));
  const wordsBefore = JSON.stringify(await rows('select * from user_vocabulary'));
  const originalBefore = JSON.stringify(await rows('select * from reading_materials order by id'));
  await check('existing N5/N4 database rejects unpublished N3', () => assert.rejects(publish('japanese-n3', n3), /check constraint/));
  await db.exec('reset role');
  for (const [target, failure] of [['public.library_target_accessible(text,text)', /n3_access_function_precondition/], ['library_private.catalog_sources()', /n3_catalog_function_precondition/]]) {
    await check('unexpected function revision aborts and atomically preserves earlier table/function changes: ' + target, async () => {
      const constraintQuery = "select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid in ('public.textbook_book_drafts'::regclass,'public.textbook_book_editions'::regclass,'public.textbook_book_releases'::regclass) order by conname";
      const constraintsBefore = JSON.stringify(await rows(constraintQuery));
      const original = (await rows('select pg_get_functiondef($1::regprocedure) as definition', [target]))[0].definition;
      const drifted = original.replace('AS $function$\n', 'AS $function$\n -- independent fixture revision\n');
      assert.notEqual(drifted, original);
      await db.exec(drifted);
      const priorBody = (await rows('select prosrc from pg_proc where oid=$1::regprocedure', [target]))[0].prosrc;
      const otherTarget = target.startsWith('public.') ? 'library_private.catalog_sources()' : 'public.library_target_accessible(text,text)';
      const otherBody = (await rows('select prosrc from pg_proc where oid=$1::regprocedure', [otherTarget]))[0].prosrc;
      await assert.rejects(db.exec(migration), failure);
      assert.equal(JSON.stringify(await rows(constraintQuery)), constraintsBefore);
      assert.equal((await rows('select prosrc from pg_proc where oid=$1::regprocedure', [target]))[0].prosrc, priorBody);
      assert.equal((await rows('select prosrc from pg_proc where oid=$1::regprocedure', [otherTarget]))[0].prosrc, otherBody);
      await db.exec(original);
    });
  }
  await db.exec('begin;' + migration + 'commit;');
  await check('N5/N4 immutable editions and pointers, words and original sources survive', async () => {
    await identity(owner);
    assert.equal(JSON.stringify(await rows("select * from textbook_book_editions where book_id='japanese-n5'")), n5Before);
    assert.equal(JSON.stringify(await rows("select * from textbook_book_releases where book_id='japanese-n5'")), releaseBefore);
    assert.equal(JSON.stringify(await rows("select * from textbook_book_editions where book_id='japanese-n4'")), n4Before);
    assert.equal(JSON.stringify(await rows("select * from textbook_book_releases where book_id='japanese-n4'")), n4ReleaseBefore);
    assert.equal(JSON.stringify(await rows('select * from user_vocabulary')), wordsBefore);
    assert.equal(JSON.stringify(await rows('select * from reading_materials order by id')), originalBefore);
  });
  await check('administrator publishes N3 through unchanged transactional RPC', () => publish('japanese-n3', n3));
  await check('unlisted course still fails the database allowlist', () => assert.rejects(publish('japanese-n2', '2'.repeat(24)), /check constraint/));
  await check('published N3 cannot be silently overwritten', async () => {
    await assert.rejects(rows('select public.publish_textbook_book($1,$2,$3,$4,$5,null,1,false)', ['japanese-n3', n3, hash, { ...manuscript('japanese-n3'), changed: true }, { bundleHash: hash }]), /immutable_edition/);
    await assert.rejects(rows("update textbook_book_editions set manuscript='{}' where book_id='japanese-n3'"), /permission denied/);
  });
  await identity(other);
  await check('normal learner cannot publish, edit releases or read administrator drafts', async () => {
    await assert.rejects(publish('japanese-n3', 'b'.repeat(24)), /admin_required/);
    assert.equal((await rows('select * from textbook_book_drafts')).length, 0);
    assert.equal((await rows("update textbook_book_releases set edition_id=$1 where book_id='japanese-n3' returning *", [n3])).length, 0);
  });
  await check('N3/N4/N5 bookmarks have correct titles/levels while missing editions fail', async () => {
    assert.equal((await rows("select library_target_accessible('edition',$1) ok", [n3]))[0].ok, true);
    assert.equal((await rows("select library_target_accessible('edition',$1) ok", [n4]))[0].ok, true);
    assert.equal((await rows("select library_target_accessible('edition',$1) ok", [n5]))[0].ok, true);
    assert.equal((await rows("select library_target_accessible('edition','missing') ok"))[0].ok, false);
    await rows("insert into library_item_state(owner_id,target_kind,target_id) values($1,'edition',$2),($1,'edition',$3),($1,'edition',$4)", [other, n3, n4, n5]);
    const catalog = await rows("select * from library_catalog_rows() where target_kind='edition' order by level");
    assert.deepEqual(catalog.map(r => [r.level, r.title, r.target_id]), [['N3', '일본어 N3', n3], ['N4', '일본어 N4', n4], ['N5', '일본어 N5', n5]]);
  });
  await check('other learner cannot see this learner’s saved N3 library record', async () => {
    await identity(owner);
    assert.equal((await rows("select * from library_item_state where target_kind='edition'")).length, 0);
    assert.equal((await rows("select * from library_catalog_rows() where target_kind='edition'")).length, 0);
  });
  await check('anonymous reads published N3 but cannot save or execute publication', async () => {
    await identity(null, 'anon');
    assert.equal((await rows("select edition_id from textbook_book_editions where book_id='japanese-n3'"))[0].edition_id, n3);
    await assert.rejects(publish('japanese-n3', 'b'.repeat(24)), /permission denied/);
    await assert.rejects(rows("insert into library_item_state(owner_id,target_kind,target_id) values($1,'edition',$2)", [other, n3]), /permission denied/);
  });
  await check('reapplying the old precondition aborts instead of overwriting newer definitions', async () => {
    await db.exec('reset role;begin;');
    await assert.rejects(db.exec(migration), /n3_constraint_precondition/);
    await db.exec('rollback;');
    assert.equal((await rows("select edition_id from textbook_book_releases where book_id='japanese-n3'"))[0].edition_id, n3);
  });
  const report = { passed: true, checks, scope: 'Disposable PGlite, synthetic identities. No live account or production writes.' };
  const output = process.env.N3_SQL_REPORT;
  if (output) { await mkdir(new URL('.', 'file://' + output).pathname, { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify(report, null, 2));
} finally { await db.close(); }
