-- 멀티-언어 모드 ②: 학습 데이터에 언어 스코프 부여
-- 사용자가 선택한 active_lang으로 쿼리를 필터해 "언어별 확실한 구분"을 만든다.
-- content_sources는 이미 lang 보유. 나머지 학습 데이터에 lang 추가.

alter table vocab_decks      add column if not exists lang text;
alter table reading_progress add column if not exists lang text;
alter table uploaded_pdfs    add column if not exists lang text;

-- 조회 성능: (user, lang) 인덱스
create index if not exists vocab_decks_owner_lang  on vocab_decks (owner_id, lang);
create index if not exists reading_progress_user_lang on reading_progress (user_id, lang);

-- 기존 데이터는 lang = null (점진 백필 또는 첫 분류 시 채움).
-- 신규 데이터는 앱이 active_lang을 기록한다.

comment on column vocab_decks.lang is '단어장 언어 스코프 (en/jp/ko)';
comment on column reading_progress.lang is '읽기 진도 언어 스코프';
comment on column uploaded_pdfs.lang is '업로드 자료 언어 스코프';
