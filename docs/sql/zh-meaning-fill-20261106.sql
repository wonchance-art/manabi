-- 중국어 뜻 빈칸 채우기 1차(DATA-TUNE-001, 2026-11-06 KST · 오너 「데이터 조정하면 좋은 것들 … 학습자들을 위해」 · 백엔드 자율 범위).
-- 운영 실측: 중국어 자료의 한자 낱말 중 뜻이 빈 칸 146(자료 8개), 뜻 없이 담겨 복습에서 빠진 단어 14행(1명).
-- 이번 1차는 공유 사전(morpheme_dictionary)에 이미 뜻이 있는 것만: 자료 36칸 · 단어장 10행.
-- 뜻 고르기는 분석기와 같다(disambiguateZhPos.pickZhMeaning — 품사가 맞는 뜻 먼저, 없으면 첫 뜻), 앞뒤 공백만 걷는다.
-- 바꾸는 값은 「빈 meaning」 칸뿐이다: 이미 뜻이 있는 칸 · 행은 조건으로 건드리지 않는다(경합 시 0행 → 개수 불일치로 전체 롤백).
-- 저장 키(word_text · base_form) · FSRS 일정 칸 · 학습 계약 지문 · 다른 토큰 필드는 그대로. 대상 단어는 FSRS 카드 없음(적용 전 확인).
-- 대상 자료 8개는 모두 소유자 개인 자료이고 지문 · 작성기 · 책 가드 대상이 아니다(적용 전 확인).
-- 복원: docs/sql/zh-meaning-fill-20261106-rollback.sql(같은 목록의 칸을 다시 빈칸으로 — 그 사이 바뀐 칸은 건드리지 않음).
do $fill$
declare f record; n int := 0; c int; v int;
begin
  for f in select * from (values
    (188, 'id_10_6_1788062733607', '~할 수 있다'),
    (188, 'id_11_0_1788062733607', '이번'),
    (188, 'id_11_3_1788062733607', '~할 수 있다'),
    (188, 'id_12_0_1788062733607', '인류'),
    (188, 'id_12_6_1788062733607', '그러나'),
    (188, 'id_13_13_1788062733607', '새롭다'),
    (188, 'id_13_2_1788062733607', '전문가'),
    (188, 'id_13_3_1788062733607', '복수 접미사'),
    (188, 'id_13_7_1788062733607', '얻다'),
    (188, 'id_15_4_1788062733607', '정부'),
    (188, 'id_15_7_1788062733607', '조금'),
    (188, 'id_15_9_1788062733607', '농민'),
    (210, 'id_13_10_1788451352702', '일'),
    (210, 'id_13_6_1788451352702', '하다'),
    (210, 'id_14_5_1788451352702', '역점을 두다'),
    (210, 'id_15_0_1788451352702', '~에 근거하여'),
    (210, 'id_15_2_1788451352702', '위, ~상'),
    (210, 'id_15_6_1788451352702', '~할 수 있다'),
    (210, 'id_15_8_1788451352702', '나가다'),
    (212, 'id_14_10_1788642148866', '적'),
    (212, 'id_5_6_1788642148866', '때'),
    (214, 'id_5_1_1788642140923', '도달하다'),
    (214, 'id_5_10_1788642140923', '타이어'),
    (214, 'id_5_11_1788642140923', '납작하다'),
    (214, 'id_5_2_1788642140923', '종점'),
    (214, 'id_5_4_1788642140923', '브레이크를 밟다'),
    (214, 'id_5_5_1788642140923', '때, 시간'),
    (214, 'id_5_7_1788642140923', '놀랍다'),
    (214, 'id_5_9_1788642140923', '발견하다'),
    (214, 'id_6_1_1788642140923', '분명히'),
    (214, 'id_6_14_1788642140923', '변명하다'),
    (214, 'id_6_2_1788642140923', '틀리다'),
    (214, 'id_6_6_1788642140923', '하다'),
    (217, 'id_3_1_1788794205356', '저들'),
    (218, 'id_13_8_1788794223640', '기대다'),
    (218, 'id_3_3_1788794223640', '기대다')
  ) x(mid, tid, fill) loop
    update public.reading_materials
       set processed_json = jsonb_set(processed_json, array['dictionary', f.tid, 'meaning'], to_jsonb(f.fill), true)
     where id = f.mid
       and processed_json->'metadata'->>'language' = 'Chinese'
       and processed_json->'dictionary' ? f.tid
       and coalesce(processed_json->'dictionary'->f.tid->>'meaning', '') = '';
    get diagnostics c = row_count; n := n + c;
  end loop;
  if n <> 36 then raise exception 'zh meaning fill: expected 36 token cells, got %', n; end if;

  update public.user_vocabulary u set meaning = x.fill
    from (values
    ('00c858cc-6f1e-4d23-a3c5-868ef6f21c71'::uuid, '도달하다'),
    ('0e9a0d0b-c9da-42a0-8056-2beddf5b5864'::uuid, '타이어'),
    ('6754136a-0472-408f-8a3c-087442413b38'::uuid, '분명히'),
    ('694449f5-580c-4f95-b22a-43124ad80c13'::uuid, '놀랍다'),
    ('7d96a55e-94e0-4946-bf02-464bd1745f4c'::uuid, '발견하다'),
    ('8686ceb5-a372-4bdc-a411-718373403718'::uuid, '납작하다'),
    ('c2099a44-959d-4bf7-b4c1-dfb5cb77aa7d'::uuid, '종점'),
    ('c2eb4e22-21d2-4c8e-a586-644d97eb98fb'::uuid, '변명하다'),
    ('d25f4846-7668-49fd-81ba-741fdac4dbcf'::uuid, '틀리다'),
    ('ef6c090b-9219-4119-ba8b-21cbe3a9656f'::uuid, '브레이크를 밟다')
    ) x(id, fill)
   where u.id = x.id and u.language = 'Chinese' and coalesce(u.meaning, '') = '';
  get diagnostics v = row_count;
  if v <> 10 then raise exception 'zh meaning fill: expected 10 vocabulary rows, got %', v; end if;
end $fill$;
