-- content_sources.language CHECK 완화 — French·Chinese 허용 (v2-F R3, #1077)
--
-- 왜: `content_sources.language`에는 `CHECK (language IN ('Japanese','English'))`가
-- 걸려 있다(20260328000100). 완화된 적이 없어 두 가지가 막혀 있었다.
--   ① 중국어 개통이 "행 하나"가 아니다 — INSERT 자체가 거부된다.
--   ② F R2로 연 **프랑스어를 DB로 끌 수 없다** — 프랑스어는 코드 기본값(DEFAULT_SOURCES)으로
--      열리는데, 그걸 덮어쓸 French 행을 넣을 수가 없다. 즉 off 스위치가 없다.
-- 선례: `user_ref_progress_lang_check`도 같은 이유로 완화했다(20260619000100).
--
-- 이 파일은 **코드**다. 운영 DB 적용은 오너 수동.

-- ① 제약 교체
ALTER TABLE content_sources
  DROP CONSTRAINT IF EXISTS content_sources_language_check;

ALTER TABLE content_sources
  ADD CONSTRAINT content_sources_language_check
  CHECK (language IN ('Japanese', 'English', 'French', 'Chinese'));

-- ② 인덱스·RLS·트리거 변경 없음 (제약만 교체)

-- ── 적용 후 오너가 쓸 수 있는 조작 (참고 — 이 파일은 실행하지 않는다) ───────────────
--
-- 중국어 개통(주제 게이트 통과분만 수집된다 — newsTopicGate.js):
--   INSERT INTO content_sources (language, source_type, name, config, is_active)
--   VALUES ('Chinese', 'wikinews_zh', '维基新闻', '{"level": "H4 상급"}', true);
--
-- 중국어 되끄기: UPDATE content_sources SET is_active = false WHERE language = 'Chinese';
--   (행을 지우면 안 된다 — DB가 그 언어를 '모르는' 상태로 돌아가지만, Chinese는 코드
--    기본값에 없으므로 결과는 같다. French는 다르다 ↓)
--
-- 프랑스어 되끄기: 코드 기본값으로 열려 있으므로 **비활성 행을 넣어** 덮는다.
--   INSERT INTO content_sources (language, source_type, name, config, is_active)
--   VALUES ('French', 'wikinews_fr', 'Wikinews français', '{"level": "B1 중급"}', false);
--   (resolveActiveSources는 "DB가 아는 언어는 활성 행만" 규칙이라 이 한 행이 기본값을 죽인다.)
