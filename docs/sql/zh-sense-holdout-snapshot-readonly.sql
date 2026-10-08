-- ZH-SENSE-HOLDOUT-001 사전 후보 스냅숏 — 읽기 전용 (2026-10-08 KST, Claude 작성 · AD-R4 PR①)
-- 목적: docs/verification/zh-sense-holdout-20261008.json의 candidates(지금은 refVocab 임시 후보)를
--       운영 사전 행으로 교체하기 위해, 세트 표제어의 morpheme_dictionary 행만 읽는다.
-- 실행: 오너 PC 또는 M09에서 Supabase 대시보드 → SQL Editor. Q1·Q2를 하나씩 실행하고 결과(JSON)를 그대로 붙인다.
-- 안전: SELECT만 한다. 각 블록을 read only 트랜잭션으로 감싸 쓰기가 불가능하다. 운영 적용 아님.
--       사용자 테이블·학습 기록·개인 식별값은 읽지 않는다. 공유 사전(morpheme_dictionary)의 세트 표제어 행만 읽는다.
-- 열: base_form(키) · meanings(후보 원본) · pos(캐시 품사 — 현행 마크 판정 입력) · source(user_verified면 설계서 §4.1에
--     따라 후보를 붙이지 않으므로 사례를 교체해야 한다). 그 밖의 열은 읽지 않는다.

-- ─────────────────────────────────────────────────────────────
-- Q1. 뜻 사례 표제어 35개(간체 30 + 번체 5)의 사전 행
--     행이 없는 표제어는 「후보 없음」이다 — 현행·시안 모두 pickZhMeaning 경로라 비교에서 빠지므로 사례를 바꾼다.
--     meanings가 1개인 행은 1차 규칙(2개 이상만 후보)에서 후보가 붙지 않는다(Q3 측정은 --offer-single).
-- ─────────────────────────────────────────────────────────────
begin read only;
select coalesce(jsonb_agg(jsonb_build_object(
         'base_form', d.base_form, 'pos', d.pos, 'source', d.source, 'meanings', d.meanings)
         order by d.base_form), '[]'::jsonb) as rows,
       (select array_agg(w order by w) from unnest(array[
          '工作', '计划', '帮助', '习惯', '要求', '健康', '打', '开', '走', '想', '带', '送', '让', '叫', '要',
          '在', '给', '还', '才', '把', '对', '都', '冲', '包', '火', '黑', '菜', '晒', '炒', '坑',
          '開', '還', '帶', '讓', '對']) as w
         where not exists (select 1 from public.morpheme_dictionary x where x.language = 'Chinese' and x.base_form = w)) as missing
from public.morpheme_dictionary d
where d.language = 'Chinese'
  and d.base_form = any (array[
    '工作', '计划', '帮助', '习惯', '要求', '健康', '打', '开', '走', '想', '带', '送', '让', '叫', '要',
    '在', '给', '还', '才', '把', '对', '都', '冲', '包', '火', '黑', '菜', '晒', '炒', '坑',
    '開', '還', '帶', '讓', '對']);
rollback;

-- ─────────────────────────────────────────────────────────────
-- Q2. 경계 사례(D)의 이은 꼴 11개 — 등재 판정 보조(설계서 §5.1)
--     source가 user_verified·jmdict면 「등재」, gemini 행만 있으면 미등재(「묶을까요?」 후보 쪽)다.
--     HSK 표 등재 여부는 코드(src/lib/data/zhHskLevel.json)로 이미 안다. 여기서는 사전 행의 출처만 본다.
-- ─────────────────────────────────────────────────────────────
begin read only;
select coalesce(jsonb_agg(jsonb_build_object(
         'base_form', d.base_form, 'pos', d.pos, 'source', d.source, 'meanings', d.meanings)
         order by d.base_form), '[]'::jsonb) as rows
from public.morpheme_dictionary d
where d.language = 'Chinese'
  and d.base_form = any (array['个人', '得了', '完了', '多方面', '不客气', '把手', '多云', '多媒体', '有空儿', '人才', '打包带']);
rollback;
