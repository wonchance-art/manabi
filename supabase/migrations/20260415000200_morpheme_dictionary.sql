-- 공유 형태소 의미 사전 (Phase 2 하이브리드 분석 — kuromoji 분할 + 공유 캐시)
-- base_form + language 단위로 유니크. 의미는 배열(주요 뜻 1~3개).

CREATE TABLE IF NOT EXISTS morpheme_dictionary (
  id bigserial PRIMARY KEY,
  base_form text NOT NULL,              -- 사전형 (kuromoji basic_form)
  language text NOT NULL CHECK (language IN ('Japanese', 'English')),
  pos text,                             -- 품사 (한국어 표기)
  reading text,                         -- 일본어: 히라가나 / 영어: IPA
  meanings jsonb NOT NULL,              -- [{ meaning: "먹다", priority: 1 }, ...]
  source text NOT NULL DEFAULT 'gemini', -- 'gemini' | 'user_verified' | 'jmdict'
  usage_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (base_form, language)
);

CREATE INDEX IF NOT EXISTS morpheme_dict_lookup_idx
  ON morpheme_dictionary (language, base_form);
CREATE INDEX IF NOT EXISTS morpheme_dict_last_used_idx
  ON morpheme_dictionary (last_used_at DESC);

-- 모든 인증 사용자가 읽기 가능 (공유 사전)
ALTER TABLE morpheme_dictionary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read dictionary" ON morpheme_dictionary;
CREATE POLICY "Authenticated can read dictionary"
  ON morpheme_dictionary FOR SELECT
  USING (auth.role() = 'authenticated');

-- 쓰기는 서버(service_role)만 — 클라이언트 직접 insert 차단
-- (RLS가 service_role 바이패스하므로 별도 정책 불필요)

-- 조회 시 usage_count/last_used_at 일괄 업데이트 RPC
CREATE OR REPLACE FUNCTION touch_morphemes(lang text, base_forms text[])
RETURNS void AS $$
BEGIN
  UPDATE morpheme_dictionary
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE language = lang AND base_form = ANY(base_forms);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION touch_morphemes(text, text[]) TO authenticated, service_role;
