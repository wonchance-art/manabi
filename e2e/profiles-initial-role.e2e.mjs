// Isolated PostgreSQL regression. No network or production account writes.
// QA_PGLITE_MODULE may point to an external pinned @electric-sql/pglite@0.5.8 installation.
const { PGlite } = await import(process.env.QA_PGLITE_MODULE || '@electric-sql/pglite');
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migrations = new URL('../supabase/migrations/', import.meta.url);
const files = fs.readdirSync(migrations).filter(name => name.endsWith('_profiles_safe_initial_role.sql'));
assert.equal(files.length, 1, 'exactly one profile initialization migration');
const migrationSQL = fs.readFileSync(new URL(files[0], migrations), 'utf8');
const reportPath = process.env.QA_REPORT || '/private/tmp/manabi-profile-migration-report.json';
const db = new PGlite();
const checks=[];
const ids={old:'10000000-0000-0000-0000-000000000001',admin:'10000000-0000-0000-0000-000000000002',missing:'10000000-0000-0000-0000-000000000003',fresh:'10000000-0000-0000-0000-000000000004',foreign:'10000000-0000-0000-0000-000000000005'};
async function asUser(id, work){
 await db.exec('BEGIN');
 try {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);
  await db.exec('SET LOCAL ROLE authenticated');
  return await work();
 } finally { await db.exec('ROLLBACK'); }
}
async function seed(id){
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
}
try{
 await db.exec(`
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,display_name text,role text DEFAULT 'student' CHECK(role IN ('student','host','admin')),streak_count integer, last_login_at timestamptz);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.enforce_role_change_by_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'permission denied: only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_enforce_role_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_role_change_by_admin();
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
  BEGIN
    INSERT INTO public.profiles (id, display_name, role, streak_count, last_login_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', '새로운 학습자'),
      'user',
      1,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    -- 프로필 생성 실패해도 회원가입은 통과
    RETURN NEW;
  END;
  $function$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO "public" USING ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO "public" USING ((auth.uid() = id));
CREATE POLICY "anyone_read_basic_profile" ON public.profiles FOR SELECT TO "public" USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO "public" WITH CHECK ((auth.uid() = id));
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO "public" USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO "public" USING ((auth.uid() = id));
`);
 await seed(ids.old); await seed(ids.admin); await seed(ids.missing);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n,0);
 checks.push('live-schema reproduction: invalid trigger role is swallowed; profile absent');
 await db.query("INSERT INTO profiles(id,role,display_name,streak_count) VALUES($1,'student','existing learner',12),($2,'admin','existing admin',7)",[ids.old,ids.admin]);
 await asUser(ids.missing,async()=>{
  await db.query("INSERT INTO profiles(id,role) VALUES($1,'admin')",[ids.missing]);
  assert.equal((await db.query('SELECT is_admin() AS allowed')).rows[0].allowed,true);
 });
 checks.push('live-policy reproduction: missing-profile initial admin insert is allowed (local only; rolled back)');
 const before=(await db.query('SELECT * FROM profiles ORDER BY id')).rows;
 await db.exec(migrationSQL);
 assert.deepEqual((await db.query('SELECT * FROM profiles ORDER BY id')).rows,before);
 checks.push('proposed migration leaves existing profiles, roles and streaks identical');
 const config=(await db.query("SELECT proconfig FROM pg_proc WHERE oid='public.handle_new_user()'::regprocedure")).rows[0].proconfig;
 assert(config.includes('search_path=""'));
 checks.push('trigger function pins an empty search_path');
 await seed(ids.fresh);
 assert.equal((await db.query('SELECT role FROM profiles WHERE id=$1',[ids.fresh])).rows[0].role,'student');
 checks.push('new signup creates a student profile');
 for(const role of ['admin','host']){
  await assert.rejects(()=>asUser(ids.missing,()=>db.query('INSERT INTO profiles(id,role) VALUES($1,$2)',[ids.missing,role])),error=>error.code==='42501');
  checks.push('initial '+role+' assignment rejected by INSERT policy');
 }
 await asUser(ids.missing,async()=>{
  await db.query("INSERT INTO profiles(id,display_name) VALUES($1,'fallback learner')",[ids.missing]);
  assert.equal((await db.query('SELECT role FROM profiles WHERE id=$1',[ids.missing])).rows[0].role,'student');
 });
 checks.push('missing-profile fallback can still create the default student');
 await assert.rejects(()=>asUser(ids.fresh,()=>db.query("UPDATE profiles SET role='admin' WHERE id=$1",[ids.fresh])),error=>error.message.includes('only admins'));
 checks.push('existing UPDATE role protection remains active');
 await asUser(ids.fresh,async()=>{
  await db.query("UPDATE profiles SET display_name='edited' WHERE id=$1",[ids.fresh]);
  assert.equal((await db.query('SELECT display_name FROM profiles WHERE id=$1',[ids.fresh])).rows[0].display_name,'edited');
 });
 checks.push('learner can still update normal profile fields');
 await asUser(ids.admin,async()=>{
  assert.equal((await db.query('SELECT is_admin() AS allowed')).rows[0].allowed,true);
  await db.query("UPDATE profiles SET display_name='admin unchanged' WHERE id=$1",[ids.admin]);
 });
 checks.push('existing administrator authority preserved');
 await seed(ids.foreign);
 await db.query('DELETE FROM profiles WHERE id=$1',[ids.foreign]);
 await assert.rejects(()=>asUser(ids.fresh,()=>db.query("INSERT INTO profiles(id) VALUES($1)",[ids.foreign])),error=>error.code==='42501');
 checks.push('own-id INSERT restriction still rejects a different account');
 fs.writeFileSync(reportPath,JSON.stringify({engine:'PGlite 0.5.8 / local PostgreSQL only',checks,productionWrites:0,errors:[]},null,2));
 console.log(JSON.stringify({checks:checks.length,errors:[],productionWrites:0}));
}catch(error){console.error(JSON.stringify({error:error.message,code:error.code,completed:checks}));process.exitCode=1;}finally{await db.close();}

