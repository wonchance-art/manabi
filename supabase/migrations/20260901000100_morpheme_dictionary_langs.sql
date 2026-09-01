-- morpheme_dictionary.language CHECK 완화 — French·Chinese 허용 (v2-T R3, #1077)
--
-- 왜: `morpheme_dictionary.language`에도 `CHECK (language IN ('Japanese','English'))`가
-- 걸려 있다(20260415000200). 완화된 적이 없다 — `content_sources`와 **같은 누락**이고,
-- 그 파일(20260831120000)의 주석이 예고한 그대로다.
--
-- 무슨 일이 벌어지고 있었나 (코드 기준 실측 2026-09-01):
--   ⑴ `fetchMeanings.js:360`의 else 분기가 영어 아닌 전 언어를 이 표에 upsert한다.
--      중국어 행은 CHECK에 막혀 **매번 거부**되고, 실패는 `console.warn` + errors 배열로
--      삼켜진다(사용자에게 새 오류가 새지 않게 한 설계 — 그래서 조용하다).
--   ⑵ 읽기도 같은 표를 본다(`ViewerPage.jsx` `token-dict` 쿼리 —
--      `.eq('language', materialLang)`). 쓰기가 못 들어가니 **항상 빈손**이다.
--
-- 그래서 두 가지가 조용히 죽어 있었다:
--   · **공유 사전 캐시가 중국어·프랑스어에서 영구히 차갑다.** 같은 단어를 몇 번을 봐도
--     매번 Gemini에 다시 묻는다(비용·지연이 그대로 반복된다).
--   · **한자 대조의 `日` 자형 줄과 `⚠` 경고가 뜰 수 없다.** 그 줄은 사전 행의
--     `meanings[].ja`를 읽는데(`getJaRef`), 행이 없으면 `undefined`라 블록이 통째로
--     null을 반환한다. 기능이 없는 게 아니라 **닿지 못하고 있었다.**
--
-- ※ v2-T 설계 §2는 중국어 가짜 표제어가 "전 사용자 공유 사전에 영구 적재된다"고 봤다.
--    코드 기준으로는 **적재된 적이 없다** — 이 CHECK가 막고 있었다. 그래서 R3의 후반
--    작업은 「청소」가 아니라 「개통」이다. 다만 운영 DB에 수동 ALTER가 적용돼 있었다면
--    얘기가 다르므로, 적용 전에 아래 ⓪ 감사 질의로 **실제 상태를 먼저 확인**한다.
--
-- 이 파일은 **코드**다. 운영 DB 적용은 오너 수동.

-- ⓪ 적용 전 감사 (실행해서 눈으로 확인 — 이 파일의 나머지와 별개)
--
--   -- 제약이 실제로 어떻게 걸려 있나
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'morpheme_dictionary'::regclass AND conname LIKE '%language%';
--
--   -- 언어별 행 수 — 중국어가 0이 아니면 수동 ALTER가 이미 적용돼 있었다는 뜻이다
--   SELECT language, source, count(*) FROM morpheme_dictionary GROUP BY 1, 2 ORDER BY 1, 2;
--
--   -- 중국어 행이 있다면: 가짜 표제어(지시사+양사)가 실제로 적재됐는지
--   SELECT base_form, source, usage_count, meanings
--   FROM morpheme_dictionary
--   WHERE language = 'Chinese'
--     AND base_form ~ '^[这那哪][个本张条只件位双部家台辆支杯碗瓶把块片篇首节门场座段层份页间头棵封幅群排顿束朵副匹盒袋串]'
--     AND base_form NOT IN ('这个', '那个', '哪个')
--   ORDER BY usage_count DESC;

-- ① 제약 교체
ALTER TABLE morpheme_dictionary
  DROP CONSTRAINT IF EXISTS morpheme_dictionary_language_check;

ALTER TABLE morpheme_dictionary
  ADD CONSTRAINT morpheme_dictionary_language_check
  CHECK (language IN ('Japanese', 'English', 'French', 'Chinese'));

-- ② 인덱스·RLS·트리거 변경 없음 (제약만 교체)

-- ── 적용 후 (참고 — 이 파일은 실행하지 않는다) ─────────────────────────────────────
--
-- 청소가 필요해지는 경우: ⓪의 세 번째 질의가 행을 뱉으면(= 수동 ALTER가 먼저 적용돼
-- 가짜 표제어가 실제로 쌓였다면) 아래로 지운다. **`user_verified`는 절대 건드리지
-- 않는다** — 사람이 고친 뜻이 자동 청소에 쓸려 나가면 안 된다.
--
--   DELETE FROM morpheme_dictionary
--   WHERE language = 'Chinese'
--     AND source <> 'user_verified'
--     AND base_form ~ '^[这那哪][个本张条只件位双部家台辆支杯碗瓶把块片篇首节门场座段层份页间头棵封幅群排顿束朵副匹盒袋串]'
--     AND base_form NOT IN ('这个', '那个', '哪个');
--
-- 되돌리기: 지운 행은 **다시 필요해지지 않는다.** v2-T R1~R3가 그 토큰들을 더는
-- 만들지 않으므로 조회 자체가 오지 않는다. 혹시 필요한 표제어를 지웠더라도 다음 분석에서
-- Gemini 조회로 자동 재생성된다(캐시이지 정본이 아니다). 그래서 롤백 SQL이 따로 없다.
--
-- 제약 롤백(원상 복구가 정말 필요할 때):
--   ALTER TABLE morpheme_dictionary DROP CONSTRAINT morpheme_dictionary_language_check;
--   ALTER TABLE morpheme_dictionary ADD CONSTRAINT morpheme_dictionary_language_check
--     CHECK (language IN ('Japanese', 'English'));
--   ⚠ 되돌리면 그 사이 들어온 중국어·프랑스어 행이 제약 위반이라 ALTER 자체가 실패한다.
--     먼저 `DELETE FROM morpheme_dictionary WHERE language IN ('French','Chinese')`가 필요하다.
