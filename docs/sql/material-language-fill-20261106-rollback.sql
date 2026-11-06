-- 복원: material-language-fill-20261106.sql → 10개 자료의 metadata를 적용 전처럼 없앤다(채운 값 그대로인 것만).
-- 실행은 오너 확인 뒤(운영 SQL 편집기 · 한 트랜잭션).
do $undo$
declare n int;
begin
  update public.reading_materials m
     set processed_json = m.processed_json - 'metadata'
    from (values (1, 'Japanese'), (5, 'Japanese'), (7, 'Japanese'),
                 (13, 'English'), (14, 'English'), (15, 'English'), (16, 'English'), (17, 'English'), (18, 'English'), (30, 'English')) x(id, lang)
   where m.id = x.id and m.processed_json->'metadata' = jsonb_build_object('language', x.lang);
  get diagnostics n = row_count;
  raise notice 'material language fill rollback: % materials restored', n;
end $undo$;
