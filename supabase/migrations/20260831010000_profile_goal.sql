-- 개인 커리큘럼 목표: 언어·레벨 2컬럼 추가 (v2-D R2, #1077 설계 §2).
--
-- 목표 날짜는 기존 profiles.dday_date 를 그대로 쓴다 — 날짜 컬럼을 새로 만들면
-- 홈 D-Day 타일과 목표가 서로 다른 날을 가리키게 된다(중복 신설 금지).
-- 여기서 늘리는 건 "무엇을 향해 가는가"뿐이다: 언어와 도달 레벨 키(H5·B2 등,
-- refGrammarManifest 의 레벨 키).
--
-- 적용은 오너 수동(운영 DB). 저장 경로에 컬럼 부재 폴백이 걸려 있어
-- (ProfileStats — profile_levels_fr_zh 선례와 같은 패턴) 적용 전에도 안전하고,
-- 적용 즉시 저장되기 시작한다. 읽기는 profiles select('*') 라 컬럼이 없으면
-- undefined 로 흘러 궤도 줄이 조용히 빠질 뿐이다.
alter table public.profiles
  add column if not exists goal_lang  text,
  add column if not exists goal_level text;
