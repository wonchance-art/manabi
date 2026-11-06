-- 중국어 뜻 빈칸 3차(DATA-TUNE-001, 2026-11-06 KST · 오케스트레이터 12칸 검토 승인 21:27 KST · 백엔드 자율).
-- 2차 뒤 남은 12칸: 2차 제외 4칸(用 · 经×2 · 制服) + 교재 밖 합성어 8형. 뜻은 교재 표제어 조각을 바탕으로 문맥에 맞춰 다듬고
-- 사람(오케스트레이터 · 오너)이 표로 검토했다. 교재에 없는 판단 2칸: 舰艇 · 书法家의 접미 家.
-- 制服은 2차 「본문은 제복」 판단을 정정 — 문맥은 制服对手(상대를 제압하다)로 교재 첫 뜻이 맞다.
-- 운영 적용 11/6 21:3x KST: 적용 전 대상 빈칸 12 · 중국어 빈 칸 전체 14 → 적용 후 대상 채움 12 · 빈 칸 2(분석 실패 줄 — 재분석 대상).
-- 바꾸는 값은 「빈 meaning」뿐. 개수 불일치(경합)면 전체 롤백. 복원: zh-meaning-fill-20261106-r3-rollback.sql.
do $fill$
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
       set processed_json = jsonb_set(processed_json, array['dictionary', f.tid, 'meaning'], to_jsonb(f.fill), true)
     where id = f.mid
       and processed_json->'metadata'->>'language' = 'Chinese'
       and processed_json->'dictionary' ? f.tid
       and coalesce(processed_json->'dictionary'->f.tid->>'meaning', '') = '';
    get diagnostics c = row_count; n := n + c;
  end loop;
  if n <> 12 then raise exception 'zh meaning fill r3: expected 12 token cells, got %', n; end if;
end $fill$;
