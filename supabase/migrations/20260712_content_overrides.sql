-- 챕터 콘텐츠 오버라이드 — 정적 레지스트리(src/content/**) 위에 얹는 수정본.
-- 오너가 웹 편집 모드에서 저장한 챕터 수정본을 (lang, slug) 키로 보관하고,
-- 렌더 시 서버가 원본 위에 얕게 병합한다. 원본 파일은 건드리지 않는다.
-- select는 공개(공개 렌더에 쓰임), 쓰기는 is_admin()만 (20260329_admin_rls.sql 관례).

-- ── 1. 테이블 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_overrides (
  lang       text NOT NULL,
  slug       text NOT NULL,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (lang, slug)
);

-- ── 2. updated_at 자동 갱신 트리거 ───────────────────────────
CREATE OR REPLACE FUNCTION touch_content_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_content_overrides ON content_overrides;
CREATE TRIGGER trg_touch_content_overrides
  BEFORE UPDATE ON content_overrides
  FOR EACH ROW
  EXECUTE FUNCTION touch_content_overrides_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
ALTER TABLE content_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT는 모두 허용 — 오버라이드는 공개 렌더(챕터 페이지·목록)에 병합돼 노출된다.
CREATE POLICY "public_read_overrides"
  ON content_overrides FOR SELECT
  USING (true);

-- 쓰기(INSERT/UPDATE/DELETE)는 어드민만 — is_admin() SECURITY DEFINER 헬퍼로 최종 방어.
CREATE POLICY "admin_insert_overrides"
  ON content_overrides FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "admin_update_overrides"
  ON content_overrides FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "admin_delete_overrides"
  ON content_overrides FOR DELETE
  USING (is_admin());

-- ── 4. 명시적 GRANT (Codex 검수 반영) ────────────────────────
-- default privileges에 암묵 의존하지 않고 최소 권한을 명시한다.
-- updated_by(관리자 auth uuid)는 공개 SELECT 컬럼에서 제외 — 공개 렌더에 필요한 것은
-- lang·slug·data(+관리 UI의 updated_at)뿐이다. 행 필터는 RLS, 컬럼 노출은 GRANT가 담당.
REVOKE ALL ON content_overrides FROM anon, authenticated;
GRANT SELECT (lang, slug, data, updated_at) ON content_overrides TO anon, authenticated;
-- 쓰기는 authenticated에 테이블 권한만 열고, 행 단위는 RLS is_admin() 정책이 막는다.
GRANT INSERT, UPDATE, DELETE ON content_overrides TO authenticated;
