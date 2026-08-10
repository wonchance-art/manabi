-- 프로필 학습 수준: 프랑스어·중국어 컬럼 추가 — 온보딩·프로필 4트랙 대칭 완성.
-- 적용은 오너 수동(운영 DB). 코드의 저장 경로는 컬럼 부재 시 해당 필드를 빼고
-- 재시도하는 폴백이 걸려 있어(OnboardingModal·MyPage), 적용 전에도 안전하고
-- 적용 즉시 자동으로 저장되기 시작한다.
alter table public.profiles
  add column if not exists learning_level_french text,
  add column if not exists learning_level_chinese text;
