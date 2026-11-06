-- 언어 표시가 빈 초기 자료 10개에 metadata.language 채우기(DATA-TUNE-001 ④, 2026-11-06 KST · 오케스트레이터 진행 지시 · 백엔드 자율 범위).
-- 문제: 뷰어는 metadata.language가 없으면 일본어로 연다(ViewerPage materialLang 기본값) — 영어 글 7개가 일본어 규칙(듣기 음성 · 담는 언어)으로 열린다.
-- 대상(적용 전 확인, 운영 읽기 전용 11/6): 2026-02-25 ~ 03-24에 만든 자료 10개. 모두 owner_id 없음 · private · 읽기 진행 0행 · 담긴 단어 0행.
--   바꾸기 전 값: 10개 모두 processed_json에 metadata 키가 없음(null).
-- 판정 근거(원문 글자 종류):
--   Japanese — id 1 · 5 · 7: 가나가 있다(has_kana) · 라틴 없음. 토큰도 일본어 분석(조사 · 조동사 · 후리가나).
--   English  — id 13 · 14 · 15 · 16 · 17 · 18 · 30: 라틴만 있다(가나 · 한자 · 한글 없음). 토큰도 영어 분석(관사 · 전치사 · 동명사).
-- 바꾸는 것은 metadata.language 하나뿐 — 원문 · 토큰 · 다른 칸 그대로. metadata가 이미 있으면(경합) 건드리지 않고 개수 불일치로 전체 롤백.
-- 복원: docs/sql/material-language-fill-20261106-rollback.sql.
do $lang$
declare n int;
begin
  update public.reading_materials m
     set processed_json = jsonb_set(m.processed_json, '{metadata}', jsonb_build_object('language', x.lang), true)
    from (values (1, 'Japanese'), (5, 'Japanese'), (7, 'Japanese'),
                 (13, 'English'), (14, 'English'), (15, 'English'), (16, 'English'), (17, 'English'), (18, 'English'), (30, 'English')) x(id, lang)
   where m.id = x.id and m.owner_id is null and m.processed_json->'metadata' is null and m.processed_json ? 'dictionary';
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'material language fill: expected 10 materials, got %', n; end if;
end $lang$;
