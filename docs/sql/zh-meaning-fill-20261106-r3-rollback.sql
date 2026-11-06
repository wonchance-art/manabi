-- 복원: zh-meaning-fill-20261106-r3.sql → 같은 12칸을 다시 빈 뜻으로(채운 값 그대로인 것만). 실행은 오너 확인 뒤.
do $undo$
declare f record; n int := 0; c int;
begin
  for f in select * from (values
    (188, 'id_11_8_1788062733607', '재산 손실'),
    (188, 'id_12_2_1788062733607', '평균 수명'),
    (188, 'id_14_6_1788062733607', '전체 내용, 모든 내용'),
    (210, 'id_14_8_1788451352702', '~으로, ~을 써서(수단)'),
    (210, 'id_15_11_1788451352702', '함정(군함 · 군용 선박의 총칭)'),
    (210, 'id_15_4_1788451352702', '경도(경위도의 「경」)'),
    (211, 'id_15_0_1788642155970', '~을 거쳐, ~에 의해(经统计 = 통계 결과)'),
    (211, 'id_15_10_1788642155970', '삼백, 300'),
    (211, 'id_15_5_1788642155970', '논문 심사(구두 답변 심사)'),
    (217, 'id_3_6_1788794205356', '정말 (사람을) ~하게 하다'),
    (218, 'id_3_0_1788794223640', '제압하다, 굴복시키다'),
    (218, 'id_4_2_1788794223640', '서예가')
  ) x(mid, tid, fill) loop
    update public.reading_materials
       set processed_json = jsonb_set(processed_json, array['dictionary', f.tid, 'meaning'], to_jsonb(''::text), true)
     where id = f.mid
       and processed_json->'dictionary'->f.tid->>'meaning' = f.fill;
    get diagnostics c = row_count; n := n + c;
  end loop;
  raise notice 'zh meaning fill r3 rollback: % cells restored to empty', n;
end $undo$;
