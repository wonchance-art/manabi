-- Data API 권한 명시(GRANTS-EXPLICIT-001, 2026-10-29 KST).
-- Supabase는 2026-10-30부터 기존 프로젝트에도 public 새 테이블 자동 권한(anon · authenticated · service_role에 SELECT/INSERT/UPDATE/DELETE)을
-- 주지 않는다(supabase/discussions/45329 — 기존 테이블 권한은 그대로). 아래 테이블은 만든 마이그레이션이 그 자동 권한에만 기대고 GRANT를 적지
-- 않아, 이 마이그레이션들로 새 DB(스테이징 · 브랜치 · 로컬)를 세우면 복습 조회 · 저장 등이 permission denied(42501)로 막힌다.
--
-- 기준은 운영의 지금 RLS 정책(2026-10-29 KST 카탈로그 조회)이다 — 권한은 정책이 있는 명령만 준다:
--   authenticated: 그 테이블 정책의 명령(ALL은 넷 다). 행 범위는 지금처럼 RLS가 정한다.
--   anon: 로그인 없이 읽히는(auth.uid() 조건 없는 SELECT 정책) 테이블의 SELECT만.
--   service_role: 지금 운영처럼 넷 다(서버 코드 · cron이 RLS를 건너 쓴다 — 권한은 따로 필요).
-- 운영에는 이미 이보다 넓은 자동 권한이 있어 운영에 적용하면 바뀌는 것이 없다(GRANT는 멱등). 운영의 넓은 anon 권한을 줄이는 일은
-- 이 파일의 범위가 아니다(정책이 막고 있음 — 따로 감사).
-- 이후 새 테이블은 만드는 마이그레이션에 GRANT를 함께 적는다(계약 scripts/data-api-grants.test.js).
-- fingerprint-scope-optout: capability — review_events 권한은 지문에 들지만 운영 relacl이 이미 authenticated=arwdxtm/postgres · service_role=arwdDxtm/postgres라 이 GRANT는 aclitem을 바꾸지 않는다(같은 권한 · 같은 grantor=소유자 postgres, 슈퍼유저 실행도 소유자로 기록 — PGlite로 relacl 불변 확인)
-- fingerprint-scope-optout: core — capability 지문이 바뀌지 않아 연쇄 없음

-- 복습(요청 범위): 문법 복습 큐 · 오답 이벤트 로그(append-only — 정책이 SELECT · INSERT뿐).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_review TO authenticated;
GRANT SELECT, INSERT ON public.review_events TO authenticated;

-- 본인 행 쓰기 · 읽기(정책 ALL 또는 명령별).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_notes, public.reading_progress, public.uploaded_pdfs,
  public.user_achievements, public.push_subscriptions, public.study_paragraphs, public.study_plan_progress,
  public.user_ref_progress, public.cohort_members, public.cohort_teams, public.cohorts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.content_reports, public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_sources TO authenticated;
GRANT SELECT, INSERT ON public.daily_suggestions, public.token_corrections TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.forum_posts, public.forum_comments, public.forum_post_likes, public.forum_comment_likes,
  public.material_comments, public.vocab_decks, public.vocab_deck_words, public.writing_practice TO authenticated;
GRANT SELECT ON public.morpheme_dictionary TO authenticated;

-- 로그인 없이 읽히는 공개 목록(정책 SELECT가 auth.uid()를 보지 않는 것).
GRANT SELECT ON public.content_sources, public.daily_suggestions, public.forum_posts, public.forum_comments,
  public.forum_post_likes, public.forum_comment_likes, public.material_comments, public.morpheme_dictionary,
  public.vocab_decks, public.vocab_deck_words TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_review, public.review_events, public.grammar_notes, public.reading_progress,
  public.uploaded_pdfs, public.user_achievements, public.push_subscriptions, public.study_paragraphs, public.study_plan_progress,
  public.user_ref_progress, public.cohort_members, public.cohort_teams, public.cohorts, public.content_reports, public.notifications,
  public.content_sources, public.daily_suggestions, public.token_corrections, public.forum_posts, public.forum_comments,
  public.forum_post_likes, public.forum_comment_likes, public.material_comments, public.vocab_decks, public.vocab_deck_words,
  public.writing_practice, public.morpheme_dictionary TO service_role;

-- bigserial 기본값(nextval)은 시퀀스 USAGE가 따로 필요하다(IDENTITY 열은 필요 없음 — review_events · material_comments).
GRANT USAGE, SELECT ON SEQUENCE public.grammar_notes_id_seq, public.reading_progress_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.grammar_notes_id_seq, public.reading_progress_id_seq, public.morpheme_dictionary_id_seq
  TO service_role;
