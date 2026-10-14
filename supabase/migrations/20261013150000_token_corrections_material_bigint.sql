-- TOKEN-CORRECTIONS-BIGINT-001: 교정 이력(token_corrections).material_id를 reading_materials.id와 같은 bigint로 맞춘다.
--
-- 원인: 20260414000300_token_corrections.sql이 material_id를 uuid로 만들고 reading_materials(id)를 참조했다.
-- reading_materials.id는 처음부터 bigint(20260329000500 등)라 그 CREATE TABLE은 42804(외래 키 타입 불일치)로
-- 실패한다 — 새 DB에서는 표가 아예 생기지 않고, 손으로 만든 표라면 숫자 자료 id 저장이 거절된다.
-- 어느 쪽이든 뜻·경계 교정 이력 저장이 조용히 실패했다(클라이언트는 console.warn만).
--
-- 운영 상태를 모르므로 모든 경우를 받아낸다(비파괴):
--   ① 표 없음            → bigint로 새로 만든다.
--   ② bigint             → 타입은 그대로, 외래 키·색인·RLS만 보충한다.
--   ③ 그 밖의 타입(uuid·text 등)
--      · 모든 행이 정수 문자열(또는 행 0)  → 값 그대로 bigint로 바꾼다.
--      · 정수로 옮길 수 없는 행이 하나라도 있으면 → 아무것도 바꾸지 않고 멈춘다(행 보존, 오너 결정).
-- 이미 있는 행·정책은 지우지 않는다. 자료에 없는 id를 가리키는 옛 행이 있으면 외래 키는 NOT VALID로 두어
-- 옛 행은 남기고 새 행만 검사한다.
-- 되돌리기: 행이 없던 경우에 한해 ALTER TABLE public.token_corrections ALTER COLUMN material_id TYPE uuid USING NULL;
-- (bigint 값은 uuid로 옮길 수 없다 — 되돌릴 이유도 없다: uuid로는 어떤 자료도 가리킬 수 없다.)

DO $token_corrections_bigint$
DECLARE
  current_type text;
  unconvertible bigint;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO current_type
  FROM pg_attribute a
  WHERE a.attrelid = to_regclass('public.token_corrections') AND a.attname = 'material_id' AND NOT a.attisdropped;

  IF to_regclass('public.token_corrections') IS NULL THEN
    CREATE TABLE public.token_corrections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id bigint NOT NULL,
      token_id text NOT NULL,
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      before_value jsonb,
      after_value jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  ELSIF current_type IS NULL THEN
    RAISE EXCEPTION 'token_corrections_material_id_missing'
      USING HINT = 'token_corrections 표에 material_id 열이 없다. 손으로 만든 표로 보이니 구조를 먼저 확인한다.';
  ELSIF current_type <> 'bigint' THEN
    EXECUTE 'SELECT count(*) FROM public.token_corrections WHERE material_id IS NOT NULL AND material_id::text !~ ''^[0-9]{1,18}$'''
      INTO unconvertible;
    IF unconvertible > 0 THEN
      RAISE EXCEPTION 'token_corrections_material_id_unconvertible: % rows', unconvertible
        USING HINT = 'material_id(' || current_type || ')에 정수 자료 id로 옮길 수 없는 행이 있다. 행은 그대로 두었다 — 보존 방법을 정한 뒤 다시 적용한다.';
    END IF;
    -- 옛 외래 키와 material_id를 읽는 읽기 정책은 타입 변경을 막으므로 먼저 뗀다
    -- (아래에서 bigint 기준 외래 키와 20260414000300과 같은 정의의 정책을 다시 단다).
    ALTER TABLE public.token_corrections DROP CONSTRAINT IF EXISTS token_corrections_material_id_fkey;
    DROP POLICY IF EXISTS "Owner or author can view corrections" ON public.token_corrections;
    ALTER TABLE public.token_corrections ALTER COLUMN material_id TYPE bigint USING material_id::text::bigint;
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conrelid = 'public.token_corrections'::regclass AND conname = 'token_corrections_material_id_fkey'
  ) THEN
    ALTER TABLE public.token_corrections
      ADD CONSTRAINT token_corrections_material_id_fkey
      FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE NOT VALID;
    BEGIN
      ALTER TABLE public.token_corrections VALIDATE CONSTRAINT token_corrections_material_id_fkey;
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE NOTICE 'token_corrections: 자료가 없는 옛 행이 있어 외래 키를 NOT VALID로 둔다(옛 행 보존, 새 행만 검사).';
    END;
  END IF;
END
$token_corrections_bigint$;

CREATE INDEX IF NOT EXISTS token_corrections_material_token_idx
  ON public.token_corrections (material_id, token_id);
CREATE INDEX IF NOT EXISTS token_corrections_user_idx
  ON public.token_corrections (user_id, created_at DESC);

ALTER TABLE public.token_corrections ENABLE ROW LEVEL SECURITY;

-- 정책은 20260414000300과 같은 이름·같은 정의다(없을 때만 만든다 — 운영에서 손본 정책을 덮지 않는다).
DO $token_corrections_policies$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'token_corrections'
                 AND policyname = 'Owner or author can view corrections') THEN
    CREATE POLICY "Owner or author can view corrections"
      ON public.token_corrections FOR SELECT
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.reading_materials m
          WHERE m.id = token_corrections.material_id AND m.owner_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'token_corrections'
                 AND policyname = 'Authenticated users can insert corrections') THEN
    CREATE POLICY "Authenticated users can insert corrections"
      ON public.token_corrections FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$token_corrections_policies$;
