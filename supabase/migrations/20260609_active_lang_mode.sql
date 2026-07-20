-- 멀티-언어 모드: 사용자의 활성 학습 언어
-- 모드 = 언어(en/jp/ko). 시작 시 선택하면 그 언어의 콘텐츠·진도·게임이 로드된다.
alter table profiles add column if not exists active_lang text;
comment on column profiles.active_lang is '활성 학습 언어 모드 (en/jp/ko). null이면 시작 시 선택 유도.';

-- 교사 역할: 기존 role(text)에 'teacher' 값을 허용(별도 제약 없음).
-- role 변경은 기존 enforce_role_change 트리거가 admin만 가능하도록 보호 중.
